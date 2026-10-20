import { test, expect, beforeAll } from "@jest/globals";
process.env.RABBITMQ_USER = "test";
process.env.RABBITMQ_PASSWORD = "test-only";
process.env.REDIS_PASSWORD = "test-only";
process.env.DATABASE_VERIFY = "false";
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
let HealthController, closeLogger;
beforeAll(async () => {
  ({ HealthController } = await import("../../dist/src/health/health.controller.js"));
  ({ closeLogger } = await import("../../dist/logger/index.js"));
});
test("live does not depend on infrastructure", () =>
  expect(new HealthController({ healthy: false }, { check: async () => false }).live()).toEqual({
    status: "ok",
  }));
test("ready returns 200 payload when required services are available", async () => {
  expect(
    await new HealthController({ healthy: true }, { check: async () => true }).ready(),
  ).toEqual({ status: "ok", dependencies: { rabbitmq: "up", redis: "up", neon: "skipped" } });
});
test("ready returns 503 for a failed dependency", async () => {
  await expect(
    new HealthController({ healthy: false }, { check: async () => true }).ready(),
  ).rejects.toMatchObject({ status: 503 });
});
const { afterAll } = await import("@jest/globals");
afterAll(async () => {
  await closeLogger();
});
