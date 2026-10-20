import { randomBytes } from "node:crypto";
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_VERIFY: "false",
  MASTER_DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
  DATABASE_URL: "",
  MASTER_DIRECT_URL: "",
  PLATFORM_ADMIN_SECRET: randomBytes(32).toString("base64url"),
  RABBITMQ_USER: "unit",
  RABBITMQ_PASSWORD: "test-only-rabbit",
  REDIS_PASSWORD: "test-only-redis",
});
