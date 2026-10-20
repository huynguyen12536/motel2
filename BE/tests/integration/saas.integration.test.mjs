import { test, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import pg from "pg";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { SaasTestResources } from "../../scripts/lib/saas-test-resources.mjs";
const context = process.env.SAAS_TEST_CONTEXT ? JSON.parse(process.env.SAAS_TEST_CONTEXT) : null;
const integration = context ? test : test.skip;
jest.setTimeout(90000);
let app,
  origin,
  master,
  broker,
  publisher,
  operations,
  manager,
  resolver,
  migrations,
  mock,
  resources,
  fixtures;
let A,
  B,
  loginA,
  loginB,
  workerCount = 0;
const children = new Set();
const admin = { "x-platform-admin-key": process.env.PLATFORM_ADMIN_SECRET };
const request = (path, { method = "GET", body, headers = {} } = {}) =>
  fetch(origin + "/api/v1" + path, {
    method,
    headers: { "content-type": "application/json", connection: "close", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function json(path, options) {
  const r = await request(path, options);
  return { status: r.status, body: await r.json() };
}
async function wait(work, predicate, timeout = 40000) {
  const until = Date.now() + timeout;
  let value;
  while (Date.now() < until) {
    value = await work();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Timed out waiting for isolated test state: " + JSON.stringify(value));
}
async function newTenant(label) {
  const suffix = randomUUID().replaceAll("-", "");
  const r = await json("/admin/tenants", {
    method: "POST",
    headers: admin,
    body: { name: "Test " + label, code: "TEST_" + suffix.toUpperCase(), slug: "test-" + suffix },
  });
  expect(r.status).toBe(201);
  return r.body;
}
async function provision(tenant) {
  const r = await json("/admin/tenants/" + tenant.id + "/provision", {
    method: "POST",
    headers: admin,
  });
  expect(r.status).toBe(202);
  return r.body;
}
async function publishAll() {
  for (let i = 0; i < 30; i++) if (!(await publisher.tick(broker))) break;
}
async function active(tenant) {
  return wait(
    () => master.tenant.findUnique({ where: { id: tenant.id } }),
    (t) => t.status === "ACTIVE",
  );
}
async function startWorker() {
  const child = fork("tests/support/saas-worker.mjs", [], {
    env: { ...process.env, SAAS_TEST_CONTEXT: JSON.stringify(context) },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  children.add(child);
  let output = "";
  child.stderr.on("data", (chunk) => {
    output = (output + chunk).slice(-4000);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Worker start timeout")), 20000);
    child.once("message", (message) => {
      clearTimeout(timer);
      message.ready ? resolve() : reject(Error("Worker not ready"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      children.delete(child);
      reject(
        Error("Worker exited " + code + " " + output.replaceAll(context.password, "[REDACTED]")),
      );
    });
  });
  workerCount++;
  return child;
}
async function stopWorker(child, crash = false) {
  if (child.exitCode !== null || child.signalCode !== null) {
    children.delete(child);
    return;
  }
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.once("exit", () => {
      clearTimeout(timer);
      children.delete(child);
      resolve();
    });
    if (crash) child.kill("SIGKILL");
    else child.send({ stop: true });
  });
}
beforeAll(async () => {
  if (!context) return;
  resources = new SaasTestResources(context);
  const { assertTestTarget } = await import("../../scripts/lib/test-owned-postgres.mjs");
  await assertTestTarget(process.env.MASTER_DATABASE_URL, context.ownership);
  fixtures = await import("../support/local-saas-backend.mjs");
  mock = await fixtures.createMockNeon(context, (name) =>
    master.tenantDatabase.findFirst({ where: { databaseName: name } }),
  );
  const [
    { Module },
    { HealthModule },
    { TenantsModule },
    { SaasModule },
    { createApplication },
    { MasterPrismaService },
    { ProvisioningBroker },
    { OutboxPublisher },
    { ProvisioningService },
    { TenantResolver, TenantPrismaManager },
    { TenantMigrationOrchestrator },
  ] = await Promise.all([
    import("@nestjs/common"),
    import("../../dist/src/health/health.module.js"),
    import("../../dist/src/modules/tenants/tenants.module.js"),
    import("../../dist/src/saas/saas.module.js"),
    import("../../dist/src/main.js"),
    import("../../dist/src/infrastructure/database/master/master-prisma.service.js"),
    import("../../dist/src/saas/broker.js"),
    import("../../dist/src/saas/outbox.publisher.js"),
    import("../../dist/src/saas/provisioning.service.js"),
    import("../../dist/src/saas/tenant-routing.js"),
    import("../../dist/src/saas/migration-orchestrator.js"),
  ]);
  broker = new ProvisioningBroker(context.topology, context.rabbit);
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
  app = await createApplication(Root);
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
  master = await app.get(MasterPrismaService).client();
  await (await import("../support/bootstrap-platform.mjs")).bootstrapTestPlatform(master);
  publisher = app.get(OutboxPublisher);
  operations = app.get(ProvisioningService);
  manager = app.get(TenantPrismaManager);
  resolver = app.get(TenantResolver);
  migrations = app.get(TenantMigrationOrchestrator);
  await broker.ready();
}, 30000);
afterAll(async () => {
  if (!context) return;
  for (const child of [...children]) await stopWorker(child);
  await broker?.close();
  await app?.close();
  await mock?.close();
  const { connect } = await import("amqplib");
  const connection = await connect(context.rabbit);
  connection.on("error", () => {});
  try {
    const ch = await connection.createChannel();
    for (const name of [
      context.topology.queue,
      context.topology.dlq,
      context.topology.retry,
      context.topology.retry + ".2",
      context.topology.retry + ".3",
    ]) {
      if (!name.startsWith("motel.test." + context.suffix + "."))
        throw Error("Invalid queue cleanup");
      await ch.deleteQueue(name);
    }
    await ch.deleteExchange(context.topology.exchange);
    await ch.close();
  } finally {
    await connection.close();
  }
}, 30000);

integration(
  "provision API reuses registration's PENDING operation and atomically creates one outbox event",
  async () => {
    A = await newTenant("A");
    const before = await master.tenantProvisioning.findFirst({ where: { tenantId: A.id } });
    const accepted = await provision(A);
    expect(accepted.provisioningId).toBe(before.id);
    expect(await master.outboxEvent.count({ where: { aggregateId: A.id } })).toBe(1);
    const stored = await master.tenant.findUnique({ where: { id: A.id } });
    expect(stored.status).toBe("PROVISIONING");
    const r = await json("/admin/tenants/" + A.id + "/provision", { method: "POST" });
    expect(r.status).toBe(401);
  },
);
integration(
  "simultaneous duplicate requests return the same operation without duplicate resources",
  async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => provision(A)));
    expect(new Set(results.map((r) => r.provisioningId)).size).toBe(1);
    expect(
      await master.tenantProvisioning.count({
        where: { tenantId: A.id, status: { in: ["PENDING", "RUNNING"] } },
      }),
    ).toBe(1);
    expect(await master.outboxEvent.count({ where: { aggregateId: A.id } })).toBe(1);
    expect(mock.state.creationCount).toBe(0);
  },
);
integration("concurrent outbox claimers acquire one lease; expired claims recover", async () => {
  const claims = await Promise.all(Array.from({ length: 8 }, () => publisher.claim()));
  expect(claims.filter(Boolean)).toHaveLength(1);
  const claim = claims.find(Boolean);
  expect(claim.row.status).toBe("PENDING");
  await master.outboxEvent.update({
    where: { id: claim.row.id },
    data: { leaseUntil: new Date(Date.now() - 1000) },
  });
  const second = await publisher.claim();
  expect(second.row.id).toBe(claim.row.id);
  expect(second.token).not.toBe(claim.token);
  await master.outboxEvent.update({
    where: { id: second.row.id },
    data: { leaseUntil: new Date(Date.now() - 1000) },
  });
});
integration(
  "HTTP -> outbox -> RabbitMQ -> standalone Nest worker -> real Prisma tenant migration -> ACTIVE",
  async () => {
    await startWorker();
    await startWorker();
    await publishAll();
    await active(A);
    const mapping = await master.tenantDatabase.findUnique({ where: { tenantId: A.id } });
    expect(mapping.schemaVersion).toBe("20261020000000_tenant_authorization");
    expect(mapping.provisionedAt).not.toBeNull();
    const operation = await master.tenantProvisioning.findFirst({ where: { tenantId: A.id } });
    expect(operation.status).toBe("SUCCEEDED");
    expect(
      (await resources.query(mapping.databaseName, 'SELECT "tenantId" FROM "TenantBootstrap"')).map(
        (x) => x.tenantId,
      ),
    ).toEqual([A.id]);
    expect(await resources.query(mapping.databaseName, 'SELECT email FROM "User"')).toHaveLength(0);
    expect(workerCount).toBe(2);
  },
);
integration("a second tenant provisions without rebuilding or restarting the API", async () => {
  const address = origin;
  B = await newTenant("B");
  await provision(B);
  await publishAll();
  await active(B);
  expect(origin).toBe(address);
  const a = await master.tenantDatabase.findUnique({ where: { tenantId: A.id } }),
    b = await master.tenantDatabase.findUnique({ where: { tenantId: B.id } });
  expect(a.databaseName).not.toBe(b.databaseName);
  expect(a.applicationRole).not.toBe(b.applicationRole);
});
integration("confirmed duplicate delivery after completion is idempotent", async () => {
  const operation = await master.tenantProvisioning.findFirst({ where: { tenantId: A.id } }),
    outbox = await master.outboxEvent.findFirst({ where: { aggregateId: A.id } });
  const created = mock.state.creationCount;
  await broker.publish(outbox.payload);
  await broker.publish(outbox.payload);
  await new Promise((r) => setTimeout(r, 300));
  expect(
    (await master.tenantProvisioning.findUnique({ where: { id: operation.id } })).attemptCount,
  ).toBe(operation.attemptCount);
  expect(mock.state.creationCount).toBe(created);
});
integration(
  "platform-controlled bootstrap is one-time and allows the same email in different tenants",
  async () => {
    for (const tenant of [A, B]) {
      const r = await json("/admin/tenants/" + tenant.id + "/users/bootstrap", {
        method: "POST",
        headers: admin,
        body: { email: "admin@example.test", password: "Secure_" + tenant.code },
      });
      expect(r.status).toBe(201);
      expect(r.body.role).toBe("TENANT_ADMIN");
      expect(r.body.passwordHash).toBeUndefined();
    }
    const again = await json("/admin/tenants/" + A.id + "/users/bootstrap", {
      method: "POST",
      headers: admin,
      body: { email: "other@example.test", password: "a long secure password" },
    });
    expect(again.status).toBe(409);
    expect(
      await master.securityAuditEvent.count({
        where: { tenantId: A.id, action: "ADMIN_BOOTSTRAPPED" },
      }),
    ).toBe(1);
  },
);
integration(
  "tenant login resolves company before credentials and rejects wrong company/password",
  async () => {
    const login = (tenant) =>
      json("/auth/login", {
        method: "POST",
        body: {
          companyCode: tenant.code,
          email: "admin@example.test",
          password: "Secure_" + tenant.code,
        },
      });
    const a = await login(A),
      b = await login(B);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    loginA = a.body;
    loginB = b.body;
    const wrong = await json("/auth/login", {
      method: "POST",
      body: { companyCode: A.code, email: "admin@example.test", password: "Secure_" + B.code },
    });
    expect(wrong.status).toBe(401);
    const unknown = await json("/auth/login", {
      method: "POST",
      body: { companyCode: "UNKNOWN", email: "admin@example.test", password: "Secure_" + B.code },
    });
    expect(unknown.status).toBe(401);
  },
);
integration(
  "forged tenant headers and cross-tenant user IDs cannot change JWT routing",
  async () => {
    const headers = {
      authorization: "Bearer " + loginA.accessToken,
      "x-tenant-id": B.id,
      "x-company-code": B.code,
    };
    const me = await json("/tenant/me?tenantId=" + B.id, { headers });
    expect(me.status).toBe(200);
    expect(me.body.tenantId).toBe(A.id);
    const proof = await json("/tenant/admin/identity", { headers });
    expect(proof.status).toBe(200);
    expect(proof.body.tenantId).toBe(A.id);
    const [h, p, s] = loginA.accessToken.split("."),
      claims = JSON.parse(Buffer.from(p, "base64url"));
    const forged =
      h +
      "." +
      Buffer.from(JSON.stringify({ ...claims, tid: B.id })).toString("base64url") +
      "." +
      s;
    expect(
      (await request("/tenant/me", { headers: { authorization: "Bearer " + forged } })).status,
    ).toBe(401);
    expect((await request("/tenant/me")).status).toBe(401);
  },
);
integration("reusable RBAC denies Tenant User admin policy and platform access", async () => {
  const { hashPassword } = await import("../../dist/src/saas/security.js");
  const passwordHash = await hashPassword("ordinary user password");
  const tenant = await resolver.resolve({ id: A.id });
  await manager.withClient(tenant, (c) =>
    c.user.create({ data: { email: "user@example.test", passwordHash, role: "TENANT_USER" } }),
  );
  const login = await json("/auth/login", {
    method: "POST",
    body: { companyCode: A.code, email: "user@example.test", password: "ordinary user password" },
  });
  expect(login.status).toBe(200);
  const headers = { authorization: "Bearer " + login.body.accessToken };
  expect((await request("/tenant/me", { headers })).status).toBe(200);
  expect((await request("/tenant/admin/identity", { headers })).status).toBe(403);
  expect((await request("/admin/tenants", { headers })).status).toBe(401);
  await manager.withClient(tenant, (c) =>
    c.user.update({ where: { email: "user@example.test" }, data: { status: "DISABLED" } }),
  );
  expect((await request("/tenant/me", { headers })).status).toBe(401);
  expect(
    (
      await request("/auth/login", {
        method: "POST",
        body: {
          companyCode: A.code,
          email: "user@example.test",
          password: "ordinary user password",
        },
      })
    ).status,
  ).toBe(401);
});
integration(
  "refresh rotates atomically, old access is rejected and refresh replay revokes the session",
  async () => {
    const rotated = await json("/auth/refresh", {
      method: "POST",
      body: { companyCode: A.code, refreshToken: loginA.refreshToken },
    });
    expect(rotated.status).toBe(200);
    expect(
      (await request("/tenant/me", { headers: { authorization: "Bearer " + loginA.accessToken } }))
        .status,
    ).toBe(401);
    const replay = await request("/auth/refresh", {
      method: "POST",
      body: { companyCode: A.code, refreshToken: loginA.refreshToken },
    });
    expect(replay.status).toBe(401);
    expect(
      (
        await request("/tenant/me", {
          headers: { authorization: "Bearer " + rotated.body.accessToken },
        })
      ).status,
    ).toBe(401);
  },
);
integration("logout revokes access and refresh immediately", async () => {
  const out = await request("/auth/logout", {
    method: "POST",
    headers: { authorization: "Bearer " + loginB.accessToken },
  });
  expect(out.status).toBe(200);
  expect(
    (await request("/tenant/me", { headers: { authorization: "Bearer " + loginB.accessToken } }))
      .status,
  ).toBe(401);
  expect(
    (
      await request("/auth/refresh", {
        method: "POST",
        body: { companyCode: B.code, refreshToken: loginB.refreshToken },
      })
    ).status,
  ).toBe(401);
});
integration(
  "suspension is authoritative even with Redis unavailable and existing valid JWT",
  async () => {
    const login = await json("/auth/login", {
      method: "POST",
      body: { companyCode: A.code, email: "admin@example.test", password: "Secure_" + A.code },
    });
    expect(login.status).toBe(200);
    await master.tenant.update({
      where: { id: A.id },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    expect(
      (
        await request("/tenant/me", {
          headers: { authorization: "Bearer " + login.body.accessToken },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/auth/login", {
          method: "POST",
          body: { companyCode: A.code, email: "admin@example.test", password: "Secure_" + A.code },
        })
      ).status,
    ).toBe(401);
    await master.tenant.update({
      where: { id: A.id },
      data: { status: "ACTIVE", suspendedAt: null },
    });
  },
);
integration(
  "PostgreSQL application roles cannot connect to another tenant or Master test database",
  async () => {
    const a = await master.tenantDatabase.findUnique({ where: { tenantId: A.id } }),
      b = await master.tenantDatabase.findUnique({ where: { tenantId: B.id } });
    const target = await new fixtures.LocalConnections(context).resolve(a);
    for (const name of [b.databaseName, context.ownership.databases[0]]) {
      const url = new URL(target.url);
      url.pathname = "/" + name;
      const client = new pg.Client({ connectionString: url.toString() });
      try {
        await expect(client.connect()).rejects.toMatchObject({ code: "42501" });
      } finally {
        await client.end().catch(() => {});
      }
    }
  },
);
integration(
  "login rate limiting falls back to PostgreSQL and cannot fail open when Redis is down",
  async () => {
    const { LoginLimiter } = await import("../../dist/src/saas/auth.service.js");
    const limiter = app.get(LoginLimiter);
    for (let n = 0; n < 10; n++)
      await limiter.check("RATE_TEST", "person@example.test", "127.0.0.9");
    await expect(
      limiter.check("RATE_TEST", "person@example.test", "127.0.0.9"),
    ).rejects.toMatchObject({ status: 429 });
  },
);
integration(
  "migration failure is retried through durable RabbitMQ retry queues without duplicate databases",
  async () => {
    const tenant = await newTenant("transient"),
      created = mock.state.creationCount;
    mock.state.migrationFailures = 1;
    await provision(tenant);
    await publishAll();
    await active(tenant);
    const op = await master.tenantProvisioning.findFirst({ where: { tenantId: tenant.id } });
    expect(op.attemptCount).toBe(2);
    expect(mock.state.creationCount - created).toBe(1);
  },
);
integration(
  "permission failure persists; explicit retry preserves history and eventually activates",
  async () => {
    const tenant = await newTenant("permission");
    mock.state.createStatus = 403;
    await provision(tenant);
    await publishAll();
    await wait(
      () => master.tenant.findUnique({ where: { id: tenant.id } }),
      (t) => t.status === "PROVISIONING_FAILED",
    );
    const old = await master.tenantProvisioning.findFirst({ where: { tenantId: tenant.id } });
    expect(old.lastErrorCode).toBe("NEON_PERMISSION_DENIED");
    const safe = await json("/admin/tenants/" + tenant.id + "/provisioning/" + old.id, {
      headers: admin,
    });
    expect(safe.status).toBe(200);
    expect(JSON.stringify(safe.body)).not.toContain("postgresql://");
    const retry = await json("/admin/tenants/" + tenant.id + "/provisioning/retry", {
      method: "POST",
      headers: admin,
    });
    expect(retry.status).toBe(202);
    expect(retry.body.provisioningId).not.toBe(old.id);
    await publishAll();
    await active(tenant);
    expect((await master.tenantProvisioning.findUnique({ where: { id: old.id } })).status).toBe(
      "FAILED",
    );
  },
);
integration(
  "attempt exhaustion never activates; explicit retry reuses the verified database",
  async () => {
    const tenant = await newTenant("exhaustion");
    mock.state.migrationFailures = 3;
    const created = mock.state.creationCount;
    await provision(tenant);
    await publishAll();
    await wait(
      () => master.tenant.findUnique({ where: { id: tenant.id } }),
      (t) => t.status === "PROVISIONING_FAILED",
    );
    const op = await master.tenantProvisioning.findFirst({ where: { tenantId: tenant.id } });
    expect(op.attemptCount).toBe(3);
    expect(op.status).toBe("FAILED");
    expect(
      (await master.tenantDatabase.findUnique({ where: { tenantId: tenant.id } })).provisionedAt,
    ).toBeNull();
    await json("/admin/tenants/" + tenant.id + "/provisioning/retry", {
      method: "POST",
      headers: admin,
    });
    await publishAll();
    await active(tenant);
    expect(mock.state.creationCount - created).toBe(1);
  },
);
integration(
  "consumer process crash before ACK recovers via redelivery and expired lease",
  async () => {
    const tenant = await newTenant("crash"),
      created = mock.state.creationCount;
    mock.state.delayCreateMs = 5000;
    await provision(tenant);
    await publishAll();
    await wait(
      async () => mock.state.creationCount,
      (n) => n > created,
    );
    for (const child of [...children]) await stopWorker(child, true);
    mock.state.delayCreateMs = 0;
    await master.tenantProvisioning.updateMany({
      where: { tenantId: tenant.id, status: "RUNNING" },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    await startWorker();
    await active(tenant);
    expect(mock.state.creationCount - created).toBe(1);
  },
);
integration(
  "reconciliation recovers abandoned published intent and expires exhausted leases",
  async () => {
    const pending = await newTenant("reconcile"),
      accepted = await provision(pending);
    await master.outboxEvent.updateMany({
      where: { aggregateId: pending.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    const count = await operations.reconcile();
    expect(count).toBeGreaterThan(0);
    await publishAll();
    await active(pending);
    const exhausted = await newTenant("expired");
    await provision(exhausted);
    await master.tenantProvisioning.updateMany({
      where: { tenantId: exhausted.id },
      data: {
        status: "RUNNING",
        attemptCount: 3,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() - 1000),
      },
    });
    await operations.reconcile();
    expect((await master.tenant.findUnique({ where: { id: exhausted.id } })).status).toBe(
      "PROVISIONING_FAILED",
    );
    expect(
      (await master.tenantProvisioning.findUnique({ where: { id: accepted.provisioningId } }))
        .status,
    ).toBe("SUCCEEDED");
  },
);
integration("unknown existing resource ownership is never adopted", async () => {
  const tenant = await newTenant("unknown");
  await provision(tenant);
  const mapping = await master.tenantDatabase.findUnique({ where: { tenantId: tenant.id } });
  await resources.createDatabase(
    mapping.databaseName,
    context.ownership.runId + ":" + randomUUID(),
  );
  const created = mock.state.creationCount;
  await publishAll();
  await wait(
    () => master.tenant.findUnique({ where: { id: tenant.id } }),
    (t) => t.status === "PROVISIONING_FAILED",
  );
  expect(mock.state.creationCount).toBe(created);
  expect(
    (await master.tenantDatabase.findUnique({ where: { tenantId: tenant.id } })).provisionedAt,
  ).toBeNull();
});
integration(
  "operator-triggered rollout persists per-tenant results and repeated successful execution is a no-op",
  async () => {
    const rollout = await migrations.create("TEST-APPROVAL", [A.id, B.id]);
    await expect(migrations.create("CONCURRENT-APPROVAL", [A.id])).rejects.toThrow(
      "already has a pending migration",
    );
    const results = await migrations.run(rollout.rolloutId);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "SUCCEEDED")).toBe(true);
    const again = await migrations.run(rollout.rolloutId);
    expect(again.every((r) => r.attemptCount === 1)).toBe(true);
  },
);
integration(
  "outbox insertion failure rolls back tenant status, mapping reservation and operation request",
  async () => {
    const tenant = await newTenant("rollback");
    const { ProvisioningService } = await import("../../dist/src/saas/provisioning.service.js");
    const broken = master.$extends({
      query: {
        outboxEvent: {
          async upsert() {
            throw Error("INJECTED_OUTBOX_FAILURE");
          },
        },
      },
    });
    const service = new ProvisioningService(
      { client: async () => broken },
      fixtures.localPolicy(context),
    );
    await expect(service.request(tenant.id)).rejects.toThrow("INJECTED_OUTBOX_FAILURE");
    expect((await master.tenant.findUnique({ where: { id: tenant.id } })).status).toBe(
      "PENDING_PROVISIONING",
    );
    expect(await master.tenantDatabase.count({ where: { tenantId: tenant.id } })).toBe(0);
    expect(
      (await master.tenantProvisioning.findFirst({ where: { tenantId: tenant.id } })).requestedAt,
    ).toBeNull();
  },
);
integration(
  "activation precondition failure rolls back completion and leaves tenant non-active",
  async () => {
    const tenant = await newTenant("activation-rollback"),
      operation = await provision(tenant);
    const claim = await operations.claim({
      tenantId: tenant.id,
      provisioningId: operation.provisioningId,
    });
    await expect(
      operations.complete(operation.provisioningId, claim.token, "test-version", claim.mapping),
    ).rejects.toThrow("INCOMPLETE_MAPPING");
    expect(
      (await master.tenantProvisioning.findUnique({ where: { id: operation.provisioningId } }))
        .status,
    ).toBe("RUNNING");
    expect((await master.tenant.findUnique({ where: { id: tenant.id } })).status).toBe(
      "PROVISIONING",
    );
    await operations.fail(operation.provisioningId, claim.token, "TEST_PRECONDITION_FAILED", false);
  },
);
integration(
  "expired lease fencing rejects all late progress, failure and completion writes",
  async () => {
    const tenant = await newTenant("lease-fencing"),
      accepted = await provision(tenant);
    const message = { tenantId: tenant.id, provisioningId: accepted.provisioningId };
    const old = await operations.claim(message);
    await master.tenantProvisioning.update({
      where: { id: accepted.provisioningId },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    const fresh = await operations.claim(message);
    expect(fresh.token).not.toBe(old.token);
    expect(await operations.heartbeat(accepted.provisioningId, old.token)).toBe(false);
    await expect(operations.progress(accepted.provisioningId, old.token, "LATE")).rejects.toThrow(
      "LEASE_LOST",
    );
    await expect(
      operations.complete(accepted.provisioningId, old.token, "v", old.mapping),
    ).rejects.toThrow("LEASE_LOST");
    await expect(
      operations.fail(accepted.provisioningId, old.token, "LATE", false),
    ).rejects.toThrow("LEASE_LOST");
    await operations.fail(accepted.provisioningId, fresh.token, "TEST_FENCE_COMPLETE", false);
  },
);
integration(
  "a halfway Prisma migration failure rolls back SQL and never activates or resets the tenant",
  async () => {
    const tenant = await newTenant("halfway"),
      accepted = await provision(tenant);
    const mapping = await master.tenantDatabase.findUnique({ where: { tenantId: tenant.id } });
    await resources.createDatabase(
      mapping.databaseName,
      context.ownership.runId + ":" + mapping.ownershipToken,
    );
    const temp = await mkdtemp(join(tmpdir(), "motel-migration-failure-"));
    try {
      await mkdir(join(temp, "migrations", "20261019000000_tenant_identity"), { recursive: true });
      await mkdir(join(temp, "migrations", "20261019000001_failure"));
      await copyFile(
        "prisma/tenant/migrations/20261019000000_tenant_identity/migration.sql",
        join(temp, "migrations", "20261019000000_tenant_identity", "migration.sql"),
      );
      await copyFile(
        "prisma/tenant/migrations/migration_lock.toml",
        join(temp, "migrations", "migration_lock.toml"),
      );
      await writeFile(
        join(temp, "migrations", "20261019000001_failure", "migration.sql"),
        'BEGIN; CREATE TABLE "HalfwayProbe"(id integer); SELECT 1/0; COMMIT;',
      );
      await writeFile(
        join(temp, "config.mjs"),
        "import {defineConfig} from " +
          JSON.stringify(pathToFileURL(resolve("node_modules/prisma/config.js")).href) +
          "; export default defineConfig({schema:" +
          JSON.stringify(resolve("prisma/tenant/schema.prisma")) +
          ",migrations:{path:" +
          JSON.stringify(join(temp, "migrations")) +
          "},datasource:{url:process.env.TENANT_DIRECT_URL}});",
      );
      const result = spawnSync(
        process.execPath,
        [
          resolve("node_modules/prisma/build/index.js"),
          "migrate",
          "deploy",
          "--config",
          join(temp, "config.mjs"),
        ],
        {
          env: { ...process.env, TENANT_DIRECT_URL: resources.ownerUrl(mapping.databaseName) },
          encoding: "utf8",
        },
      );
      expect(result.status).not.toBe(0);
      expect(
        (
          await resources.query(
            mapping.databaseName,
            "SELECT to_regclass('public.\"HalfwayProbe\"') AS probe",
          )
        )[0].probe,
      ).toBeNull();
      const failed = await resources.query(
        mapping.databaseName,
        "SELECT finished_at FROM _prisma_migrations WHERE migration_name='20261019000001_failure'",
      );
      expect(failed[0].finished_at).toBeNull();
      await publishAll();
      await wait(
        () => master.tenant.findUnique({ where: { id: tenant.id } }),
        (t) => t.status === "PROVISIONING_FAILED",
      );
      expect(
        (await master.tenantProvisioning.findUnique({ where: { id: accepted.provisioningId } }))
          .status,
      ).toBe("FAILED");
    } finally {
      if (
        !resolve(temp).startsWith(resolve(tmpdir()) + sep) ||
        !temp.includes("motel-migration-failure-")
      )
        throw Error("Unsafe cleanup target");
      await rm(temp, { recursive: true, force: true });
    }
  },
);
integration("mapping endpoint corruption fails closed without falling back to Master", async () => {
  const login = await json("/auth/login", {
    method: "POST",
    body: { companyCode: A.code, email: "admin@example.test", password: "Secure_" + A.code },
  });
  expect(login.status).toBe(200);
  const mapping = await master.tenantDatabase.findUnique({ where: { tenantId: A.id } });
  try {
    await master.tenantDatabase.update({
      where: { tenantId: A.id },
      data: { databaseHost: "127.0.0.2" },
    });
    expect(
      (
        await request("/tenant/me", {
          headers: { authorization: "Bearer " + login.body.accessToken },
        })
      ).status,
    ).toBe(503);
  } finally {
    await master.tenantDatabase.update({
      where: { tenantId: A.id },
      data: { databaseHost: mapping.databaseHost },
    });
  }
});
integration(
  "poison messages enter isolated DLQ without secrets, manual requeue is redelivered",
  async () => {
    const channel = await broker.ready();
    let old;
    while ((old = await channel.get(context.topology.dlq, { noAck: false }))) channel.ack(old);
    await broker.publish({
      eventId: randomUUID(),
      schemaVersion: 999,
      password: "never-copy-this",
    });
    const msg = await wait(() => channel.get(context.topology.dlq, { noAck: false }), Boolean);
    const texts = [msg.content.toString()];
    expect(texts[0]).not.toContain("never-copy-this");
    expect(JSON.parse(texts[0]).reason).toBe("INVALID_MESSAGE_SCHEMA");
    expect(msg.properties.deliveryMode).toBe(2);
    channel.nack(msg, false, true);
    const again = await wait(() => channel.get(context.topology.dlq, { noAck: false }), Boolean);
    expect(again.fields.redelivered).toBe(true);
    channel.ack(again);
  },
);
integration(
  "new endpoints and bearer contracts are present in Swagger and API CSP remains restrictive",
  async () => {
    const spec = await (await fetch(origin + "/api/docs-json")).json();
    expect(spec.paths["/api/v1/auth/login"]).toBeDefined();
    expect(spec.paths["/api/v1/admin/tenants/{id}/provision"]).toBeDefined();
    expect(spec.components.securitySchemes.bearer.type).toBe("http");
    expect((await request("/tenant/me")).headers.get("content-security-policy")).toContain(
      "script-src 'none'",
    );
  },
);
integration(
  "publisher reconnects after channel closure and protected metrics contain no secrets",
  async () => {
    const old = await broker.ready();
    await old.close();
    const recovered = await broker.ready();
    expect(recovered).not.toBe(old);
    const event = await master.outboxEvent.findFirst({ where: { aggregateId: A.id } });
    await broker.publish(event.payload);
    expect((await recovered.checkQueue(context.topology.queue)).queue).toBe(context.topology.queue);
    const metrics = await json("/admin/saas/metrics", { headers: admin });
    expect(metrics.status).toBe(200);
    expect(metrics.body.tenantPools.clients).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(metrics.body)).not.toContain("postgresql://");
    expect(JSON.stringify(metrics.body)).not.toContain(context.password);
    expect((await request("/admin/saas/metrics")).status).toBe(401);
  },
);
