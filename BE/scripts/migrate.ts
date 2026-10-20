import { config } from "dotenv";
import { spawnSync } from "node:child_process";
config({ quiet: true });
const target = process.argv[2];
if (target !== "master" && target !== "tenant") throw new Error("Specify master or tenant");
const operation = process.argv[3] ?? "deploy";
if (!["deploy", "status"].includes(operation)) throw new Error("Specify deploy or status");
const value = process.env[target === "master" ? "MASTER_DIRECT_URL" : "TENANT_DIRECT_URL"];
let valid = false;
try {
  const url = new URL(value ?? "");
  valid =
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    !url.hostname.includes("-pooler.") &&
    (!url.hostname.endsWith(".neon.tech") ||
      ["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? ""));
} catch {
  /* Key-only error below. */
}
if (!valid)
  throw new Error(
    target.toUpperCase() + "_DIRECT_URL must be an explicit direct PostgreSQL URL with Neon TLS",
  );
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    operation,
    "--config",
    target === "master" ? "prisma.config.ts" : "prisma.tenant.config.ts",
  ],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
