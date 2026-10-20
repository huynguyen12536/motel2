import "../support/phase2-env.mjs";
import { test, expect } from "@jest/globals";
import { randomUUID, randomBytes } from "node:crypto";
const { createEnforcer, casbinModel } =
  await import("../../dist/src/modules/authorization/casbin.factory.js");
const { newModel, newEnforcer } = await import("casbin");
const { catalog, scopeCatalog } = await import("../../dist/src/modules/authorization/catalog.js");
const { env } = await import("../../dist/src/config/env.js");
env.PLATFORM_JWT_SECRET = randomBytes(48).toString("base64url");
const { signPlatformAccess, verifyPlatformAccess } =
  await import("../../dist/src/modules/authorization/platform-auth.service.js");
const { verifyAccess } = await import("../../dist/src/saas/security.js");
test("exact Casbin resource/action matching defaults deny; domain cannot be overridden", async () => {
  const e = await createEnforcer({
    domain: "platform",
    roles: [{ id: "r", permissions: [{ permissionCode: "platform.tenants:read" }] }],
    assignments: [{ userId: "u", roleId: "r" }],
  });
  expect(await e.enforce("user:u", "platform", "platform.tenants", "read")).toBe(true);
  for (const args of [
    ["user:u", "platform", "platform.tenants", "create"],
    ["user:u", "tenant:" + randomUUID(), "platform.tenants", "read"],
    ["user:unknown", "platform", "platform.tenants", "read"],
    ["user:u", "platform", "platform.tenants/1", "read"],
  ])
    expect(await e.enforce(...args)).toBe(false);
});
test("Casbin supports domain-bound inheritance without subject or URL wildcards", async () => {
  const e = await newEnforcer(newModel(casbinModel));
  await e.addPolicy("role:reader", "platform", "platform.tenants", "read");
  await e.addGroupingPolicy("role:supervisor", "role:reader", "platform");
  await e.addGroupingPolicy("user:alice", "role:supervisor", "platform");
  expect(await e.enforce("user:alice", "platform", "platform.tenants", "read")).toBe(true);
  expect(await e.enforce("user:alice", "tenant:x", "platform.tenants", "read")).toBe(false);
  await e.removeGroupingPolicy("user:alice", "role:supervisor", "platform");
  expect(await e.enforce("user:alice", "platform", "platform.tenants", "read")).toBe(false);
});
test("empty persisted policy and absent assignments never grant access", async () => {
  const e = await createEnforcer({ domain: "platform", roles: [], assignments: [] });
  expect(await e.enforce("user:admin", "platform", "platform.roles", "manage")).toBe(false);
});
test("permission catalog has unique exact codes and separate system scopes", () => {
  expect(new Set(catalog.map(([c]) => c)).size).toBe(catalog.length);
  expect(catalog.every(([c]) => /^(platform|tenant)\.[a-z]+:[a-z]+$/.test(c))).toBe(true);
  expect(scopeCatalog("tenant").every(([c]) => !c.startsWith("platform."))).toBe(true);
});
test("platform JWT has separate subject/audience/scope; tenant verifier cannot accept it", () => {
  const id = randomUUID(),
    sid = randomUUID(),
    value = signPlatformAccess(id, sid, 1);
  expect(verifyPlatformAccess(value)).toMatchObject({
    sub: id,
    sid,
    scope: "platform",
    aud: "motel-platform",
  });
  expect(() => verifyAccess(value)).toThrow();
  expect(() => verifyPlatformAccess(value.slice(0, -3) + "bad")).toThrow();
});
