import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ProvisioningWorkerModule, WorkerRuntime } from "./provisioning.module.js";
import { logger, closeLogger } from "../../logger/index.js";
import { env } from "../config/env.js";
import { assertLiveAuthorization } from "../saas/policy.js";
import { credential } from "../saas/security.js";
async function main() {
  if (env.TENANT_PROVISIONING_ENABLED) {
    assertLiveAuthorization();
    if (
      !env.NEON_API_KEY ||
      !env.NEON_PROVISIONING_DIRECT_URL ||
      !env.TENANT_ALLOWED_DATABASE_HOSTS
    )
      throw new Error("Worker configuration incomplete");
    credential(
      "00000000-0000-4000-8000-000000000000",
      env.NEON_PROJECT_ID!,
      env.NEON_BRANCH_ID!,
      env.TENANT_CREDENTIAL_VERSION,
    );
  }
  const app = await NestFactory.createApplicationContext(ProvisioningWorkerModule, {
    logger: false,
  });
  app.enableShutdownHooks();
  app.get(WorkerRuntime).start();
  logger.info({ event: "worker.started" }, "Provisioning worker started");
}
main().catch(async () => {
  logger.fatal({ event: "worker.startup_failed" }, "Worker configuration or startup failed");
  await closeLogger();
  process.exitCode = 1;
});
