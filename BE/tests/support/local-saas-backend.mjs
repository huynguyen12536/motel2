import { createServer } from "node:http";
import pg from "pg";
import { SaasTestResources } from "../../scripts/lib/saas-test-resources.mjs";
import { NeonClient } from "../../dist/src/saas/neon.client.js";
import { PipelineError } from "../../dist/src/saas/contracts.js";
import { credential, digest, identifier } from "../../dist/src/saas/security.js";
import { migrateTenant } from "../../dist/src/saas/tenant-migrator.js";
export function localPolicy(context) {
  return {
    provisioningEnabled: true,
    bootstrapEnabled: true,
    rolloutEnabled: true,
    projectId: "project-test",
    branchId: "br-test",
    maxDatabases: 30,
    prefix: "t_" + context.suffix + "_",
    credentialVersion: "v1",
  };
}
export class LocalConnections {
  constructor(context) {
    this.resources = new SaasTestResources(context);
  }
  async resolve(mapping) {
    await this.resources.verifyDatabase(mapping);
    if (
      mapping.databaseHost !== "127.0.0.1" ||
      mapping.databasePort !== this.resources.context.ownership.port
    )
      throw new PipelineError("TEST_TARGET_MISMATCH");
    const url = new URL(this.resources.ownerUrl(mapping.databaseName));
    url.username = mapping.applicationRole;
    url.password = credential(
      mapping.tenantId,
      mapping.neonProjectId,
      mapping.neonBranchId,
      mapping.credentialVersion,
    );
    return {
      url: url.toString(),
      tls: false,
      fingerprint: digest(
        mapping.updatedAt.toString() + mapping.applicationRole + mapping.credentialVersion,
      ),
    };
  }
}
export class LocalNeonBackend {
  constructor(context) {
    this.context = context;
    this.resources = new SaasTestResources(context);
  }
  client() {
    return new NeonClient(this.context.mockToken, "project-test", "br-test", (url, options) => {
      const parsed = new URL(url);
      return fetch(this.context.mockOrigin + parsed.pathname + parsed.search, options);
    });
  }
  async provision(mapping, signal) {
    this.resources.assertName(mapping.databaseName);
    const client = this.client();
    await client.target(signal);
    const existing = await client.inspect(mapping.databaseName, signal);
    if (existing) await this.resources.verifyDatabase(mapping);
    else await client.create(mapping.databaseName, this.context.ownership.role, signal);
    await this.resources.verifyDatabase(mapping);
    const role = mapping.applicationRole,
      password = credential(
        mapping.tenantId,
        mapping.neonProjectId,
        mapping.neonBranchId,
        mapping.credentialVersion,
      );
    const old = await this.resources.admin(
      "SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",
      [role],
    );
    if (old.length) {
      if (old[0].marker !== this.context.ownership.runId)
        throw new PipelineError("ROLE_OWNERSHIP_MISMATCH");
    } else {
      await this.resources.admin(
        "CREATE ROLE " +
          identifier(role) +
          " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '" +
          password +
          "'",
      );
      await this.resources.admin(
        "COMMENT ON ROLE " + identifier(role) + " IS '" + this.context.ownership.runId + "'",
      );
    }
    await this.resources.admin(
      "GRANT CONNECT ON DATABASE " + identifier(mapping.databaseName) + " TO " + identifier(role),
    );
    const resource = await client.inspect(mapping.databaseName, signal);
    return {
      neonDatabaseId: String(resource.id),
      databaseHost: "127.0.0.1",
      databasePort: this.context.ownership.port,
    };
  }
  async migrate(mapping, signal) {
    await this.resources.verifyDatabase(mapping);
    const injection = await (
      await fetch(this.context.mockOrigin + "/__test/migration", {
        headers: { authorization: "Bearer " + this.context.mockToken },
      })
    ).json();
    if (injection.fail) throw new PipelineError("INJECTED_MIGRATION_FAILED", true);
    const version = await migrateTenant(
      this.resources.ownerUrl(mapping.databaseName),
      mapping.tenantId,
      { name: mapping.databaseName, host: "127.0.0.1", port: this.context.ownership.port },
      signal,
      false,
    );
    await this.resources.query(mapping.databaseName, "REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await this.resources.query(
      mapping.databaseName,
      "GRANT USAGE ON SCHEMA public TO " + identifier(mapping.applicationRole),
    );
    await this.resources.query(
      mapping.databaseName,
      'GRANT SELECT,INSERT,UPDATE ON "TenantBootstrap","User","AuthSession" TO ' +
        identifier(mapping.applicationRole),
    );
    await this.resources.query(mapping.databaseName,'GRANT SELECT,INSERT,UPDATE,DELETE ON "AuthzState","AuthzRole","AuthzPermission","AuthzRolePermission","AuthzUserRole","AuthzAudit" TO '+identifier(mapping.applicationRole));
    return version;
  }
  async verify(mapping) {
    await this.resources.verifyDatabase(mapping);
    const target = await new LocalConnections(this.context).resolve(mapping),
      client = new pg.Client({ connectionString: target.url });
    try {
      await client.connect();
      const proof = (await client.query('SELECT "tenantId" FROM "TenantBootstrap" WHERE id=1'))
        .rows[0];
      if (proof?.tenantId !== mapping.tenantId) throw new PipelineError("TENANT_IDENTITY_MISMATCH");
      const roles = (
        await client.query(
          "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      if (Object.values(roles).some(Boolean)) throw new PipelineError("ROLE_PRIVILEGES_UNSAFE");
    } finally {
      await client.end();
    }
  }
}
export async function createMockNeon(context, lookup) {
  const resources = new SaasTestResources(context),
    state = {
      createStatus: null,
      migrationFailures: 0,
      creationCount: 0,
      delayCreateMs: 0,
      requests: 0,
    };
  const server = createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.headers.authorization !== "Bearer " + context.mockToken) return respond(403, {});
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/__test/migration") {
        const fail = state.migrationFailures > 0;
        if (fail) state.migrationFailures--;
        return respond(200, { fail });
      }
      state.requests++;
      if (path === "/api/v2/projects/project-test")
        return respond(200, { project: { id: "project-test" } });
      if (path === "/api/v2/projects/project-test/branches/br-test")
        return respond(200, { branch: { id: "br-test", project_id: "project-test" } });
      const root = "/api/v2/projects/project-test/branches/br-test/databases";
      if (req.method === "POST" && path === root) {
        if (state.createStatus) {
          const status = state.createStatus;
          state.createStatus = null;
          return respond(status, { message: "mock fault" });
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) throw Error("body too big");
        }
        const { database } = JSON.parse(body),
          mapping = await lookup(database.name);
        if (
          !mapping ||
          mapping.neonProjectId !== "project-test" ||
          mapping.neonBranchId !== "br-test" ||
          database.owner_name !== context.ownership.role
        )
          return respond(409, {});
        await resources.createDatabase(
          mapping.databaseName,
          context.ownership.runId + ":" + mapping.ownershipToken,
        );
        state.creationCount++;
        if (state.delayCreateMs) await new Promise((r) => setTimeout(r, state.delayCreateMs));
        return respond(201, {
          database: {
            id: mapping.tenantId,
            name: database.name,
            owner_name: context.ownership.role,
            branch_id: "br-test",
          },
        });
      }
      if (req.method === "GET" && path.startsWith(root + "/")) {
        const name = decodeURIComponent(path.slice(root.length + 1));
        resources.assertName(name);
        const rows = await resources.admin("SELECT datname FROM pg_database WHERE datname=$1", [
          name,
        ]);
        if (!rows.length) return respond(404, {});
        const mapping = await lookup(name);
        return respond(200, {
          database: {
            id: mapping?.tenantId ?? "unknown",
            name,
            owner_name: context.ownership.role,
            branch_id: "br-test",
          },
        });
      }
      respond(404, {});
    } catch {
      respond(500, { message: "Mock resource operation failed" });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.mockOrigin = "http://127.0.0.1:" + server.address().port;
  return {
    state,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
