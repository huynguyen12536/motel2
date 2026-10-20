import { z } from "zod";
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
const port = z.coerce.number().int().min(1).max(65535);
const flag = z.enum(["true", "false"]).transform((v) => v === "true");
const database = optional.refine((v) => {
  if (!v) return true;
  try {
    const u = new URL(v);
    return (
      ["postgres:", "postgresql:"].includes(u.protocol) &&
      (!u.hostname.endsWith(".neon.tech") ||
        ["require", "verify-full"].includes(u.searchParams.get("sslmode") ?? ""))
    );
  } catch {
    return false;
  }
}, "Expected PostgreSQL URL with TLS for Neon");
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: port.default(8080),
    APP_PORT: port.optional(),
    APP_NAME: z.string().min(1).default("wms-apa-nano-be"),
    API_PREFIX: z
      .string()
      .regex(/^[a-zA-Z0-9]+(?:[/-][a-zA-Z0-9]+)*$/)
      .default("api/v1"),
    LOG_DIR: z.string().min(1).default("logs"),
    LOG_MAX_SIZE_MB: z.coerce.number().int().min(1).max(1024).default(10),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: database,
    MASTER_DATABASE_URL: database,
    MASTER_DIRECT_URL: database,
    TENANT_DATABASE_URL: database,
    TENANT_DIRECT_URL: database,
    DATABASE_VERIFY: flag.default(false),
    POSTGRES_HOST: z.string().default("127.0.0.1"),
    POSTGRES_PORT: port.default(5432),
    POSTGRES_DB: z.string().default("motel"),
    POSTGRES_USER: z.string().default("motel"),
    POSTGRES_PASSWORD: optional,
    POSTGRES_SSL: flag.default(false),
    POSTGRES_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    RABBITMQ_HOST: z.string().min(1).default("127.0.0.1"),
    RABBITMQ_PORT: port.default(5672),
    RABBITMQ_USER: z.string().min(1),
    RABBITMQ_PASSWORD: z.string().min(1),
    RABBITMQ_VHOST: z.string().min(1).default("/"),
    REDIS_HOST: z.string().min(1).default("127.0.0.1"),
    REDIS_PORT: port.default(6379),
    REDIS_PASSWORD: z.string().min(1),
    REDIS_URL: optional.refine((v) => {
      if (!v) return true;
      try {
        return ["redis:", "rediss:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }),
    SWAGGER_ENABLED: flag.default(true),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    BODY_LIMIT: z.string().min(1).default("1mb"),
    JWT_ACCESS_SECRET: optional.refine((v) => !v || v.length >= 32),
    JWT_REFRESH_SECRET: optional.refine((v) => !v || v.length >= 32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    PLATFORM_ADMIN_SECRET: optional.refine(
      (v) => !v || (/^[A-Za-z0-9_-]{43,128}$/.test(v) && new Set(v).size >= 8),
      "Use at least 32 random bytes encoded as base64url or hex",
    ),
    PLATFORM_JWT_SECRET: optional.refine((v) => !v || (v.length >= 43 && new Set(v).size >= 8)),
    PLATFORM_LEGACY_ADMIN_USER_ID: optional.refine((v) => !v || z.uuid().safeParse(v).success),
    PLATFORM_BOOTSTRAP_ENABLED: flag.default(false),
    PLATFORM_BOOTSTRAP_EMAIL: optional,
    PLATFORM_BOOTSTRAP_PASSWORD: optional,
    TENANT_PROVISIONING_ENABLED: flag.default(false),
    NEON_AUTHORIZED_PROJECT_ID: optional,
    NEON_AUTHORIZED_BRANCH_ID: optional,
    MASTER_PROVISIONING_AUTHORIZED: flag.default(false),
    NEON_MAX_TENANT_DATABASES: z.coerce.number().int().min(1).max(10000).default(10),
    NEON_PROVISIONING_DIRECT_URL: database,
    TENANT_CREDENTIAL_KEY: optional,
    TENANT_CREDENTIAL_KEYS: optional,
    TENANT_CREDENTIAL_VERSION: z
      .string()
      .regex(/^[a-z0-9_]{1,16}$/)
      .default("v1"),
    TENANT_ALLOWED_DATABASE_HOSTS: z.string().default(""),
    TENANT_DB_NAME_PREFIX: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,15}_$/)
      .default("tenant_"),
    TENANT_PROVISIONING_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
    TENANT_PROVISIONING_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    TENANT_PROVISIONING_POLL_MS: z.coerce.number().int().min(100).max(60000).default(2000),
    TENANT_PROVISIONING_LEASE_MS: z.coerce.number().int().min(10000).max(600000).default(60000),
    TENANT_PROVISIONING_RETRY_MS: z.coerce.number().int().min(100).max(300000).default(10000),
    RABBITMQ_PROVISIONING_EXCHANGE: z
      .string()
      .min(1)
      .max(150)
      .default("tenant.provisioning.exchange"),
    RABBITMQ_PROVISIONING_QUEUE: z
      .string()
      .min(1)
      .max(150)
      .default("tenant.provisioning.requested"),
    RABBITMQ_PROVISIONING_RETRY_QUEUE: z
      .string()
      .min(1)
      .max(150)
      .default("tenant.provisioning.retry"),
    RABBITMQ_PROVISIONING_DLQ: z.string().min(1).max(150).default("tenant.provisioning.dlq"),
    TENANT_CLIENT_MAX: z.coerce.number().int().min(1).max(500).default(50),
    TENANT_POOL_MAX: z.coerce.number().int().min(1).max(20).default(3),
    TENANT_CLIENT_IDLE_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
    TENANT_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(30),
    TENANT_ADMIN_BOOTSTRAP_ENABLED: flag.default(false),
    TENANT_MIGRATION_ROLLOUT_ENABLED: flag.default(false),
    JWT_ISSUER: z.string().min(1).max(100).default("motel-api"),
    JWT_AUDIENCE: z.string().min(1).max(100).default("motel-tenants"),
    NEON_API_KEY: optional,
    NEON_PROJECT_ID: optional,
    NEON_BRANCH_ID: optional,
  })
  .superRefine((d, c) => {
    if(d.PLATFORM_JWT_SECRET && d.PLATFORM_JWT_SECRET===d.JWT_ACCESS_SECRET)c.addIssue({code:"custom",path:["PLATFORM_JWT_SECRET"],message:"Platform and tenant signing secrets must differ"});
    if (
      d.TENANT_PROVISIONING_ENABLED &&
      (!d.MASTER_PROVISIONING_AUTHORIZED ||
        !d.NEON_PROJECT_ID ||
        !d.NEON_BRANCH_ID ||
        d.NEON_PROJECT_ID !== d.NEON_AUTHORIZED_PROJECT_ID ||
        d.NEON_BRANCH_ID !== d.NEON_AUTHORIZED_BRANCH_ID)
    ) {
      c.addIssue({
        code: "custom",
        path: ["TENANT_PROVISIONING_ENABLED"],
        message: "Explicit Master and resource authorization required",
      });
    }
    if (d.DATABASE_VERIFY && !d.MASTER_DATABASE_URL && !d.DATABASE_URL)
      c.addIssue({
        code: "custom",
        path: ["MASTER_DATABASE_URL"],
        message: "Required for verification",
      });
  });
export function validateEnv(input: Record<string, unknown>) {
  const r = envSchema.safeParse(input);
  if (!r.success)
    throw new Error(
      "Invalid environment variables: " + r.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  return r.data;
}
