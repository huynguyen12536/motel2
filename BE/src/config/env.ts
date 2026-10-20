import { config } from "dotenv";
import { validateEnv } from "./env.validation.js";
config({ quiet: true });
const parsed = validateEnv(process.env);
export const env = { ...parsed, databaseUrl: parsed.MASTER_DATABASE_URL ?? parsed.DATABASE_URL };
export type Env = typeof env;
