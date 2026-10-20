import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { inspectOwnedContainer } from "./test-owned-postgres.mjs";
const inspect = (name) =>
  JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8" }))[0];
const variables = (c) =>
  Object.fromEntries(
    c.Config.Env.map((entry) => {
      const i = entry.indexOf("=");
      return [entry.slice(0, i), entry.slice(i + 1)];
    }),
  );
export class SaasTestResources {
  constructor(context) {
    this.context = context;
  }
  static async create() {
    const c = inspect("motel-postgres-1"),
      runId = randomUUID(),
      suffix = runId.replaceAll("-", "").slice(0, 12);
    const ownership = {
      containerId: c.Id,
      runId,
      shared: true,
      role: "motel_test_" + suffix,
      port: Number(c.NetworkSettings.Ports?.["5432/tcp"]?.[0]?.HostPort),
      databases: ["motel_test_" + suffix + "_registry"],
    };
    inspectOwnedContainer(ownership);
    const rabbit = inspect("motel-rabbitmq-1");
    if (
      rabbit.Config.Labels["com.docker.compose.project"] !== "motel" ||
      rabbit.Config.Labels["com.docker.compose.service"] !== "rabbitmq" ||
      rabbit.NetworkSettings.Ports["5672/tcp"]?.[0]?.HostIp !== "127.0.0.1"
    )
      throw Error("Unverified local test broker");
    const r = variables(rabbit);
    const context = {
      ownership,
      suffix,
      password: randomBytes(32).toString("hex"),
      mockToken: randomBytes(32).toString("hex"),
      rabbit: {
        protocol: "amqp",
        hostname: "127.0.0.1",
        port: Number(rabbit.NetworkSettings.Ports["5672/tcp"][0].HostPort),
        username: r.RABBITMQ_DEFAULT_USER,
        password: r.RABBITMQ_DEFAULT_PASS,
        vhost: r.RABBITMQ_DEFAULT_VHOST ?? "/",
        heartbeat: 5,
      },
      topology: {
        exchange: "motel.test." + suffix + ".exchange",
        queue: "motel.test." + suffix + ".requested",
        retry: "motel.test." + suffix + ".retry",
        dlq: "motel.test." + suffix + ".dlq",
        retryMs: 200,
        attempts: 3,
      },
    };
    const resources = new SaasTestResources(context);
    await resources.admin(
      'CREATE ROLE "' +
        ownership.role +
        '" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ' +
        "'" +
        context.password +
        "'",
    );
    await resources.admin('COMMENT ON ROLE "' + ownership.role + '" IS ' + "'" + runId + "'");
    await resources.createDatabase(ownership.databases[0], runId);
    return resources;
  }
  adminConfig() {
    const c = inspectOwnedContainer(this.context.ownership),
      e = variables(c);
    return {
      host: "127.0.0.1",
      port: this.context.ownership.port,
      user: e.POSTGRES_USER,
      password: e.POSTGRES_PASSWORD,
      database: "postgres",
      connectionTimeoutMillis: 3000,
    };
  }
  async admin(sql, params = []) {
    const c = new pg.Client(this.adminConfig());
    try {
      await c.connect();
      return (await c.query(sql, params)).rows;
    } finally {
      await c.end();
    }
  }
  masterUrl() {
    return this.ownerUrl(this.context.ownership.databases[0]);
  }
  ownerUrl(name) {
    this.assertName(name);
    return (
      "postgresql://" +
      this.context.ownership.role +
      ":" +
      this.context.password +
      "@127.0.0.1:" +
      this.context.ownership.port +
      "/" +
      name
    );
  }
  assertName(name) {
    const prefix = "t_" + this.context.suffix + "_";
    if (
      name !== this.context.ownership.databases[0] &&
      !(name.startsWith(prefix) && /^[0-9a-f]{32}$/.test(name.slice(prefix.length)))
    )
      throw Error("Refusing non-test database name");
  }
  async createDatabase(name, marker) {
    this.assertName(name);
    if (
      marker !== this.context.ownership.runId &&
      !new RegExp("^" + this.context.ownership.runId + ":[0-9a-f-]{36}$").test(marker)
    )
      throw Error("Invalid resource marker");
    const current = await this.admin(
      "SELECT datname,pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",
      [name],
    );
    if (current.length) {
      if (current[0].owner !== this.context.ownership.role || current[0].marker !== marker)
        throw Error("Refusing unknown existing database");
      return;
    }
    await this.admin('CREATE DATABASE "' + name + '" OWNER "' + this.context.ownership.role + '"');
    await this.admin('COMMENT ON DATABASE "' + name + '" IS ' + "'" + marker + "'");
    await this.admin('REVOKE ALL ON DATABASE "' + name + '" FROM PUBLIC');
  }
  async verifyDatabase(mapping) {
    this.assertName(mapping.databaseName);
    const rows = await this.admin(
      "SELECT pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",
      [mapping.databaseName],
    );
    if (
      rows[0]?.owner !== this.context.ownership.role ||
      rows[0]?.marker !== this.context.ownership.runId + ":" + mapping.ownershipToken
    )
      throw Error("Unverified test database ownership");
  }
  async query(name, sql, params = []) {
    this.assertName(name);
    const c = new pg.Client({ connectionString: this.ownerUrl(name) });
    try {
      await c.connect();
      return (await c.query(sql, params)).rows;
    } finally {
      await c.end();
    }
  }
  async cleanup() {
    const rows = await this.admin(
      "SELECT datname,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=$1)",
      [this.context.ownership.role],
    );
    for (const row of rows) {
      this.assertName(row.datname);
      if (
        row.marker !== this.context.ownership.runId &&
        !row.marker?.startsWith(this.context.ownership.runId + ":")
      )
        throw Error("Refusing cleanup: marker mismatch");
    }
    for (const row of rows) await this.admin('DROP DATABASE "' + row.datname + '" WITH (FORCE)');
    const roles = await this.admin(
      "SELECT rolname FROM pg_roles WHERE shobj_description(oid,'pg_authid')=$1",
      [this.context.ownership.runId],
    );
    for (const { rolname } of roles) {
      if (rolname !== this.context.ownership.role && !/^app_[0-9a-f]{32}_v1$/.test(rolname))
        throw Error("Unexpected test role");
      await this.admin('DROP ROLE "' + rolname + '"');
    }
  }
}
