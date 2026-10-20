import { test, expect, beforeAll, beforeEach, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { assertTestTarget } from "../../scripts/lib/test-owned-postgres.mjs";

// This suite never reads .env for a target and runs only through the owned-container runner.
const owned = process.env.MASTER_TEST_OWNERSHIP;
const integration = owned ? test : test.skip;
let app, db, repo, origin, adminKey;
const request = (path, options = {}) =>
  fetch(origin + path, {
    ...options,
    headers: {
      "content-type": "application/json",
      connection: "close",
      "x-platform-admin-key": adminKey,
      ...options.headers,
    },
  });
const input = () => {
  const id = randomUUID().replaceAll("-", "");
  return { name: "Company " + id, code: "COMPANY_" + id.toUpperCase(), slug: "company-" + id };
};
const createBare = async () => db.tenant.create({ data: input() });
beforeAll(async () => {
  if (!owned) return;
  const ownership = JSON.parse(owned),
    url = process.env.MASTER_TEST_DATABASE_URL;
  if (!url || process.env.MASTER_DATABASE_URL !== url || process.env.DATABASE_URL !== "")
    throw new Error("No explicit isolated Master test target");
  await assertTestTarget(url, ownership);
  const { createApplication } = await import("../../dist/src/main.js");
  const { MasterPrismaService } =
    await import("../../dist/src/infrastructure/database/master/master-prisma.service.js");
  const { TenantsRepository } =
    await import("../../dist/src/modules/tenants/tenants.repository.js");
  adminKey = process.env.PLATFORM_ADMIN_SECRET;
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
  db = await app.get(MasterPrismaService).client();
  await (await import("../support/bootstrap-platform.mjs")).bootstrapTestPlatform(db);
  repo = app.get(TenantsRepository);
}, 20000);
beforeEach(async () => {
  if (owned) await assertTestTarget(process.env.MASTER_TEST_DATABASE_URL, JSON.parse(owned));
});
afterAll(async () => {
  await app?.close();
}, 15000);

integration(
  "registers pending tenant and pending metadata atomically; no mapping or outbox",
  async () => {
    const r = await request("/api/v1/admin/tenants", {
      method: "POST",
      body: JSON.stringify({ name: " Company A ", code: " company_a ", slug: " Company-A " }),
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body).toMatchObject({
      name: "Company A",
      code: "COMPANY_A",
      slug: "company-a",
      status: "PENDING_PROVISIONING",
    });
    const records = await db.tenantProvisioning.findMany({ where: { tenantId: body.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "PENDING",
      attemptCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    expect(await db.tenantDatabase.count()).toBe(0);
    expect(await db.outboxEvent.count()).toBe(0);
  },
);
integration.each(["code", "slug"])("HTTP duplicate normalized %s returns 409", async (field) => {
  const base = input();
  await repo.create(base);
  const next = { ...input(), [field]: base[field].toLowerCase() };
  const r = await request("/api/v1/admin/tenants", { method: "POST", body: JSON.stringify(next) });
  expect(r.status).toBe(409);
});
integration(
  "concurrent tenant registration allows one winner with consistent provisioning",
  async () => {
    const body = input();
    const results = await Promise.allSettled([
      repo.create(body),
      repo.create({ ...body, slug: body.slug + "x" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected").reason.status).toBe(409);
    const rows = await db.tenant.findMany({
      where: { code: body.code },
      include: { provisioning: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].provisioning).toHaveLength(1);
  },
);
integration("Prisma transaction rolls back tenant when provisioning CHECK fails", async () => {
  const data = input();
  await expect(
    db.$transaction(async (tx) => {
      const t = await tx.tenant.create({ data });
      await tx.tenantProvisioning.create({ data: { tenantId: t.id, attemptCount: -1 } });
    }),
  ).rejects.toThrow();
  expect(await db.tenant.findUnique({ where: { code: data.code } })).toBeNull();
});
integration.each([
  ["PENDING", "PENDING"],
  ["RUNNING", "RUNNING"],
  ["PENDING", "RUNNING"],
])("PostgreSQL rejects concurrent %s / %s active provisioning", async (a, b) => {
  const t = await createBare();
  const outcomes = await Promise.allSettled([
    db.tenantProvisioning.create({ data: { tenantId: t.id, status: a } }),
    db.tenantProvisioning.create({ data: { tenantId: t.id, status: b } }),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.find((r) => r.status === "rejected").reason.code).toBe("P2002");
  expect(
    await db.tenantProvisioning.count({
      where: { tenantId: t.id, status: { in: ["PENDING", "RUNNING"] } },
    }),
  ).toBe(1);
});
integration(
  "terminal history is retained while a new operation and other tenants are allowed",
  async () => {
    const a = await createBare(),
      b = await createBare();
    await db.tenantProvisioning.createMany({
      data: [
        { tenantId: a.id, status: "FAILED", attemptCount: 3 },
        { tenantId: a.id, status: "SUCCEEDED", attemptCount: 1 },
      ],
    });
    await db.tenantProvisioning.create({ data: { tenantId: a.id, status: "PENDING" } });
    await db.tenantProvisioning.create({ data: { tenantId: b.id, status: "RUNNING" } });
    expect(await db.tenantProvisioning.count({ where: { tenantId: a.id } })).toBe(3);
  },
);
integration("negative provisioning/outbox counters are rejected by PostgreSQL", async () => {
  const t = await createBare();
  await expect(
    db.tenantProvisioning.create({ data: { tenantId: t.id, attemptCount: -1 } }),
  ).rejects.toThrow();
  await expect(
    db.outboxEvent.create({
      data: { eventType: "constraint-test", aggregateId: t.id, payload: {}, attemptCount: -1 },
    }),
  ).rejects.toThrow();
});
integration("foreign keys reject missing tenants and restrict deletion", async () => {
  await expect(
    db.tenantDatabase.create({ data: { tenantId: randomUUID() } }),
  ).rejects.toMatchObject({ code: "P2003" });
  await expect(
    db.tenantProvisioning.create({ data: { tenantId: randomUUID() } }),
  ).rejects.toMatchObject({ code: "P2003" });
  const a = await createBare();
  await db.tenantDatabase.create({ data: { tenantId: a.id } });
  await expect(db.tenant.delete({ where: { id: a.id } })).rejects.toMatchObject({ code: "P2003" });
  const b = await createBare();
  await db.tenantProvisioning.create({ data: { tenantId: b.id } });
  await expect(db.tenant.delete({ where: { id: b.id } })).rejects.toMatchObject({ code: "P2003" });
});
integration("nullable identities coexist but each tenant has only one mapping", async () => {
  const a = await createBare(),
    b = await createBare();
  await db.tenantDatabase.create({ data: { tenantId: a.id } });
  await db.tenantDatabase.create({ data: { tenantId: b.id } });
  await expect(db.tenantDatabase.create({ data: { tenantId: a.id } })).rejects.toMatchObject({
    code: "P2002",
  });
});
integration(
  "complete Neon database name identity is unique before and after provisioning",
  async () => {
    const suffix = randomUUID(),
      identity = {
        provider: "neon",
        neonProjectId: "project-" + suffix,
        neonBranchId: "branch-" + suffix,
        databaseName: "database",
      };
    const a = await createBare(),
      b = await createBare(),
      c = await createBare();
    await db.tenantDatabase.create({ data: { tenantId: a.id, ...identity } });
    await expect(
      db.tenantDatabase.create({ data: { tenantId: b.id, ...identity } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.tenantDatabase.create({
        data: { tenantId: b.id, ...identity, provisionedAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await db.tenantDatabase.create({
      data: {
        tenantId: b.id,
        ...identity,
        neonBranchId: "other-branch",
        provisionedAt: new Date(),
      },
    });
    await db.tenantDatabase.create({
      data: {
        tenantId: c.id,
        ...identity,
        neonProjectId: "other-project",
        provisionedAt: new Date(),
      },
    });
  },
);
integration(
  "database IDs are unique only within provider/project/branch; names preserve case",
  async () => {
    const s = randomUUID(),
      identity = {
        neonProjectId: "project-" + s,
        neonBranchId: "branch-" + s,
        neonDatabaseId: "database-id",
        databaseName: "CaseSensitive",
      };
    const a = await createBare(),
      b = await createBare(),
      c = await createBare();
    await db.tenantDatabase.create({ data: { tenantId: a.id, ...identity } });
    await expect(
      db.tenantDatabase.create({
        data: { tenantId: b.id, ...identity, databaseName: "DifferentName" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await db.tenantDatabase.create({
      data: { tenantId: b.id, ...identity, neonBranchId: "other-" + s },
    });
    await db.tenantDatabase.create({
      data: { tenantId: c.id, ...identity, neonDatabaseId: null, databaseName: "casesensitive" },
    });
  },
);
integration.each([
  {},
  { provider: "other", neonProjectId: "p", neonBranchId: "b", databaseName: "d" },
  { neonBranchId: "b", databaseName: "d" },
  { neonProjectId: "p", databaseName: "d" },
  { neonProjectId: "p", neonBranchId: "b" },
  { neonProjectId: "", neonBranchId: "b", databaseName: "d" },
  { neonProjectId: " p", neonBranchId: "b", databaseName: "d" },
  { neonProjectId: "p", neonBranchId: "b ", databaseName: "d" },
  { neonProjectId: "p", neonBranchId: "b", databaseName: " d" },
  { neonProjectId: "p", neonBranchId: "b", databaseName: "d", neonDatabaseId: " " },
])("provisioned mapping requires complete canonical Neon identity: %j", async (identity) => {
  const t = await createBare();
  await expect(
    db.tenantDatabase.create({ data: { tenantId: t.id, ...identity, provisionedAt: new Date() } }),
  ).rejects.toThrow();
});
integration(
  "NULL uniqueness permits partially known identities; full identities collide",
  async () => {
    const p = "project-" + randomUUID();
    const a = await createBare(),
      b = await createBare();
    await db.tenantDatabase.create({
      data: { tenantId: a.id, neonProjectId: p, databaseName: "same" },
    });
    await db.tenantDatabase.create({
      data: { tenantId: b.id, neonProjectId: p, databaseName: "same" },
    });
  },
);
integration(
  "HTTP lookup/update/list honor safe projections and stable query contracts",
  async () => {
    const body = await repo.create(input());
    const detail = await (await request("/api/v1/admin/tenants/" + body.id)).json();
    expect(detail.database).toBeNull();
    expect(detail.provisioning.status).toBe("PENDING");
    expect(detail.provisioning).not.toHaveProperty("lastErrorMessage");
    const patch = await request("/api/v1/admin/tenants/" + body.id, {
      method: "PATCH",
      body: JSON.stringify({ name: " Updated Name " }),
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).name).toBe("Updated Name");
    const page = await request(
      "/api/v1/admin/tenants?page=1&limit=1&status=PENDING_PROVISIONING&search=" + body.code,
    );
    expect(await page.json()).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      items: [{ id: body.id }],
    });
    const safe = await request("/api/v1/admin/tenants/" + body.id);
    expect(JSON.stringify(await safe.json())).not.toMatch(/password|postgresql:\/\//i);
  },
);
integration("latest provisioning is returned without raw error fields", async () => {
  const t = await createBare();
  await db.tenantProvisioning.create({
    data: {
      tenantId: t.id,
      status: "FAILED",
      createdAt: new Date("2020-01-01"),
      lastErrorCode: "TEST_FAILURE",
      lastErrorMessage: "synthetic test detail",
    },
  });
  await db.tenantProvisioning.create({ data: { tenantId: t.id, status: "PENDING" } });
  const detail = await repo.find(t.id);
  expect(detail.provisioning.status).toBe("PENDING");
  expect(detail.provisioning).not.toHaveProperty("lastErrorCode");
});
integration("HTTP security rejects unauthenticated requests and prohibited mutation", async () => {
  const body = await repo.create(input());
  for (const method of ["GET", "POST", "PATCH"]) {
    const path = "/api/v1/admin/tenants" + (method === "PATCH" ? "/" + body.id : "");
    const r = await request(path, {
      method,
      headers: { "x-platform-admin-key": "incorrect" },
      ...(method === "GET" ? {} : { body: JSON.stringify({ name: "A" }) }),
    });
    expect(r.status).toBe(401);
  }
  for (const field of [
    "status",
    "id",
    "code",
    "slug",
    "neonProjectId",
    "neonBranchId",
    "databaseName",
    "schemaVersion",
    "provisioning",
  ]) {
    const r = await request("/api/v1/admin/tenants/" + body.id, {
      method: "PATCH",
      body: JSON.stringify({ name: "A", [field]: "ACTIVE" }),
    });
    expect(r.status).toBe(403);
  }
  expect(
    (
      await request("/api/v1/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ ...input(), status: "ACTIVE" }),
      })
    ).status,
  ).toBe(403);
  const unchanged = await repo.find(body.id);
  expect(unchanged.status).toBe("PENDING_PROVISIONING");
});
integration("HTTP validation and not found responses are meaningful", async () => {
  expect(
    (
      await request("/api/v1/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ name: " ", code: "bad code", slug: "bad_slug" }),
      })
    ).status,
  ).toBe(400);
  expect((await request("/api/v1/admin/tenants?limit=101")).status).toBe(400);
  expect((await request("/api/v1/admin/tenants/not-a-uuid")).status).toBe(400);
  expect((await request("/api/v1/admin/tenants/" + randomUUID())).status).toBe(404);
  expect(
    (
      await request("/api/v1/admin/tenants/" + randomUUID(), {
        method: "PATCH",
        body: JSON.stringify({ name: "Name" }),
      })
    ).status,
  ).toBe(404);
});
integration("Swagger includes secured contracts and browser-safe CSP", async () => {
  const r = await request("/api/docs/");
  expect(r.status).toBe(200);
  expect(r.headers.get("content-security-policy")).toContain("script-src 'self'");
  const spec = await (await request("/api/docs-json")).json();
  expect(spec.paths["/api/v1/admin/tenants"].post.security).toEqual([
    { bearer: [] },
    { "platform-admin": [] },
  ]);
  expect(spec.paths["/api/v1/admin/tenants"].post["x-required-permissions"]).toEqual([
    "platform.tenants:create",
  ]);
  expect(spec.components.securitySchemes["platform-admin"].name).toBe("X-Platform-Admin-Key");
  expect(spec.paths["/api/v1/admin/tenants"].post.tags).toContain("Tenant Administration");
  const encoded = JSON.stringify(spec);
  expect(encoded).not.toContain(adminKey);
});
integration(
  "there are no provisioning network publishers or Neon clients in the registration path",
  async () => {
    for (const file of ["tenants.controller.ts", "tenants.service.ts", "tenants.repository.ts"]) {
      const source = await readFile("src/modules/tenants/" + file, "utf8");
      expect(source).not.toMatch(/amqplib|rabbitmq|neon\.tech|api\.neon|fetch\(/i);
    }
    expect(await db.outboxEvent.count()).toBe(0);
  },
);

integration.each([
  { neonProjectId: "\t", neonBranchId: "b", databaseName: "d" },
  { neonProjectId: "p", neonBranchId: "b\n", databaseName: "d" },
  { neonProjectId: "p", neonBranchId: "b", databaseName: "\nd" },
])("provisioned identity rejects non-space boundary whitespace: %j", async (identity) => {
  const t = await createBare();
  await expect(
    db.tenantDatabase.create({ data: { tenantId: t.id, ...identity, provisionedAt: new Date() } }),
  ).rejects.toThrow();
});
