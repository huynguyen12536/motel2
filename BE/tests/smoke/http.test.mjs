// Close each test HTTP connection rather than retaining the fetch keep-alive pool.
const fetch = (url) => globalThis.fetch(url, { headers: { connection: "close" } });
import { test, expect, beforeAll, afterAll } from "@jest/globals";
Object.assign(process.env, {
  NODE_ENV: "test",
  PLATFORM_ADMIN_SECRET: "",
  LOG_LEVEL: "silent",
  SWAGGER_ENABLED: "true",
  DATABASE_VERIFY: "false",
  RABBITMQ_HOST: "127.0.0.1",
  RABBITMQ_PORT: "1",
  RABBITMQ_USER: "smoke",
  RABBITMQ_PASSWORD: "test-only",
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: "1",
  REDIS_PASSWORD: "test-only",
  REDIS_URL: "",
  API_PREFIX: "api/v1",
});
let app, origin;
beforeAll(async () => {
  const { createApplication } = await import("../../dist/src/main.js");
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
}, 15000);
afterAll(async () => {
  await app?.close();
});
test("API boots with unavailable external services; live remains 200", async () => {
  const response = await fetch(origin + "/api/v1/health/live");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
test("readiness reports unavailable services without credentials", async () => {
  const response = await fetch(origin + "/api/v1/health/ready");
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.dependencies).toEqual({ rabbitmq: "down", redis: "down", neon: "skipped" });
  expect(JSON.stringify(body)).not.toContain("test-only");
});
test("Swagger UI and OpenAPI expose infrastructure and protected administration", async () => {
  expect((await fetch(origin + "/api/docs/")).status).toBe(200);
  const spec = await (await fetch(origin + "/api/docs-json")).json();
  expect(Object.keys(spec.paths)).toEqual(
    expect.arrayContaining([
      "/api/v1/admin/tenants",
      "/api/v1/admin/tenants/{id}",
      "/api/v1/health/live",
      "/api/v1/health/ready",
      "/api/v1/auth/login",
      "/api/v1/admin/tenants/{id}/provision",
    ]),
  );
});
test.each(["/", "/health", "/api/v1/health"])("legacy route preserved: %s", async (path) => {
  const response = await fetch(origin + path);
  expect([200, 503]).toContain(response.status);
});
test("unknown route returns 404", async () =>
  expect((await fetch(origin + "/missing")).status).toBe(404));

test("malformed authentication JSON returns a safe 400 without echoing the body", async () => {
  const response = await globalThis.fetch(origin + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: '{"password":"never-echo-this",',
  });
  expect(response.status).toBe(400);
  const body = await response.text();
  expect(body).toContain("Invalid request");
  expect(body).not.toContain("never-echo-this");
});

test("admin denies anonymous access before checking policy/key configuration", async () =>
  expect((await fetch(origin + "/api/v1/admin/tenants")).status).toBe(401));
test("Swagger CSP permits local assets and API CSP remains strict", async () => {
  expect((await fetch(origin + "/api/docs/")).headers.get("content-security-policy")).toContain(
    "script-src 'self'",
  );
  expect(
    (await fetch(origin + "/api/v1/health/live")).headers.get("content-security-policy"),
  ).toContain("script-src 'none'");
});
