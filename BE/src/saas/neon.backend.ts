import { Injectable } from "@nestjs/common";
import { Client } from "pg";
import type { TenantDatabase } from "../generated/master-authorized/client.js";
import { env } from "../config/env.js";
import { PipelineError } from "./contracts.js";
import type { DatabaseBackend, TenantConnections, ConnectionTarget } from "./contracts.js";
import { assertLiveAuthorization } from "./policy.js";
import { credential, databaseName, digest, identifier } from "./security.js";
import { NeonClient } from "./neon.client.js";
import { migrateTenant, pgConfig, tenantMigrationHistory } from "./tenant-migrator.js";

export function validateMapping(mapping: TenantDatabase) {
  if (
    mapping.provider !== "neon" ||
    mapping.databaseName !== databaseName(mapping.tenantId) ||
    !mapping.ownershipToken ||
    !mapping.neonProjectId ||
    !mapping.neonBranchId ||
    !mapping.credentialVersion ||
    mapping.applicationRole !==
      "app_" + mapping.tenantId.replaceAll("-", "") + "_" + mapping.credentialVersion
  )
    throw new PipelineError("TENANT_MAPPING_INVALID");
}
function allowedHost(host: string): boolean {
  return (
    host.endsWith(".neon.tech") &&
    env.TENANT_ALLOWED_DATABASE_HOSTS.split(",")
      .map((x) => x.trim())
      .includes(host)
  );
}
export async function assertBranchIsolationPolicy(client: Pick<Client, "query">, name: string) {
  const result = await client.query(
    "SELECT 1 FROM pg_database d WHERE d.datallowconn AND NOT d.datistemplate AND d.datname<>$1 AND EXISTS (SELECT 1 FROM aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE a.grantee=0 AND a.privilege_type='CONNECT') LIMIT 1",
    [name],
  );
  if (result.rows.length) throw new PipelineError("BRANCH_ISOLATION_POLICY_REQUIRED");
}
@Injectable()
export class SecureTenantConnections implements TenantConnections {
  async resolve(mapping: TenantDatabase): Promise<ConnectionTarget> {
    validateMapping(mapping);
    if (
      !mapping.databaseHost ||
      !allowedHost(mapping.databaseHost) ||
      mapping.databasePort !== 5432
    )
      throw new PipelineError("TENANT_ENDPOINT_NOT_AUTHORIZED");
    const pass = credential(
      mapping.tenantId,
      mapping.neonProjectId!,
      mapping.neonBranchId!,
      mapping.credentialVersion!,
    );
    const url = new URL("postgresql://" + mapping.databaseHost + "/" + mapping.databaseName);
    url.username = mapping.applicationRole!;
    url.password = pass;
    url.searchParams.set("sslmode", "verify-full");
    return {
      url: url.toString(),
      tls: true,
      fingerprint: digest(
        JSON.stringify([
          mapping.updatedAt,
          mapping.databaseHost,
          mapping.databaseName,
          mapping.applicationRole,
          mapping.credentialVersion,
          digest(pass),
        ]),
      ),
    };
  }
}
@Injectable()
export class NeonDatabaseBackend implements DatabaseBackend {
  private client(): NeonClient {
    assertLiveAuthorization();
    if (!env.NEON_API_KEY || !env.NEON_PROVISIONING_DIRECT_URL)
      throw new PipelineError("WORKER_CREDENTIALS_UNAVAILABLE");
    return new NeonClient(env.NEON_API_KEY, env.NEON_PROJECT_ID!, env.NEON_BRANCH_ID!);
  }
  private async ownerUrl(
    mapping: TenantDatabase,
    signal: AbortSignal,
    control = false,
  ): Promise<string> {
    const api = this.client();
    validateMapping(mapping);
    if (
      mapping.neonProjectId !== env.NEON_PROJECT_ID ||
      mapping.neonBranchId !== env.NEON_BRANCH_ID
    )
      throw new PipelineError("NEON_TARGET_MISMATCH");
    const admin = new URL(env.NEON_PROVISIONING_DIRECT_URL!);
    if (
      !allowedHost(admin.hostname) ||
      admin.hostname.includes("-pooler.") ||
      Number(admin.port || 5432) !== 5432 ||
      !admin.password ||
      !["require", "verify-full"].includes(admin.searchParams.get("sslmode") ?? "")
    )
      throw new PipelineError("WORKER_ENDPOINT_NOT_AUTHORIZED");
    const name = control ? decodeURIComponent(admin.pathname.slice(1)) : mapping.databaseName!;
    const uri = new URL(await api.connection(name, decodeURIComponent(admin.username), signal));
    if (
      uri.hostname !== admin.hostname ||
      uri.pathname !== "/" + name ||
      uri.username !== admin.username
    )
      throw new PipelineError("NEON_ENDPOINT_IDENTITY_MISMATCH");
    // Use only the separately configured provisioning credential, never API-returned passwords.
    admin.pathname = "/" + name;
    return admin.toString();
  }
  private marker(mapping: TenantDatabase) {
    return "motel:" + mapping.tenantId + ":" + mapping.ownershipToken;
  }
  private async query<T>(url: string, work: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client(pgConfig(url));
    try {
      await client.connect();
      return await work(client);
    } finally {
      await client.end();
    }
  }
  async provision(mapping: TenantDatabase, signal: AbortSignal): Promise<Partial<TenantDatabase>> {
    const api = this.client();
    await api.target(signal);
    const controlUrl = await this.ownerUrl(mapping, signal, true),
      name = mapping.databaseName!,
      marker = this.marker(mapping);
    const owner = decodeURIComponent(new URL(controlUrl).username);
    // PUBLIC CONNECT would make every new application role able to reach other databases.
    // Detect the known blocker before any resource creation; never change unrelated ACLs here.
    await this.query(controlUrl, (c) => assertBranchIsolationPolicy(c, name));
    const existing = await api.inspect(name, signal);
    if (existing) {
      const proof = await this.query(
        controlUrl,
        async (c) =>
          (
            await c.query(
              "SELECT shobj_description(oid,'pg_database') AS marker,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1",
              [name],
            )
          ).rows[0],
      );
      if (
        !proof ||
        proof.marker !== marker ||
        proof.owner !== owner ||
        existing.owner_name !== owner
      )
        throw new PipelineError("RESOURCE_OWNERSHIP_UNVERIFIED");
    } else {
      // Ambiguous POST outcomes are never blindly retried/adopted. A marker is required on recovery.
      await api.create(name, owner, signal);
      await this.query(controlUrl, (c) =>
        c.query("COMMENT ON DATABASE " + identifier(name) + " IS '" + marker + "'"),
      );
    }
    signal.throwIfAborted();
    const role = mapping.applicationRole!,
      pass = credential(
        mapping.tenantId,
        mapping.neonProjectId!,
        mapping.neonBranchId!,
        mapping.credentialVersion!,
      );
    await this.query(controlUrl, async (c) => {
      await c.query("BEGIN");
      try {
        const roles = (
          await c.query(
            "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit,shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",
            [role],
          )
        ).rows;
        if (!roles.length) {
          await c.query(
            "CREATE ROLE " +
              identifier(role) +
              " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '" +
              pass +
              "'",
          );
          await c.query("COMMENT ON ROLE " + identifier(role) + " IS '" + marker + "'");
        } else if (
          roles[0].marker !== marker ||
          roles[0].rolsuper ||
          roles[0].rolcreatedb ||
          roles[0].rolcreaterole ||
          roles[0].rolbypassrls ||
          roles[0].rolinherit
        )
          throw new PipelineError("APPLICATION_ROLE_OWNERSHIP_UNVERIFIED");
        await c.query("REVOKE ALL ON DATABASE " + identifier(name) + " FROM PUBLIC");
        await c.query("GRANT CONNECT ON DATABASE " + identifier(name) + " TO " + identifier(role));
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    });
    const verified = await api.inspect(name, signal);
    if (!verified || verified.owner_name !== owner)
      throw new PipelineError("NEON_RESOURCE_IDENTITY_MISMATCH");
    return {
      neonDatabaseId: String(verified.id),
      databaseHost: new URL(controlUrl).hostname,
      databasePort: 5432,
    };
  }
  async migrate(mapping: TenantDatabase, signal: AbortSignal): Promise<string> {
    const url = await this.ownerUrl(mapping, signal);
    const version = await migrateTenant(
      url,
      mapping.tenantId,
      { name: mapping.databaseName!, host: new URL(url).hostname, port: 5432 },
      signal,
    );
    await this.query(url, async (c) => {
      await c.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
      await c.query("GRANT USAGE ON SCHEMA public TO " + identifier(mapping.applicationRole!));
      await c.query(
        'GRANT SELECT,INSERT,UPDATE ON "User","AuthSession","TenantBootstrap" TO ' +
          identifier(mapping.applicationRole!),
      );
      await c.query(
        'GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthzState","AuthzRole","AuthzPermission","AuthzRolePermission","AuthzUserRole","AuthzAudit" TO ' +
          identifier(mapping.applicationRole!),
      );
    });
    return version;
  }
  async verify(mapping: TenantDatabase, signal: AbortSignal): Promise<void> {
    const api = this.client(),
      resource = await api.inspect(mapping.databaseName!, signal);
    if (!resource || String(resource.id) !== mapping.neonDatabaseId)
      throw new PipelineError("NEON_RESOURCE_IDENTITY_MISMATCH");
    const control = await this.ownerUrl(mapping, signal, true);
    await this.query(control, async (c) => {
      const proof = (
        await c.query(
          "SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",
          [mapping.databaseName],
        )
      ).rows[0];
      if (proof?.marker !== this.marker(mapping))
        throw new PipelineError("RESOURCE_OWNERSHIP_UNVERIFIED");
      const memberships = (
        await c.query(
          "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1 LIMIT 1",
          [mapping.applicationRole],
        )
      ).rows;
      const access = (
        await c.query(
          "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate AND datname<>$1 AND has_database_privilege($2,oid,'CONNECT')",
          [mapping.databaseName, mapping.applicationRole],
        )
      ).rows;
      if (memberships.length || access.length)
        throw new PipelineError("CROSS_DATABASE_PRIVILEGE_DETECTED");
    });
    const target = await new SecureTenantConnections().resolve(mapping);
    await this.query(target.url, async (c) => {
      const rows = (
        await c.query('SELECT "tenantId","schemaVersion" FROM "TenantBootstrap" WHERE id=1')
      ).rows;
      const latest = (await tenantMigrationHistory()).at(-1)!.name;
      if (rows[0]?.tenantId !== mapping.tenantId || rows[0]?.schemaVersion !== latest)
        throw new PipelineError("TENANT_SCHEMA_NOT_READY");
      const flags = (
        await c.query(
          "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      if (!flags || Object.values(flags).some(Boolean))
        throw new PipelineError("APPLICATION_ROLE_UNSAFE");
    });
  }
}
