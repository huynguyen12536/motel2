import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { SaasTestResources } from "./lib/saas-test-resources.mjs";
let resources;
try {
  resources = await SaasTestResources.create();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    CORS_ORIGINS: process.env.SAAS_TEST_SUITE === "authorization.integration" ? "http://127.0.0.1:18882" : "http://localhost:3000",
    MASTER_DATABASE_URL: resources.masterUrl(),
    MASTER_DIRECT_URL: resources.masterUrl(),
    DATABASE_URL: "",
    DIRECT_URL: "",
    TENANT_DATABASE_URL: "",
    TENANT_DIRECT_URL: "",
    NEON_API_KEY: "",
    NEON_PROJECT_ID: "",
    NEON_BRANCH_ID: "",
    TENANT_PROVISIONING_ENABLED: "false",
    TENANT_ADMIN_BOOTSTRAP_ENABLED: "false",
    TENANT_MIGRATION_ROLLOUT_ENABLED: "false",
    JWT_ACCESS_SECRET: randomBytes(48).toString("base64url"),
    TENANT_CREDENTIAL_KEY: randomBytes(32).toString("base64url"),
    PLATFORM_ADMIN_SECRET: randomBytes(32).toString("base64url"),
    DATABASE_VERIFY: "false",
    POSTGRES_SSL: "false",
    RABBITMQ_USER: "unused",
    RABBITMQ_PASSWORD: "test-only",
    REDIS_PASSWORD: "test-only",
    RABBITMQ_HOST: "127.0.0.1",
    RABBITMQ_PORT: "1",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "1",
    REDIS_URL: "",
    TENANT_PROVISIONING_RETRY_MS: "200",
    TENANT_PROVISIONING_LEASE_MS: "10000",
    TENANT_CLIENT_IDLE_MS: "1000",
    SAAS_TEST_CONTEXT: JSON.stringify(resources.context),
  };
  function run(args) {
    const r = spawnSync(process.execPath, args, { env, stdio: "inherit" });
    if (r.status !== 0) throw Error("Isolated SaaS test command failed");
  }
  run(["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma.config.ts"]);
  run([
    "--experimental-vm-modules",
    "node_modules/jest/bin/jest.js",
    process.env.SAAS_TEST_SUITE === "authorization.integration"
      ? "--testPathPatterns=authorization.integration"
      : "--testPathPatterns=saas.integration",
    "--runInBand",
  ]);
  console.log(
    "PASS: local Master/tenant migrations, mock Neon, RabbitMQ, worker and tenant authentication/isolation",
  );
} catch {
  console.error("SaaS integration run failed; see sanitized test assertions");
  process.exitCode = 1;
} finally {
  if (resources) {
    try {
      await resources.cleanup();
      console.log(
        "Cleanup: only run-owned databases/roles removed; existing containers and volumes retained",
      );
    } catch {
      console.error("Owned resource cleanup failed; manual ownership review required");
      process.exitCode = 1;
    }
  }
}
