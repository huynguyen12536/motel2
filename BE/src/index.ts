import { bootstrap } from "./main.js";
import { logger, closeLogger } from "../logger/index.js";
bootstrap().catch(async () => {
  logger.fatal({ event: "startup.failed" }, "API startup failed; check validated configuration");
  await closeLogger();
  process.exit(1);
});
