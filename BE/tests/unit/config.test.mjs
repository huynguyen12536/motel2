import { test, expect } from "@jest/globals";
import { validateEnv } from "../../dist/src/config/env.validation.js";
const base = { RABBITMQ_USER: "test", RABBITMQ_PASSWORD: "test-only", REDIS_PASSWORD: "test-only" };
test("infrastructure startup needs neither Neon nor provisioning nor JWT credentials", () => {
  const e = validateEnv(base);
  expect(e.DATABASE_VERIFY).toBe(false);
  expect(e.MASTER_DATABASE_URL).toBeUndefined();
});
test.each(["RABBITMQ_USER", "RABBITMQ_PASSWORD", "REDIS_PASSWORD"])(
  "required configuration: %s",
  (key) => {
    const input = { ...base };
    delete input[key];
    expect(() => validateEnv(input)).toThrow(key);
  },
);
test.each([
  { APP_PORT: "70000" },
  { DATABASE_VERIFY: "yes" },
  { DATABASE_VERIFY: "true" },
  { MASTER_DATABASE_URL: "postgresql://u:secret@host.neon.tech/db?sslmode=disable" },
  { REDIS_URL: "https://bad" },
  { API_PREFIX: "/invalid" },
])("rejects invalid settings without leaking values: %j", (values) => {
  expect(() => validateEnv({ ...base, ...values })).toThrow("Invalid environment variables");
  try {
    validateEnv({ ...base, ...values });
  } catch (e) {
    expect(e.message).not.toContain("secret");
  }
});

test("platform admin secret accepts random encodings, rejects weak or malformed values", async () => {
  const { randomBytes } = await import("node:crypto");
  for (const value of [randomBytes(32).toString("base64url"), randomBytes(32).toString("hex")])
    expect(validateEnv({ ...base, PLATFORM_ADMIN_SECRET: value }).PLATFORM_ADMIN_SECRET).toBe(
      value,
    );
  for (const value of ["short", "x".repeat(43), "bad key ".repeat(10), "x".repeat(1025)])
    expect(() => validateEnv({ ...base, PLATFORM_ADMIN_SECRET: value })).toThrow(
      "PLATFORM_ADMIN_SECRET",
    );
});
