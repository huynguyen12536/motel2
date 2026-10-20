import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { MasterDatabaseModule } from "../src/infrastructure/database/master/master-database.module.js";
import { MasterPrismaService } from "../src/infrastructure/database/master/master-prisma.service.js";
import { logger, closeLogger } from "../logger/index.js";
const app = await NestFactory.createApplicationContext(MasterDatabaseModule, { logger: false });
try {
  const ok = await app.get(MasterPrismaService).ping();
  logger.info({ ok }, "Master database connectivity check completed");
  if (!ok) process.exitCode = 1;
} catch {
  logger.error("Master database ping failed");
  process.exitCode = 1;
} finally {
  await app.close();
  await closeLogger();
}
