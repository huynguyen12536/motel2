import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ quiet: true });

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    APP_NAME: z.string().min(1).default("wms-apa-nano-be"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    POSTGRES_HOST: z.string().min(1).default("127.0.0.1"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_DB: z.string().min(1).default("motel"),
    POSTGRES_USER: z.string().min(1).default("motel"),
    POSTGRES_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    POSTGRES_SSL: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    REDIS_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    BODY_LIMIT: z.string().min(1).default("1mb"),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),
  })
  .superRefine((data, ctx) => {
    if (!data.DATABASE_URL && !data.POSTGRES_PASSWORD) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "Set DATABASE_URL or POSTGRES_PASSWORD",
      });
    }
  });

export type Env = z.infer<typeof envSchema> & { databaseUrl: string };

function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `  - ${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("\n");
  return `Invalid environment variables:\n${details}`;
}

function buildDatabaseUrl(data: z.infer<typeof envSchema>): string {
  if (data.DATABASE_URL) {
    return data.DATABASE_URL;
  }

  const user = encodeURIComponent(data.POSTGRES_USER);
  const password = encodeURIComponent(data.POSTGRES_PASSWORD ?? "");
  return `postgres://${user}:${password}@${data.POSTGRES_HOST}:${data.POSTGRES_PORT}/${data.POSTGRES_DB}`;
}

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return {
    ...result.data,
    databaseUrl: buildDatabaseUrl(result.data),
  };
}

export const env = parseEnv();
