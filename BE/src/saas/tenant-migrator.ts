import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/tenant-authorized/client.js";
import { seedAuthorization } from "../modules/authorization/seed.js";
import { PipelineError } from "./contracts.js";
export function pgConfig(url: string, tls = true) {
  const u = new URL(url);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) u.searchParams.delete(key);
  return {
    connectionString: u.toString(),
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    statement_timeout: 10000,
    ...(tls ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
export function validateTenantTarget(
  url: string,
  expected: { name: string; host: string; port: number },
  tls = true,
) {
  const u = new URL(url);
  if (
    !["postgresql:", "postgres:"].includes(u.protocol) ||
    u.pathname !== "/" + expected.name ||
    u.hostname !== expected.host ||
    Number(u.port || 5432) !== expected.port ||
    !u.username ||
    !u.password ||
    u.hostname.includes("-pooler.") ||
    (tls && !u.hostname.endsWith(".neon.tech")) ||
    [...u.searchParams.keys()].some((x) => !["sslmode", "channel_binding"].includes(x)) ||
    (tls && !["require", "verify-full"].includes(u.searchParams.get("sslmode") ?? ""))
  )
    throw new PipelineError("MIGRATION_TARGET_REJECTED");
}
export async function tenantMigrationHistory() {
  const root = resolve("prisma/tenant/migrations");
  const directories = (await readdir(root, { withFileTypes: true }))
    .filter((x) => x.isDirectory())
    .map((x) => x.name)
    .sort();
  if (!directories.length) throw new PipelineError("TENANT_MIGRATION_HISTORY_EMPTY");
  return Promise.all(
    directories.map(async (name) => ({
      name,
      checksum: createHash("sha256")
        .update(await readFile(resolve(root, name, "migration.sql")))
        .digest("hex"),
    })),
  );
}
export async function migrateTenant(
  url: string,
  tenantId: string,
  expected: { name: string; host: string; port: number },
  signal: AbortSignal,
  tls = true,
): Promise<string> {
  validateTenantTarget(url, expected, tls);
  const version = JSON.parse(
    await readFile(resolve("node_modules/prisma/package.json"), "utf8"),
  ).version;
  if (version !== "7.10.0") throw new PipelineError("PRISMA_VERSION_MISMATCH");
  const history = await tenantMigrationHistory(),
    schemaVersion = history.at(-1)!.name;
  const childEnv: NodeJS.ProcessEnv = { TENANT_DIRECT_URL: url, NODE_ENV: "production" };
  for (const key of [
    "PATH",
    "Path",
    "SYSTEMROOT",
    "SystemRoot",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
  ])
    if (process.env[key]) childEnv[key] = process.env[key];
  await new Promise<void>((done, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--config",
        resolve("prisma.tenant.config.ts"),
      ],
      { env: childEnv, shell: false, stdio: ["ignore", "pipe", "pipe"] },
    );
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (ok) done();
      else reject(new PipelineError("TENANT_MIGRATION_FAILED", true));
    };
    const abort = () => {
      child.kill();
      finish(false);
    };
    const timer = setTimeout(abort, 300000);
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", () => undefined); // Never retain raw URLs/SQL/errors.
    child.once("error", () => finish(false));
    child.once("close", (code) => finish(code === 0));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  const client = new Client(pgConfig(url, tls));
  try {
    await client.connect();
    const rows = (
      await client.query(
        "SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name",
      )
    ).rows;
    if (
      rows.length !== history.length ||
      history.some(
        (h) =>
          !rows.some(
            (r) =>
              r.migration_name === h.name &&
              r.checksum === h.checksum &&
              r.finished_at &&
              !r.rolled_back_at,
          ),
      )
    )
      throw new PipelineError("TENANT_MIGRATION_HISTORY_MISMATCH");
  } finally {
    await client.end();
  }
  // A fresh client/adapter for this bounded technical seed; never share it with Master/runtime.
  const adapter = new PrismaPg(pgConfig(url, tls)),
    prisma = new PrismaClient({ adapter });
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.tenantBootstrap.findUnique({ where: { id: 1 } });
      if (existing && existing.tenantId !== tenantId)
        throw new PipelineError("TENANT_BOOTSTRAP_IDENTITY_MISMATCH");
      await tx.tenantBootstrap.upsert({
        where: { id: 1 },
        create: { id: 1, tenantId, schemaVersion },
        update: { schemaVersion },
      });
    });
    await seedAuthorization(prisma, "tenant:" + tenantId);
  } finally {
    await prisma.$disconnect();
  }
  return schemaVersion;
}
