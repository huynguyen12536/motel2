import "reflect-metadata";
import { test, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import { SaasTestResources } from "../../scripts/lib/saas-test-resources.mjs";
const context = process.env.SAAS_TEST_CONTEXT ? JSON.parse(process.env.SAAS_TEST_CONTEXT) : null;
const integration = context ? test : test.skip;
jest.setTimeout(180000);
let app,
  app2,
  origin,
  origin2,
  db,
  broker,
  worker,
  mock,
  resources,
  bootstrap,
  superToken,
  readerToken,
  emptyToken,
  tenantTokenA,
  tenantTokenB,
  A,
  B,
  reader,
  empty,
  readRole,
  superRole,
  seed,
  env,
  makeApp;
const password = randomBytes(24).toString("base64url");
const request = async (
  path,
  { method = "GET", body, token = superToken, base = origin, headers = {} } = {},
) => {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      "content-type": "application/json",
      connection: "close",
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json(), headers: r.headers };
};
async function login(email, pw = password, base = origin) {
  const r = await request("/platform/auth/login", {
    method: "POST",
    token: null,
    body: { email, password: pw },
    base,
  });
  expect(r.status).toBe(200);
  return r.body;
}
async function newUser(label) {
  const r = await request("/platform/users", {
    method: "POST",
    body: { email: label + "-" + context.suffix + "@test.invalid", password, name: label },
  });
  expect(r.status).toBe(201);
  return r.body;
}
async function newRole(code, permissions) {
  const r = await request("/platform/roles", {
    method: "POST",
    body: { code: code + "_" + randomBytes(3).toString("hex"), name: code },
  });
  expect(r.status).toBe(201);
  expect(
    (
      await request(`/platform/roles/${r.body.id}/permissions`, {
        method: "PUT",
        body: { permissions },
      })
    ).status,
  ).toBe(200);
  return r.body;
}
async function assign(user, ids, token = superToken) {
  return request(`/platform/users/${user.id}/roles`, {
    method: "PUT",
    body: { roleIds: ids },
    token,
  });
}
async function wait(work, predicate, timeout = 60000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const v = await work();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Owned authorization fixture timed out");
}
beforeAll(async () => {
  if (!context) return;
  const { assertTestTarget } = await import("../../scripts/lib/test-owned-postgres.mjs");
  await assertTestTarget(process.env.MASTER_DATABASE_URL, context.ownership);
  resources = new SaasTestResources(context);
  const fixtures = await import("../support/local-saas-backend.mjs");
  mock = await fixtures.createMockNeon(context, (name) =>
    db.tenantDatabase.findFirst({ where: { databaseName: name } }),
  );
  const { Module } = await import("@nestjs/common"),
    { createApplication } = await import("../../dist/src/main.js"),
    { HealthModule } = await import("../../dist/src/health/health.module.js"),
    { TenantsModule } = await import("../../dist/src/modules/tenants/tenants.module.js"),
    { SaasModule } = await import("../../dist/src/saas/saas.module.js"),
    { ProvisioningBroker } = await import("../../dist/src/saas/broker.js");
  broker = new ProvisioningBroker(context.topology, context.rabbit);
  makeApp = async () => {
    class Root {}
    Module({
      imports: [
        HealthModule,
        TenantsModule,
        SaasModule.register({
          backend: new fixtures.LocalNeonBackend(context),
          connections: new fixtures.LocalConnections(context),
          policy: fixtures.localPolicy(context),
          broker,
        }),
      ],
    })(Root);
    const a = await createApplication(Root);
    await a.listen(0, "127.0.0.1");
    return a;
  };
  app = await makeApp();
  origin = await app.getUrl();
  const { MasterPrismaService } =
    await import("../../dist/src/infrastructure/database/master/master-prisma.service.js");
  db = await app.get(MasterPrismaService).client();
  bootstrap = await (await import("../support/bootstrap-platform.mjs")).bootstrapTestPlatform(db);
  ({ seedAuthorization: seed } = await import("../../dist/src/modules/authorization/seed.js"));
  ({ env } = await import("../../dist/src/config/env.js"));
  superToken = (await login(bootstrap.email, bootstrap.password)).accessToken;
  superRole = await db.authzRole.findUnique({ where: { code: "PLATFORM_SUPER_ADMIN" } });
  reader = await newUser("reader");
  empty = await newUser("unassigned");
  readRole = await newRole("READ_ONLY", [
    "platform.settings:read",
    "platform.tenants:read",
    "platform.roles:read",
    "platform.permissions:read",
  ]);
  expect((await assign(reader, [readRole.id])).status).toBe(200);
  readerToken = (await login(reader.email)).accessToken;
  emptyToken = (await login(empty.email)).accessToken;
  app2 = await makeApp();
  origin2 = await app2.getUrl();
  const { ProvisioningWorker } = await import("../../dist/src/saas/provisioning.worker.js");
  worker = app.get(ProvisioningWorker);
  await broker.consume((m) => worker.handle(m, broker));
  const { OutboxPublisher } = await import("../../dist/src/saas/outbox.publisher.js");
  const publisher = app.get(OutboxPublisher);
  for (const label of ["A", "B"]) {
    const r = await request("/admin/tenants", {
      method: "POST",
      body: {
        name: "RBAC Tenant " + label,
        code: "RBAC_" + context.suffix.toUpperCase() + "_" + label,
        slug: "rbac-" + context.suffix + "-" + label.toLowerCase(),
      },
    });
    expect(r.status).toBe(201);
    expect(
      (await request(`/admin/tenants/${r.body.id}/provision`, { method: "POST" })).status,
    ).toBe(202);
    while (await publisher.tick(broker)) {}
    await wait(
      () => db.tenant.findUnique({ where: { id: r.body.id } }),
      (x) => x.status === "ACTIVE",
    );
    expect(
      (
        await request(`/admin/tenants/${r.body.id}/users/bootstrap`, {
          method: "POST",
          body: { email: "same-admin@test.invalid", password },
        })
      ).status,
    ).toBe(201);
    const pair = await request("/auth/login", {
      method: "POST",
      token: null,
      body: { companyCode: r.body.code, email: "same-admin@test.invalid", password },
    });
    expect(pair.status).toBe(200);
    if (label === "A") {
      A = r.body;
      tenantTokenA = pair.body.accessToken;
    } else {
      B = r.body;
      tenantTokenB = pair.body.accessToken;
    }
  }
}, 120000);
afterAll(async () => {
  if (!context) return;
  worker?.stop();
  await broker?.close();
  await app2?.close();
  await app?.close();
  await mock?.close();
  const { connect } = await import("amqplib"),
    connection = await connect(context.rabbit);
  connection.on("error", () => {});
  try {
    const c = await connection.createChannel();
    for (const n of [
      context.topology.queue,
      context.topology.dlq,
      context.topology.retry,
      context.topology.retry + ".2",
      context.topology.retry + ".3",
    ]) {
      if (!n.startsWith("motel.test." + context.suffix + ".")) throw Error("Unknown queue");
      await c.deleteQueue(n);
    }
    await c.deleteExchange(context.topology.exchange);
    await c.close();
  } finally {
    await connection.close();
  }
}, 30000);

