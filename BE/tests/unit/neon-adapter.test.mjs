import "../support/phase2-env.mjs";
import { test, expect } from "@jest/globals";
const { NeonClient } = await import("../../dist/src/saas/neon.client.js");
const { NeonDatabaseBackend, assertBranchIsolationPolicy } =
  await import("../../dist/src/saas/neon.backend.js");
const signal = () => new AbortController().signal;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const resource = {
  id: 42,
  name: "tenant_abc",
  branch_id: "br-test",
  owner_name: "migration_owner",
};
test("Neon adapter parses and verifies the official database response", async () => {
  const calls = [];
  const client = new NeonClient("test-only", "project-test", "br-test", async (url, options) => {
    calls.push([url, options]);
    return json({ database: resource }, options.method === "POST" ? 201 : 200);
  });
  expect(await client.create("tenant_abc", "migration_owner", signal())).toEqual(resource);
  expect(JSON.parse(calls[0][1].body)).toEqual({
    database: { name: "tenant_abc", owner_name: "migration_owner" },
  });
  expect(calls[0][0]).toBe(
    "https://console.neon.tech/api/v2/projects/project-test/branches/br-test/databases",
  );
});
test.each([
  [401, "NEON_PERMISSION_DENIED"],
  [403, "NEON_PERMISSION_DENIED"],
  [429, "NEON_RATE_LIMITED"],
  [409, "NEON_RESOURCE_CONFLICT"],
  [503, "NEON_UNAVAILABLE"],
])("HTTP %s becomes a sanitized error", async (status, code) => {
  const client = new NeonClient("test-only", "project-test", "br-test", async () =>
    json({ secret: "must never escape" }, status),
  );
  await expect(client.inspect("tenant_abc", signal())).rejects.toThrow(code);
});
test("404 means missing; create timeouts are ambiguous and never treated as success", async () => {
  const missing = new NeonClient("test", "project-test", "br-test", async () => json({}, 404));
  expect(await missing.inspect("tenant_abc", signal())).toBeNull();
  const timeout = new NeonClient("test", "project-test", "br-test", async () => {
    throw new Error("postgresql://private");
  });
  await expect(timeout.create("tenant_abc", "owner", signal())).rejects.toThrow(
    "NEON_CREATION_AMBIGUOUS",
  );
  await expect(timeout.inspect("tenant_abc", signal())).rejects.toThrow("NEON_UNAVAILABLE");
});
test.each([
  { ...resource, branch_id: "br-other" },
  { ...resource, name: "unexpected" },
])("existing resource identity is checked", async (database) => {
  const client = new NeonClient("test", "project-test", "br-test", async () => json({ database }));
  await expect(client.inspect("tenant_abc", signal())).rejects.toThrow(
    "NEON_RESOURCE_IDENTITY_MISMATCH",
  );
});
test("branch/project mismatch and malformed payloads are rejected", async () => {
  const client = new NeonClient("test", "project-test", "br-test", async (url) =>
    url.endsWith("/project-test")
      ? json({ project: { id: "project-test" } })
      : json({ branch: { id: "br-test", project_id: "other" } }),
  );
  await expect(client.target(signal())).rejects.toThrow("NEON_TARGET_MISMATCH");
  const malformed = new NeonClient("test", "project-test", "br-test", async () =>
    json({ database: { name: "tenant_abc" } }),
  );
  await expect(malformed.inspect("tenant_abc", signal())).rejects.toThrow(
    "NEON_RESOURCE_IDENTITY_MISMATCH",
  );
});
test("connection lookup sends an explicit branch and disables pooling", async () => {
  let path;
  const c = new NeonClient("test", "project-test", "br-test", async (url) => {
    path = url;
    return json({ uri: "postgresql://fixture" });
  });
  await c.connection("tenant_abc", "owner", signal());
  const u = new URL(path);
  expect(Object.fromEntries(u.searchParams)).toEqual({
    branch_id: "br-test",
    database_name: "tenant_abc",
    role_name: "owner",
    pooled: "false",
  });
});
test("live backend refuses all writes while provisioning is disabled", async () => {
  await expect(new NeonDatabaseBackend().provision({}, signal())).rejects.toThrow(
    "LIVE_RESOURCE_AUTHORIZATION_REQUIRED",
  );
});

test("PUBLIC CONNECT isolation blocker rejects provisioning before any Neon resource write", async () => {
  const calls = [];
  const backend = new NeonDatabaseBackend();
  backend.client = () => ({
    target: async () => calls.push("GET target"),
    inspect: async () => {
      calls.push("GET database");
      return null;
    },
    create: async () => {
      calls.push("POST database");
    },
  });
  backend.ownerUrl = async () => "postgresql://fixture:fixture@ep-fixture.neon.tech/neondb";
  backend.query = async (_url, work) =>
    work({
      query: async (sql, params) => {
        calls.push(sql);
        expect(params).toEqual(["tenant_fixture"]);
        return { rows: [{ "?column?": 1 }] };
      },
    });
  await expect(backend.provision({ databaseName: "tenant_fixture" }, signal())).rejects.toThrow(
    "BRANCH_ISOLATION_POLICY_REQUIRED",
  );
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatch(/^SELECT 1 FROM pg_database/);
  expect(calls).not.toContain("POST database");
});

test("branch ACL preflight is read-only and permits a restrictive PUBLIC policy", async () => {
  let calls = 0;
  await assertBranchIsolationPolicy(
    {
      query: async (sql, params) => {
        calls++;
        expect(sql).toMatch(/^SELECT /);
        expect(sql).toContain("a.grantee=0");
        expect(sql).toContain("a.privilege_type='CONNECT'");
        expect(params).toEqual(["tenant_fixture"]);
        return { rows: [] };
      },
    },
    "tenant_fixture",
  );
  expect(calls).toBe(1);
});
