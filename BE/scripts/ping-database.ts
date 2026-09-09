import { logger } from "../src/config/logger.js";
import { closePool, pingDatabase } from "../src/database/postgres.js";

const ok = await pingDatabase();
logger.info({ ok }, ok ? "PostgreSQL ping succeeded" : "PostgreSQL ping failed");
await closePool();
process.exit(ok ? 0 : 1);
