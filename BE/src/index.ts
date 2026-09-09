import { appConfig } from "./config/app.config.js";
import { logger } from "./config/logger.js";
import { closePool, pingDatabase } from "./database/postgres.js";
import { createApp } from "./infrastructure/http/app.js";

const app = createApp();

async function start(): Promise<void> {
  try {
    const ok = await pingDatabase();
    logger.info({ event: "db.ping", ok }, ok ? "PostgreSQL connected" : "PostgreSQL ping failed");
  } catch (error) {
    logger.error({ err: error, event: "db.ping" }, "PostgreSQL is not reachable");
    process.exit(1);
  }

  const server = app.listen(appConfig.port, () => {
    logger.info(
      { port: appConfig.port, env: appConfig.nodeEnv },
      `${appConfig.name} listening on http://127.0.0.1:${appConfig.port}`,
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await closePool().catch((error) => {
        logger.warn({ err: error }, "Failed to close PostgreSQL pool");
      });
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

start().catch((error) => {
  logger.fatal({ err: error }, "Failed to start API");
  process.exit(1);
});
