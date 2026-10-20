import "../support/phase2-env.mjs";
import { test, expect } from "@jest/globals";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
Object.assign(process.env, {
  JWT_ACCESS_SECRET: randomBytes(48).toString("base64url"),
  TENANT_CREDENTIAL_KEY: randomBytes(32).toString("base64url"),
});
const security = await import("../../dist/src/saas/security.js");
const { env } = await import("../../dist/src/config/env.js");
const { validateEnv } = await import("../../dist/src/config/env.validation.js");
const { validateTenantTarget } = await import("../../dist/src/saas/tenant-migrator.js");
const { provisioningMessage } = await import("../../dist/src/saas/provisioning.service.js");
const base = () => ({
  sub: randomUUID(),
  tid: randomUUID(),
  sid: randomUUID(),
  sv: 1,
  jti: randomUUID(),
});
test("tenant database names are deterministic, UUID-derived and collision resistant", () => {
  const id = randomUUID();
  expect(security.databaseName(id)).toBe(security.databaseName(id));
  expect(security.databaseName(id)).not.toBe(security.databaseName(randomUUID()));
  expect(security.databaseName(id)).toMatch(/^tenant_[a-f0-9]{32}$/);
  expect(() => security.databaseName("'; DROP DATABASE motel")).toThrow();
  expect(() => security.identifier("unsafe-name")).toThrow();
});
test("credential derivation is scoped by tenant, project, branch and version", () => {
  const id = randomUUID(),
    a = security.credential(id, "p", "b", "v1");
  expect(a).toBe(security.credential(id, "p", "b", "v1"));
  for (const [t, p, b] of [
    [randomUUID(), "p", "b"],
    [id, "other", "b"],
    [id, "p", "other"],
  ])
    expect(a).not.toBe(security.credential(t, p, b, "v1"));
  expect(() => security.credential(id, "p", "b", "v2")).toThrow("CREDENTIAL_PROVIDER_UNAVAILABLE");
});
test("scrypt hashes use independent salts; wrong/malformed passwords fail safely", async () => {
  const password = "secure user supplied password";
  const a = await security.hashPassword(password),
    b = await security.hashPassword(password);
  expect(a).not.toBe(b);
  expect(a).not.toContain(password);
  expect(await security.verifyPassword(password, a)).toBe(true);
  expect(await security.verifyPassword("wrong", a)).toBe(false);
  expect(await security.verifyPassword(password, "scrypt$v1$unbounded$cost")).toBe(false);
});
test("JWT verification pins HS256, issuer, audience, expiry, session and tenant identity", () => {
  const input = base(),
    signed = security.signAccess(input);
  expect(security.verifyAccess(signed)).toMatchObject(input);
  const [h, p] = signed.split(".");
  expect(() => security.verifyAccess(h + "." + p + ".invalid")).toThrow("Invalid access token");
  const claims = JSON.parse(Buffer.from(p, "base64url"));
  for (const patch of [
    { iss: "evil" },
    { aud: "other" },
    { exp: 1 },
    { tid: "not-a-uuid" },
    { sv: 0 },
    { iat: claims.iat + 3600 },
  ]) {
    const payload = Buffer.from(JSON.stringify({ ...claims, ...patch })).toString("base64url");
    const sig = createHmac("sha256", env.JWT_ACCESS_SECRET)
      .update(h + "." + payload)
      .digest("base64url");
    expect(() => security.verifyAccess(h + "." + payload + "." + sig)).toThrow(
      "Invalid access token",
    );
  }
  const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  expect(() => security.verifyAccess(none + "." + p + ".")).toThrow();
});
test.each([
  "postgresql://u:p@other.neon.tech/tenant_abc?sslmode=require",
  "postgresql://u:p@ep-one-pooler.neon.tech/tenant_abc?sslmode=require",
  "postgresql://u:p@ep-one.neon.tech/master?sslmode=require",
  "postgresql://u:p@ep-one.neon.tech/tenant_abc?sslmode=disable",
  "postgresql://u:p@ep-one.neon.tech/tenant_abc?sslmode=require&sslrootcert=evil",
])("migration runner rejects an unverified target: %s", (url) => {
  expect(() =>
    validateTenantTarget(url, { host: "ep-one.neon.tech", port: 5432, name: "tenant_abc" }),
  ).toThrow("MIGRATION_TARGET_REJECTED");
});
test("message schema forbids unknown versions and sensitive/extra payload fields", () => {
  const message = {
    eventId: randomUUID(),
    eventType: "tenant.provision.requested",
    schemaVersion: 1,
    tenantId: randomUUID(),
    provisioningId: randomUUID(),
    correlationId: randomUUID(),
  };
  expect(provisioningMessage.safeParse(message).success).toBe(true);
  expect(provisioningMessage.safeParse({ ...message, schemaVersion: 2 }).success).toBe(false);
  expect(provisioningMessage.safeParse({ ...message, password: "secret" }).success).toBe(false);
});
test("feature defaults disable provisioning, bootstrap and rollout", () => {
  const v = validateEnv({ RABBITMQ_USER: "x", RABBITMQ_PASSWORD: "x", REDIS_PASSWORD: "x" });
  expect([
    v.TENANT_PROVISIONING_ENABLED,
    v.TENANT_ADMIN_BOOTSTRAP_ENABLED,
    v.TENANT_MIGRATION_ROLLOUT_ENABLED,
  ]).toEqual([false, false, false]);
});
test("enabling one flag cannot bypass Master/project/branch authorization", () => {
  expect(() =>
    validateEnv({
      RABBITMQ_USER: "x",
      RABBITMQ_PASSWORD: "x",
      REDIS_PASSWORD: "x",
      TENANT_PROVISIONING_ENABLED: "true",
    }),
  ).toThrow("TENANT_PROVISIONING_ENABLED");
});
test("versioned credential keyring supports rotation without silently using the wrong key", () => {
  const previous = env.TENANT_CREDENTIAL_KEYS;
  try {
    env.TENANT_CREDENTIAL_KEYS = JSON.stringify({
      v1: randomBytes(32).toString("base64url"),
      v2: randomBytes(32).toString("base64url"),
    });
    const id = randomUUID();
    expect(security.credential(id, "p", "b", "v1")).not.toBe(
      security.credential(id, "p", "b", "v2"),
    );
    expect(() => security.credential(id, "p", "b", "missing")).toThrow(
      "CREDENTIAL_PROVIDER_UNAVAILABLE",
    );
  } finally {
    env.TENANT_CREDENTIAL_KEYS = previous;
  }
});
