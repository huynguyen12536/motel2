import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SaasModule } from "../saas/saas.module.js";
import { TenantMigrationOrchestrator } from "../saas/migration-orchestrator.js";
import { closeLogger } from "../../logger/index.js";
async function main() {
  const id = process.argv[2];
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    process.argv.length !== 3
  )
    throw new Error("Explicit rollout UUID required");
  const app = await NestFactory.createApplicationContext(SaasModule.register(), { logger: false });
  try {
    console.log(JSON.stringify(await app.get(TenantMigrationOrchestrator).run(id)));
  } finally {
    await app.close();
    await closeLogger();
  }
}
main().catch(() => {
  console.error("Tenant rollout failed; check sanitized operation status");
  process.exitCode = 1;
});
