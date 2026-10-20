import "../support/phase2-env.mjs";
import { test, expect, jest, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { ZodPipe } from "../../dist/src/common/validation/zod.pipe.js";
import { createTenantSchema } from "../../dist/src/modules/tenants/dto/create-tenant.dto.js";
import { updateTenantSchema } from "../../dist/src/modules/tenants/dto/update-tenant.dto.js";
import { listTenantsSchema } from "../../dist/src/modules/tenants/dto/list-tenants-query.dto.js";
import { assertTenantTransition } from "../../dist/src/modules/tenants/tenant-lifecycle.js";
import { PlatformAdminGuard } from "../../dist/src/modules/auth/platform-admin.guard.js";
import { TenantsRepository } from "../../dist/src/modules/tenants/tenants.repository.js";
import { TenantsService } from "../../dist/src/modules/tenants/tenants.service.js";
import { env } from "../../dist/src/config/env.js";
import { closeLogger } from "../../dist/logger/index.js";
afterAll(async () => {
  await closeLogger();
});
const create = new ZodPipe(createTenantSchema, "create"),
  update = new ZodPipe(updateTenantSchema, "update"),
  list = new ZodPipe(listTenantsSchema, "query");
test("create normalizes all three identifiers/display fields", () => {
  expect(
    create.transform({ name: " Company A ", code: " company_a ", slug: " Company-A " }),
  ).toEqual({ name: "Company A", code: "COMPANY_A", slug: "company-a" });
});
test.each([
  { name: "", code: "A", slug: "a" },
  { name: "A", code: "bad-code", slug: "a" },
  { name: "A", code: "A", slug: "bad_slug" },
  { name: "A", code: "A", slug: "a", unknown: "x" },
  [],
  null,
])("invalid creation payload rejected", (body) => expect(() => create.transform(body)).toThrow());
test.each([
  "status",
  "id",
  "databaseName",
  "neonBranchId",
  "neonProjectId",
  "schemaVersion",
  "provisioning",
  "code",
  "slug",
])("PATCH forbids %s", (key) => {
  try {
    update.transform({ name: "A", [key]: "ACTIVE" });
    throw new Error("accepted");
  } catch (e) {
    expect(e.status).toBe(403);
  }
});
test("POST cannot set lifecycle", () => {
  try {
    create.transform({ name: "A", code: "A", slug: "a", status: "ACTIVE" });
  } catch (e) {
    expect(e.status).toBe(403);
  }
});
test("pagination defaults and limits", () => {
  expect(list.transform({})).toEqual({ page: 1, limit: 20 });
  expect(
    list.transform({ page: "2", limit: "100", status: "PENDING_PROVISIONING", search: " abc " }),
  ).toMatchObject({ page: 2, limit: 100, search: "abc" });
  for (const q of [
    { limit: "101" },
    { page: "0" },
    { page: "1.5" },
    { page: "999999999999" },
    { status: "UNKNOWN" },
    { limit: ["1", "2"] },
  ])
    expect(() => list.transform(q)).toThrow();
});
test("lifecycle rejects unsupported and premature activation", () => {
  expect(() => assertTenantTransition("PENDING_PROVISIONING", "PROVISIONING")).not.toThrow();
  expect(() => assertTenantTransition("PROVISIONING", "ACTIVE", true)).not.toThrow();
  for (const args of [
    ["PENDING_PROVISIONING", "ACTIVE", true],
    ["PROVISIONING", "ACTIVE", false],
    ["SUSPENDED", "ACTIVE", true],
    ["ACTIVE", "ACTIVE", true],
  ])
    expect(() => assertTenantTransition(...args)).toThrow();
});
const context = (key) => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers: key === undefined ? {} : { "x-platform-admin-key": key } }),
  }),
});
test("admin guard accepts configured key and rejects absent/incorrect/oversized keys", () => {
  const guard = new PlatformAdminGuard();
  expect(guard.canActivate(context(env.PLATFORM_ADMIN_SECRET))).toBe(true);
  for (const key of [undefined, "bad", "x".repeat(1025), ["duplicated"]]) {
    try {
      guard.canActivate(context(key));
      throw new Error("accepted");
    } catch (e) {
      expect(e.status).toBe(401);
    }
  }
});
test("admin guard fails closed without configuration", () => {
  const previous = env.PLATFORM_ADMIN_SECRET;
  env.PLATFORM_ADMIN_SECRET = undefined;
  try {
    expect(() => new PlatformAdminGuard().canActivate(context("anything"))).toThrow(
      "not configured",
    );
  } finally {
    env.PLATFORM_ADMIN_SECRET = previous;
  }
});
test.each(["code", "slug"])("duplicate %s is sanitized as HTTP 409", async (field) => {
  const repository = new TenantsRepository({
    client: async () => {
      throw { code: "P2002", meta: { target: [field] }, message: "secret-value" };
    },
  });
  await expect(repository.create({ name: "A", code: "A", slug: "a" })).rejects.toMatchObject({
    status: 409,
    message: "Tenant code or slug already exists",
  });
});
test.each([
  ["P2025", 404],
  ["P1001", 503],
  ["P2021", 503],
  ["P2022", 503],
  ["P2024", 503],
  ["UNKNOWN", 500],
])("Prisma %s maps to safe status %s", async (code, status) => {
  const repository = new TenantsRepository({
    client: async () => {
      throw { code, message: "postgres://password@private/db" };
    },
  });
  await expect(repository.find(randomUUID())).rejects.toMatchObject({ status });
});
test("service delegates normalized registration; repository inserts pending metadata transactionally", async () => {
  const tenant = {
    id: randomUUID(),
    name: "A",
    code: "A",
    slug: "a",
    status: "PENDING_PROVISIONING",
  };
  const tx = {
    tenant: { create: jest.fn(async () => tenant) },
    tenantProvisioning: { create: jest.fn(async () => ({ status: "PENDING", attemptCount: 0 })) },
  };
  const db = { $transaction: jest.fn(async (fn) => fn(tx)) };
  const repository = new TenantsRepository({ client: async () => db });
  const service = new TenantsService(repository);
  expect(await service.create({ name: "A", code: "A", slug: "a" })).toEqual(tenant);
  expect(db.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.tenantProvisioning.create).toHaveBeenCalledWith(expect.objectContaining({ data: { tenantId: tenant.id } }));
  expect(tx.tenant.create.mock.calls[0][0].data).toEqual({ name: "A", code: "A", slug: "a" });
});
test("list applies filters, deterministic sorting, pagination and a snapshot count", async () => {
  const db = {
    tenant: {
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(3)),
    },
    $transaction: jest.fn(async (values) => Promise.all(values)),
  };
  const repo = new TenantsRepository({ client: async () => db });
  expect(await repo.list({ page: 2, limit: 20, status: "SUSPENDED", search: "abc" })).toEqual({
    items: [],
    page: 2,
    limit: 20,
    total: 3,
  });
  expect(db.tenant.findMany.mock.calls[0][0]).toMatchObject({
    skip: 20,
    take: 20,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { status: "SUSPENDED" },
  });
  expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "RepeatableRead" });
});
test("lookup selects safe fields and unwraps latest provisioning; update whitelists name", async () => {
  const db = {
    tenant: {
      findUniqueOrThrow: jest.fn(async () => ({ id: "id", provisioning: [{ status: "PENDING" }] })),
      update: jest.fn(async () => ({ id: "id", name: "New" })),
    },
  };
  const repo = new TenantsRepository({ client: async () => db });
  expect(await repo.find("id")).toEqual({ id: "id", provisioning: { status: "PENDING" } });
  expect(
    db.tenant.findUniqueOrThrow.mock.calls[0][0].select.provisioning.select,
  ).not.toHaveProperty("lastErrorMessage");
  await repo.update("id", { name: "New", status: "ACTIVE" });
  expect(db.tenant.update.mock.calls[0][0].data).toEqual({ name: "New" });
});
