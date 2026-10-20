import pino from "pino";
import { finished } from "node:stream/promises";
import { appConfig } from "../src/config/app.config.js";
import { env } from "../src/config/env.js";
import { RotatingFileStream } from "./rotating-file-stream.js";

const fileStream = new RotatingFileStream(env.LOG_DIR, env.LOG_MAX_SIZE_MB * 1024 * 1024);
const consoleStream =
  appConfig.isProduction || appConfig.isTest
    ? pino.destination(1)
    : pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      });

export const logger = pino(
  {
    name: appConfig.name,
    level: appConfig.logLevel,
    redact: {
      paths: [
        "PLATFORM_ADMIN_SECRET",
        "PLATFORM_JWT_SECRET",
        "PLATFORM_BOOTSTRAP_PASSWORD",
        "AUTHZ_INIT_DATABASE_URL",
        "*.PLATFORM_JWT_SECRET",
        "*.PLATFORM_BOOTSTRAP_PASSWORD",
        "*.AUTHZ_INIT_DATABASE_URL",
        "NEON_API_KEY",
        "TENANT_CREDENTIAL_KEY",
        "TENANT_CREDENTIAL_KEYS",
        "JWT_ACCESS_SECRET",
        "JWT_REFRESH_SECRET",
        "MASTER_DATABASE_URL",
        "MASTER_DIRECT_URL",
        "NEON_PROVISIONING_DIRECT_URL",
        "connectionString",
        "*.connectionString",
        "*.refreshHash",
        'headers["x-platform-admin-key"]',
        'req.headers["x-platform-admin-key"]',
        'headers["X-Platform-Admin-Key"]',
        "password",
        "passwordHash",
        "accessToken",
        "refreshToken",
        "token",
        "authorization",
        "headers.authorization",
        "headers.Authorization",
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.passwordHash",
        "*.accessToken",
        "*.refreshToken",
        "*.authorization",
      ],
      censor: "[REDACTED]",
    },
  },
  pino.multistream([
    { level: env.LOG_LEVEL, stream: consoleStream },
    { level: env.LOG_LEVEL, stream: fileStream },
  ]),
);

// Drain queued file writes before callers terminate the process.
export async function closeLogger(): Promise<void> {
  const completion = finished(fileStream, { cleanup: true });
  fileStream.end();
  await completion;
  consoleStream.flushSync();
}
