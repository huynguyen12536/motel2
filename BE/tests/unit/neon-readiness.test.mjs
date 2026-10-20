import { test, expect } from "@jest/globals";
import {
  compareHistory,
  describeTarget,
  inspectDatabase,
  inspectProvider,
} from "../../scripts/lib/neon-readiness.mjs";
import { liveTestPlan } from "../../scripts/lib/neon-e2e-plan.mjs";

test("live test dry run never grants permission, copies secrets or fabricates provider/tenant IDs", () => {
  const p = liveTestPlan({
    target: { database: "neondb" },
    provider: { status: "UNVERIFIED", projectId: "guess", password: "private-secret" },
  });
  expect(p.target).toMatchObject({ projectId: null, branchId: null, classification: "UNVERIFIED" });
  expect(p.authorization).toBe("NOT GRANTED");
  expect(p.executed).toBe(false);
  expect(p.resourcesCreated).toEqual([]);
  expect(p.tenants).toHaveLength(2);
  expect(new Set(p.tenants.map((t) => t.code)).size).toBe(2);
  expect(p.tenants.every((t) => t.tenantId === "RETURNED_BY_AUTHORIZED_REGISTRATION_API")).toBe(
    true,
  );
  expect(JSON.stringify(p)).not.toMatch(/private-secret|guess/);
});

const url = "postgresql://fixture:secret@ep-fixture.neon.tech/neondb?sslmode=require";
test("readiness metadata never contains connection credentials", () => {
  const target = describeTarget(url);
  expect(target).toEqual({
    host: "ep-fixture.neon.tech",
    database: "neondb",
    port: 5432,
    pooled: false,
    tls: "verify-full",
  });
  expect(JSON.stringify(target)).not.toMatch(/fixture:secret|postgresql:|password/);
});
test.each([
  "postgresql://u:p@localhost/dev?sslmode=require",
  "postgresql://u:p@ep-x.neon.tech/db?sslmode=disable",
  "postgresql://u:p@ep-x.neon.tech/db?sslmode=require&options=-c%20search_path%3Devil",
  "https://u:p@ep-x.neon.tech/db?sslmode=require",
])("readiness rejects unsafe targets before connecting: %s", (value) => {
  expect(() => describeTarget(value)).toThrow("NEON_READ_TARGET_INVALID");
});
test("migration comparison detects modified, failed and pending records", () => {
  const result = compareHistory(
    [
      { name: "initial", checksum: "a" },
      { name: "next", checksum: "b" },
    ],
    [
      {
        migration_name: "initial",
        checksum: "tampered",
        finished_at: new Date(),
        rolled_back_at: null,
      },
      { migration_name: "next", checksum: "b", finished_at: null, rolled_back_at: null },
    ],
  );
  expect(result.pending).toEqual(["next"]);
  expect(result.failed).toEqual(["next"]);
  expect(result.mismatches).toEqual(["initial"]);
});
test("missing API metadata never guesses a project from a hostname", async () => {
  let calls = 0;
  expect(
    (
      await inspectProvider({ DATABASE_URL: url }, async () => {
        calls++;
      })
    ).status,
  ).toBe("UNVERIFIED");
  expect(calls).toBe(0);
});
test("provider discovery is GET-only and drops returned role passwords and unknown metadata", async () => {
  const calls = [];
  const result = await inspectProvider(
    {
      NEON_API_KEY: "private-api-token",
      NEON_PROJECT_ID: "project-fixture",
      NEON_BRANCH_ID: "br-fixture",
    },
    async (address, options) => {
      calls.push([address, options]);
      const path = new URL(address).pathname;
      const payload = path.endsWith("/databases")
        ? {
            databases: [
              {
                name: "neondb",
                id: 1,
                owner_name: "owner",
                branch_id: "br-fixture",
                secret: "db-secret",
              },
            ],
          }
        : path.endsWith("/roles")
          ? { roles: [{ name: "owner", password: "role-password" }] }
          : path.endsWith("/endpoints")
            ? {
                endpoints: [
                  {
                    id: "ep-fixture",
                    host: "ep-fixture.neon.tech",
                    branch_id: "br-fixture",
                    type: "read_write",
                    secret: "ep-secret",
                  },
                ],
              }
            : path.endsWith("/br-fixture")
              ? { branch: { id: "br-fixture", project_id: "project-fixture", name: "production" } }
              : {
                  project: {
                    id: "project-fixture",
                    history_retention_seconds: 86400,
                    password: "project-secret",
                  },
                };
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  );
  expect(result.status).toBe("PASS");
  expect(result.environmentClassification).toBe("UNVERIFIED"); // Even a branch name does not prove classification.
  expect(result.apiWritePermissions).toBe("UNVERIFIED");
  expect(result.roles).toEqual([{ name: "owner" }]);
  expect(JSON.stringify(result)).not.toMatch(
    /private-api-token|role-password|db-secret|ep-secret|project-secret/,
  );
  expect(calls).toHaveLength(5);
  expect(
    calls.every(
      ([address, options]) =>
        address.startsWith("https://console.neon.tech/api/v2/projects/project-fixture") &&
        options.method === "GET" &&
        options.redirect === "error",
    ),
  ).toBe(true);
});
test("provider failures suppress raw responses and do not issue follow-up requests", async () => {
  let calls = 0;
  const r = await inspectProvider(
    { NEON_API_KEY: "private", NEON_PROJECT_ID: "project-fixture", NEON_BRANCH_ID: "br-fixture" },
    async () => {
      calls++;
      throw Error("postgresql://private:password@host/db");
    },
  );
  expect(r).toEqual({ status: "UNVERIFIED", reason: "PROVIDER_READ_FAILED" });
  expect(calls).toBe(1);
});
test("SQL audit starts READ ONLY, selects catalog metadata and always rolls back/closes", async () => {
  const calls = [];
  class FakeClient {
    constructor(config) {
      expect(config.ssl.rejectUnauthorized).toBe(true);
    }
    async connect() {
      calls.push("connect");
    }
    async query(sql) {
      calls.push(sql);
      if (sql.includes("current_database() AS database"))
        return { rows: [{ database: "neondb", read_only: "on" }] };
      if (sql.includes("AS count")) return { rows: [{ count: 2 }] };
      if (sql.includes("older_than_one_minute")) return { rows: [{ older_than_one_minute: 0 }] };
      return { rows: [] };
    }
    async end() {
      calls.push("end");
    }
  }
  const result = await inspectDatabase(url, [], FakeClient);
  expect(result.status).toBe("PASS");
  expect(calls[1]).toBe("BEGIN READ ONLY");
  expect(calls.slice(-2)).toEqual(["ROLLBACK", "end"]);
  expect(calls.slice(2, -2).every((s) => s.startsWith("SELECT "))).toBe(true);
});
test("SQL audit closes resources after a failed identity check", async () => {
  const calls = [];
  class FakeClient {
    async connect() {}
    async query(sql) {
      calls.push(sql);
      return { rows: [{ database: "wrong", read_only: "off" }] };
    }
    async end() {
      calls.push("end");
    }
  }
  await expect(inspectDatabase(url, [], FakeClient)).rejects.toThrow("READ_TARGET_MISMATCH");
  expect(calls.slice(-2)).toEqual(["ROLLBACK", "end"]);
});