integration(
  "designated bootstrap is concurrent/idempotent, hashed and never resets the password",
  async () => {
    const prior = await db.platformUser.findUnique({ where: { id: bootstrap.userId } });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        seed(db, "platform", {
          enabled: true,
          email: bootstrap.email,
          password: randomBytes(24).toString("base64url"),
        }),
      ),
    );
    expect(results.every((r) => r.bootstrapAccountId === bootstrap.userId)).toBe(true);
    expect(
      await db.platformUser.count({ where: { bootstrapOwner: "designated-platform-admin-v1" } }),
    ).toBe(1);
    const after = await db.platformUser.findUnique({ where: { id: bootstrap.userId } });
    expect(after.passwordHash).toBe(prior.passwordHash);
    expect(after.passwordHash).toMatch(/^scrypt\$v1\$/);
    expect(after.passwordHash).not.toBe(bootstrap.password);
    await login(bootstrap.email, bootstrap.password);
  },
);
integration(
  "missing bootstrap credentials and ordinary-email adoption fail without elevation",
  async () => {
    await expect(seed(db, "platform", { enabled: true })).rejects.toThrow(
      "PLATFORM_BOOTSTRAP_EMAIL_AND_STRONG_PASSWORD_REQUIRED",
    );
    await expect(
      seed(db, "platform", { enabled: true, email: empty.email, password }),
    ).rejects.toThrow("BOOTSTRAP_IDENTITY_REQUIRES_OPERATOR_REVIEW");
    expect(await db.authzUserRole.count({ where: { userId: empty.id } })).toBe(0);
  },
);
integration(
  "explicit init executable verifies target/migrations and bootstraps idempotently without URL fallback",
  async () => {
    const url = new URL(process.env.MASTER_DATABASE_URL);
    const childEnv = {
      ...process.env,
      AUTHZ_INIT_DATABASE_URL: url.toString(),
      AUTHZ_INIT_DOMAIN: "platform",
      AUTHZ_INIT_AUTHORIZATION_REF: "test-owned-" + context.ownership.runId,
      AUTHZ_INIT_EXPECTED_HOST: url.hostname,
      AUTHZ_INIT_EXPECTED_PORT: url.port || "5432",
      AUTHZ_INIT_EXPECTED_DATABASE: url.pathname.slice(1),
      AUTHZ_INIT_EXPECTED_OWNER: context.ownership.role,
      PLATFORM_BOOTSTRAP_ENABLED: "true",
      PLATFORM_BOOTSTRAP_EMAIL: bootstrap.email,
      PLATFORM_BOOTSTRAP_PASSWORD: bootstrap.password,
    };
    const run = (e) =>
      spawnSync(process.execPath, ["dist/src/operations/authorization-init.main.js"], {
        env: e,
        encoding: "utf8",
        timeout: 30000,
      });
    const good = run(childEnv);
    expect(good.status).toBe(0);
    expect(JSON.parse(good.stdout).designatedAccountCreatedOrVerified).toBe(true);
    expect(good.stdout + good.stderr).not.toContain(bootstrap.password);
    expect(run({ ...childEnv, AUTHZ_INIT_DATABASE_URL: "" }).status).not.toBe(0);
    expect(
      run({ ...childEnv, AUTHZ_INIT_EXPECTED_DATABASE: "unrelated_database" }).status,
    ).not.toBe(0);
    expect(run({ ...childEnv, AUTHZ_INIT_EXPECTED_OWNER: "wrong-owner" }).status).not.toBe(0);
    expect(
      await db.platformUser.count({ where: { bootstrapOwner: "designated-platform-admin-v1" } }),
    ).toBe(1);
  },
);
integration(
  "catalog reconciliation repairs system grants without destroying custom roles or changing credentials",
  async () => {
    const before = await db.platformUser.findUnique({ where: { id: bootstrap.userId } }),
      custom = await db.authzRole.count({ where: { systemManaged: false } });
    await db.authzRolePermission.delete({
      where: {
        roleId_permissionCode: { roleId: superRole.id, permissionCode: "platform.metrics:read" },
      },
    });
    await db.authzState.update({ where: { id: 1 }, data: { catalogVersion: "older-version" } });
    expect((await request("/admin/saas/metrics")).status).toBe(503);
    await seed(db, "platform", {
      enabled: true,
      email: bootstrap.email,
      password: bootstrap.password,
    });
    expect((await request("/admin/saas/metrics")).status).toBe(200);
    expect(await db.authzRole.count({ where: { systemManaged: false } })).toBe(custom);
    expect(
      (await db.platformUser.findUnique({ where: { id: bootstrap.userId } })).passwordHash,
    ).toBe(before.passwordHash);
  },
);
integration(
  "effective permissions are current, scoped, non-cacheable and contain no hashes/secrets",
  async () => {
    const r = await request("/auth/me/permissions");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.body.scope).toBe("platform");
    expect(r.body.permissions.every((p) => p.startsWith("platform."))).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|refreshHash|scrypt|postgresql:/);
    const tenant = await request("/auth/me/permissions", { token: tenantTokenA });
    expect(tenant.body.scope).toBe("tenant");
    expect(tenant.body.tenantId).toBe(A.id);
    expect(tenant.body.permissions.every((p) => p.startsWith("tenant."))).toBe(true);
  },
);
integration(
  "all permission-annotated Swagger routes reject missing credentials and missing permissions",
  async () => {
    const spec = await (await fetch(origin + "/api/docs-json")).json();
    const inventory = [];
    for (const [path, methods] of Object.entries(spec.paths))
      for (const [method, c] of Object.entries(methods))
        if (["get", "post", "put", "patch", "delete"].includes(method))
          inventory.push({
            method: method.toUpperCase(),
            path,
            scope: c["x-authorization-scope"] ?? "public-or-health",
            permissions: c["x-required-permissions"] ?? [],
            authentication: c["x-authorization-scope"]
              ? "verified scoped session/current identity"
              : "explicit public login/refresh or existing health policy",
            testCoverage: c["x-required-permissions"]?.length
              ? "HTTP 401/403 matrix; positive CRUD/flow tests"
              : "session, health and public-contract regressions",
          });
    await writeFile(
      "docs/authorization-route-inventory.json",
      JSON.stringify(
        { observedAt: new Date().toISOString(), target: "owned-local-test-api", routes: inventory },
        null,
        2,
      ) + "\n",
    );
    let checked = 0;
    const tenantUser = await request("/tenant/users", {
      method: "POST",
      token: tenantTokenA,
      body: { email: "limited@test.invalid", password },
    });
    expect(tenantUser.status).toBe(201);
    const limited = await request("/auth/login", {
      method: "POST",
      token: null,
      body: { companyCode: A.code, email: "limited@test.invalid", password },
    });
    expect(limited.status).toBe(200);
    for (const [path, methods] of Object.entries(spec.paths))
      for (const [method, contract] of Object.entries(methods)) {
        if (
          !Array.isArray(contract["x-required-permissions"]) ||
          !contract["x-required-permissions"].length
        )
          continue;
        const actual = path.replaceAll(/\{[^}]+\}/g, randomUUID()).replace("/api/v1", "");
        const no = await request(actual, { method: method.toUpperCase(), token: null });
        expect({ path, status: no.status }).toEqual({ path, status: 401 });
        const lacking = await request(actual, {
          method: method.toUpperCase(),
          token:
            contract["x-authorization-scope"] === "tenant" ? limited.body.accessToken : emptyToken,
        });
        expect({ path, status: lacking.status }).toEqual({ path, status: 403 });
        checked++;
      }
    expect(checked).toBeGreaterThanOrEqual(36);
  },
);
integration(
  "read-only role can read registry but cannot mutate it, even by bypassing UI",
  async () => {
    expect((await request("/admin/tenants", { token: readerToken })).status).toBe(200);
    expect(
      (
        await request("/admin/tenants", {
          method: "POST",
          token: readerToken,
          body: { name: "Forbidden", code: "FORBIDDEN", slug: "forbidden" },
        })
      ).status,
    ).toBe(403);
    expect(await db.tenant.count({ where: { code: "FORBIDDEN" } })).toBe(0);
  },
);
integration(
  "custom roles support transactional replace, uniqueness, safe rename and usage-protected deletion",
  async () => {
    const r = await newRole("ROLE_CRUD", ["platform.tenants:read"]);
    expect(
      (
        await request("/platform/roles", {
          method: "POST",
          body: { code: r.code, name: "duplicate" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/platform/roles/${r.id}`, {
          method: "PATCH",
          body: { name: "Renamed", description: "Scoped" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/platform/roles/${r.id}/permissions`, {
          method: "PUT",
          body: { permissions: ["platform.tenants:read", "platform.tenants:read"] },
        })
      ).status,
    ).toBe(403);
    expect((await request(`/platform/roles/${r.id}`)).body.permissionCodes).toEqual([
      "platform.tenants:read",
    ]);
    expect((await assign(empty, [r.id])).status).toBe(200);
    expect((await request(`/platform/roles/${r.id}`, { method: "DELETE" })).status).toBe(409);
    await assign(empty, []);
    expect((await request(`/platform/roles/${r.id}`, { method: "DELETE" })).status).toBe(200);
  },
);
integration(
  "system roles cannot be edited/deleted and arbitrary policy/scope injection is rejected",
  async () => {
    for (const [method, path, body] of [
      ["PATCH", `/platform/roles/${superRole.id}`, { name: "takeover" }],
      ["DELETE", `/platform/roles/${superRole.id}`, undefined],
      ["PUT", `/platform/roles/${superRole.id}/permissions`, { permissions: [] }],
    ])
      expect((await request(path, { method, body })).status).toBe(403);
    expect(
      (
        await request("/platform/roles", {
          method: "POST",
          body: { code: "INJECTED", name: "Injected", scope: "tenant", v0: "*" },
        })
      ).status,
    ).toBe(400);
  },
);
integration(
  "limited role managers cannot grant permissions/roles outside their delegation authority",
  async () => {
    const user = await newUser("delegate"),
      role = await newRole("DELEGATE", [
        "platform.roles:read",
        "platform.roles:manage",
        "platform.permissions:read",
        "platform.permissions:manage",
        "platform.users:read",
        "platform.users:manage",
      ]);
    await assign(user, [role.id]);
    const token = (await login(user.email)).accessToken;
    const target = await request("/platform/roles", {
      method: "POST",
      token,
      body: { code: "DELEGATE_TARGET", name: "Target" },
    });
    expect(target.status).toBe(201);
    expect(
      (
        await request(`/platform/roles/${target.body.id}/permissions`, {
          method: "PUT",
          token,
          body: { permissions: ["platform.metrics:read"] },
        })
      ).status,
    ).toBe(403);
    expect((await assign(user, [superRole.id], token)).status).toBe(403);
  },
);
integration(
  "revocation is enforced by two running API instances on the first request after commit",
  async () => {
    const user = await newUser("revocable"),
      role = await newRole("REVOCABLE", ["platform.tenants:read"]);
    await assign(user, [role.id]);
    const token = (await login(user.email)).accessToken;
    expect((await request("/admin/tenants", { token })).status).toBe(200);
    expect((await request("/admin/tenants", { token, base: origin2 })).status).toBe(200);
    expect(
      (
        await request(`/platform/roles/${role.id}/permissions`, {
          method: "PUT",
          body: { permissions: [] },
        })
      ).status,
    ).toBe(200);
    expect((await request("/admin/tenants", { token })).status).toBe(403);
    expect((await request("/admin/tenants", { token, base: origin2 })).status).toBe(403);
  },
);
integration(
  "restart reloads persisted policy and authorization storage failures never use stale allows",
  async () => {
    await app2.close();
    app2 = await makeApp();
    origin2 = await app2.getUrl();
    expect((await request("/admin/tenants", { token: readerToken, base: origin2 })).status).toBe(
      200,
    );
    const state = await db.authzState.findUnique({ where: { id: 1 } });
    await db.authzState.update({ where: { id: 1 }, data: { domain: "untrusted-domain" } });
    try {
      expect((await request("/admin/tenants", { base: origin2 })).status).toBe(503);
    } finally {
      await db.authzState.update({ where: { id: 1 }, data: { domain: state.domain } });
    }
  },
);
integration(
  "last eligible Super Admin cannot be removed or disabled; concurrent changes retain one",
  async () => {
    expect((await assign({ id: bootstrap.userId }, [])).status).toBe(409);
    expect(
      (
        await request(`/platform/users/${bootstrap.userId}`, {
          method: "PATCH",
          body: { status: "DISABLED" },
        })
      ).status,
    ).toBe(409);
    const second = await newUser("second-super");
    await assign(second, [superRole.id]);
    const token = (await login(second.email)).accessToken;
    const outcomes = await Promise.all([
      assign({ id: bootstrap.userId }, [], superToken),
      assign(second, [], token),
    ]);
    expect(outcomes.filter((x) => x.status === 200)).toHaveLength(1);
    const remaining = await db.authzUserRole.findMany({ where: { roleId: superRole.id } });
    expect(remaining).toHaveLength(1);
    const survivingToken = remaining[0].userId === bootstrap.userId ? superToken : token;
    expect((await assign({ id: bootstrap.userId }, [superRole.id], survivingToken)).status).toBe(
      200,
    );
  },
);
integration(
  "disabled accounts cannot authenticate or receive assignments; hashes are never returned",
  async () => {
    const u = await newUser("disabled");
    expect(
      (await request(`/platform/users/${u.id}`, { method: "PATCH", body: { status: "DISABLED" } }))
        .status,
    ).toBe(200);
    expect((await assign(u, [readRole.id])).status).toBe(409);
    expect(
      (
        await request("/platform/auth/login", {
          method: "POST",
          token: null,
          body: { email: u.email, password },
        })
      ).status,
    ).toBe(401);
    const result = await request("/platform/users");
    expect(JSON.stringify(result.body)).not.toMatch(
      /passwordHash|refreshHash|bootstrapOwner|scrypt/,
    );
  },
);
integration(
  "platform sessions rotate/revoke independently and tenant tokens never authenticate platform APIs",
  async () => {
    const pair = await login(reader.email),
      rotated = await request("/platform/auth/refresh", {
        method: "POST",
        token: null,
        body: { refreshToken: pair.refreshToken },
      });
    expect(rotated.status).toBe(200);
    expect((await request("/admin/tenants", { token: pair.accessToken })).status).toBe(401);
    expect(
      (await request("/platform/auth/logout", { method: "POST", token: rotated.body.accessToken }))
        .status,
    ).toBe(200);
    expect((await request("/admin/tenants", { token: rotated.body.accessToken })).status).toBe(401);
    expect((await request("/admin/tenants", { token: tenantTokenA })).status).toBe(401);
    expect((await request("/tenant/roles", { token: superToken })).status).toBe(401);
  },
);
integration(
  "tenant domains isolate roles/assignments and reject platform policy grants",
  async () => {
    const a = await request("/tenant/roles", { token: tenantTokenA }),
      b = await request("/tenant/roles", { token: tenantTokenB });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.items[0].id).not.toBe(b.body.items[0].id);
    const role = await request("/tenant/roles", {
      method: "POST",
      token: tenantTokenA,
      body: { code: "TENANT_LOCAL", name: "Local" },
    });
    expect(role.status).toBe(201);
    expect(
      (
        await request(`/tenant/roles/${role.body.id}/permissions`, {
          method: "PUT",
          token: tenantTokenA,
          body: { permissions: ["platform.tenants:create"] },
        })
      ).status,
    ).toBe(403);
    expect((await request(`/tenant/roles/${role.body.id}`, { token: tenantTokenB })).status).toBe(
      404,
    );
    const p = await request("/auth/me/permissions", {
      token: tenantTokenA,
      headers: { "x-tenant-id": B.id, "x-company-code": B.code },
    });
    expect(p.body.tenantId).toBe(A.id);
  },
);
integration("suspension and forged identity fail closed despite a warm Casbin cache", async () => {
  await db.tenant.update({ where: { id: A.id }, data: { status: "SUSPENDED" } });
  try {
    expect((await request("/tenant/roles", { token: tenantTokenA })).status).toBe(401);
  } finally {
    await db.tenant.update({ where: { id: A.id }, data: { status: "ACTIVE" } });
  }
  const parts = tenantTokenA.split("."),
    body = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  body.tid = B.id;
  parts[1] = Buffer.from(JSON.stringify(body)).toString("base64url");
  expect((await request("/tenant/roles", { token: parts.join(".") })).status).toBe(401);
});
integration(
  "repeated tenant seed preserves existing users/data and never restores a revoked role",
  async () => {
    const mapping = await db.tenantDatabase.findUnique({ where: { tenantId: A.id } }),
      { PrismaClient } = await import("../../dist/src/generated/tenant-authorized/client.js"),
      { PrismaPg } = await import("@prisma/adapter-pg");
    const c = new PrismaClient({
      adapter: new PrismaPg({ connectionString: resources.ownerUrl(mapping.databaseName) }),
    });
    try {
      const u = await c.user.findFirst({ where: { email: "same-admin@test.invalid" } }),
        before = await c.user.count();
      const admin = await c.authzRole.findUnique({ where: { code: "TENANT_ADMIN" } });
      await c.authzUserRole.delete({
        where: { userId_roleId: { userId: u.id, roleId: admin.id } },
      });
      await c.authzState.update({ where: { id: 1 }, data: { revision: { increment: 1 } } });
      await seed(c, "tenant:" + A.id);
      expect(await c.user.count()).toBe(before);
      expect((await c.user.findUnique({ where: { id: u.id } })).passwordHash).toBe(u.passwordHash);
      expect(await c.authzUserRole.count({ where: { userId: u.id, roleId: admin.id } })).toBe(0);
      // Restore only this test-owned assignment for later UI verification.
      await c.authzUserRole.create({
        data: { userId: u.id, roleId: admin.id, assignedBy: "test-fixture" },
      });
      await c.authzState.update({ where: { id: 1 }, data: { revision: { increment: 1 } } });
    } finally {
      await c.$disconnect();
    }
  },
);
integration("authorization mutations write actor/revision audits without credentials", async () => {
  const events = await db.authzAudit.findMany({ where: { actorId: bootstrap.userId } });
  expect(events.length).toBeGreaterThan(5);
  expect(events.every((e) => e.revision > 0)).toBe(true);
  expect(JSON.stringify(events)).not.toContain(password);
  expect(JSON.stringify(events)).not.toMatch(/passwordHash|refreshToken|postgresql:/);
});

// Optional connected UI run: same real API and owned databases, never mock HTTP authorization.
(context && process.env.AUTHORIZATION_UI_E2E === "true" ? test : test.skip)(
  "connected Settings UI E2E on test-owned databases",
  async () => {
    const frontend = resolve("../FE"),
      port = 18882;
    await new Promise((done, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(port, "127.0.0.1", () => probe.close(done));
    });
    const tsconfigFile = resolve(frontend, ".authz-tsconfig-" + context.suffix + ".json"),
      nextEnvFile = resolve(frontend, "next-env.d.ts");
    const previousNextEnv = await readFile(nextEnvFile, "utf8");
    await writeFile(tsconfigFile, await readFile(resolve(frontend, "tsconfig.json")), {
      flag: "wx",
    });
    const childEnv = {
      ...process.env,
      AUTHORIZATION_E2E_RUN: context.suffix,
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_API_URL: origin + "/api/v1",
      AUTH_PUBLIC_ORIGIN: "http://127.0.0.1:" + port,
      PORT: String(port),
      AUTHZ_E2E_API: origin,
      AUTHZ_E2E_EMAIL: bootstrap.email,
      AUTHZ_E2E_PASSWORD: bootstrap.password,
      AUTHZ_E2E_READER_EMAIL: reader.email,
      AUTHZ_E2E_READER_PASSWORD: password,
      AUTHZ_E2E_EMPTY_EMAIL: empty.email,
      AUTHZ_E2E_TENANT_CODE: A.code,
      AUTHZ_E2E_TENANT_EMAIL: "same-admin@test.invalid",
      AUTHZ_E2E_TENANT_PASSWORD: password,
      E2E_BASE_URL: "http://127.0.0.1:" + port,
    };
    delete childEnv.JEST_WORKER_ID;
    const server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
      { cwd: frontend, env: childEnv, stdio: "ignore" },
    );
    mock.state.delayCreateMs = 3000;
    const { OutboxPublisher } = await import("../../dist/src/saas/outbox.publisher.js");
    let pending = Promise.resolve();
    const poll = setInterval(() => {
      pending = pending.then(() => app.get(OutboxPublisher).tick(broker)).catch(() => {});
    }, 200);
    try {
      await wait(
        async () =>
          fetch(childEnv.E2E_BASE_URL + "/auth/platform-sign-in")
            .then((r) => r.status)
            .catch(() => 0),
        (s) => s === 200,
        90000,
      );
      const code = await new Promise((done, reject) => {
        const c = spawn(
          process.execPath,
          [
            "node_modules/@playwright/test/cli.js",
            "test",
            "tests/integration/authorization-settings.spec.ts",
            "--workers=1",
            "--output=test-results/authorization-" + context.suffix,
          ],
          { cwd: frontend, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
        );
        let output = "";
        c.stdout.on("data", (v) => {
          output += v;
        });
        c.stderr.on("data", (v) => {
          output += v;
        });
        c.once("error", reject);
        c.once("close", (status) => {
          if (status !== 0) {
            const safe = output
              .replaceAll(bootstrap.password, "[REDACTED]")
              .replaceAll(password, "[REDACTED]");
            console.error(safe.slice(-20000));
          } else console.log(output.slice(-2000));
          done(status);
        });
      });
      expect(code).toBe(0);
    } finally {
      clearInterval(poll);
      await pending;
      if (process.platform === "win32" && server.pid)
        spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      else server.kill();
      await unlink(tsconfigFile).catch(() => {});
      const artifactRoot = resolve(frontend, "test-results", "authorization-" + context.suffix);
      if (
        !artifactRoot.startsWith(resolve(frontend, "test-results") + "\\") &&
        process.platform === "win32"
      )
        throw Error("Unsafe artifact path");
      const { readdir } = await import("node:fs/promises");
      const scrubArtifacts = async (dir) => {
        for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const path = resolve(dir, entry.name);
          if (entry.isDirectory()) await scrubArtifacts(path);
          else if (/\.(md|json|txt)$/.test(entry.name)) {
            const text = await readFile(path, "utf8");
            await writeFile(
              path,
              text.replaceAll(bootstrap.password, "[REDACTED]").replaceAll(password, "[REDACTED]"),
            );
          }
        }
      };
      await scrubArtifacts(artifactRoot);
      // Restore only this run's generated route-type import; preserve all other user edits.
      const current = await readFile(nextEnvFile, "utf8");
      const originalImport = previousNextEnv
        .split(/\r?\n/)
        .find((line) => line.includes("/types/routes.d.ts"));
      if (current.includes(".next-authz-e2e-" + context.suffix)) {
        const seen = new Set();
        const restored = current
          .split(/\r?\n/)
          .map((line) =>
            line.includes(".next-authz-e2e-" + context.suffix) ? (originalImport ?? "") : line,
          )
          .filter((line) => {
            if (!line.includes("/types/routes.d.ts")) return true;
            if (seen.has(line)) return false;
            seen.add(line);
            return true;
          })
          .join("\n");
        await writeFile(nextEnvFile, restored);
      }
    }
  },
  600000,
);
