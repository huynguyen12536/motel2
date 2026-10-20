import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { assertTestTarget, inspectOwnedContainer } from "./lib/test-owned-postgres.mjs";
const runId = randomUUID(),
  password = randomBytes(32).toString("hex");
const temp = await mkdtemp(join(tmpdir(), "motel-phase2-master-"));
const suffix = runId.replaceAll("-", "").slice(0, 12);
const ownership = {
  shared: true,
  role: "motel_test_" + suffix,
  runId,
  containerId: "",
  port: 0,
  databases: ["fresh", "upgrade", "diff", "registry"].map(
    (name) => "motel_test_" + suffix + "_" + name,
  ),
};
const baseline = resolve("prisma/master/migrations/20261014000000_initialize/migration.sql");
const fullConfig = resolve("prisma.config.ts"),
  schema = resolve("prisma/master/schema.prisma"),
  prisma = resolve("node_modules/prisma/build/index.js");
const url = (db) =>
  "postgresql://" + ownership.role + ":" + password + "@127.0.0.1:" + ownership.port + "/" + db;
const scrub = (value) => value.replaceAll(password, "[REDACTED]");
const results = [];
let adminConfig;
function assertCleanupOwner(row) {
  if (row.owner_run !== runId || row.owner_role !== ownership.role)
    throw new Error("Refusing database cleanup: ownership mismatch");
}
async function adminQuery(sql, params = []) {
  inspectOwnedContainer(ownership);
  const client = new pg.Client(adminConfig);
  try {
    await client.connect();
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}
function command(binary, args, env = process.env, allowed = [0]) {
  const r = spawnSync(binary, args, { env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (!allowed.includes(r.status))
    throw new Error(scrub((r.stderr || r.stdout || "Command failed").slice(-10000)));
  return r;
}
function testEnv(db) {
  return {
    ...process.env,
    MASTER_DIRECT_URL: url(db),
    MASTER_DATABASE_URL: url(db),
    DATABASE_URL: "",
    DIRECT_URL: "",
    TENANT_DATABASE_URL: "",
    TENANT_DIRECT_URL: "",
    NEON_API_KEY: "",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_VERIFY: "false",
    PLATFORM_ADMIN_SECRET: randomBytes(32).toString("base64url"),
    RABBITMQ_HOST: "127.0.0.1",
    RABBITMQ_PORT: "1",
    RABBITMQ_USER: "phase2-test",
    RABBITMQ_PASSWORD: "phase2-test-only",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "1",
    REDIS_PASSWORD: "phase2-test-only",
    REDIS_URL: "",
    MASTER_TEST_OWNERSHIP: JSON.stringify(ownership),
    MASTER_TEST_DATABASE_URL: url(db),
    API_PREFIX: "api/v1",
  };
}
async function cli(db, args, allowed = [0]) {
  await assertTestTarget(url(db), ownership);
  return command(process.execPath, [prisma, ...args], testEnv(db), allowed);
}
async function query(db, sql, params = []) {
  await assertTestTarget(url(db), ownership, true);
  const c = new pg.Client({ connectionString: url(db) });
  try {
    await c.connect();
    return (await c.query(sql, params)).rows;
  } finally {
    await c.end();
  }
}
async function catalog(db) {
  return {
    columns: await query(
      db,
      "SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY table_name,ordinal_position",
    ),
    enums: await query(
      db,
      "SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
    ),
    indexes: await query(
      db,
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename,indexname",
    ),
    constraints: await query(
      db,
      "SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname <> '_prisma_migrations' ORDER BY c.relname,k.conname",
    ),
  };
}
function pass(name) {
  results.push(name);
  console.log("PASS: " + name);
}
try {
  const container = JSON.parse(command("docker", ["inspect", "motel-postgres-1"]).stdout)[0];
  ownership.containerId = container.Id;
  ownership.port = Number(container.NetworkSettings.Ports?.["5432/tcp"]?.[0]?.HostPort || 0);
  inspectOwnedContainer(ownership);
  const config = Object.fromEntries(
    container.Config.Env.map((entry) => {
      const i = entry.indexOf("=");
      return [entry.slice(0, i), entry.slice(i + 1)];
    }),
  );
  if (!config.POSTGRES_USER || !config.POSTGRES_PASSWORD)
    throw new Error("Missing local dev PostgreSQL configuration");
  adminConfig = {
    host: "127.0.0.1",
    port: ownership.port,
    database: "postgres",
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 3000,
  };
  await adminQuery('CREATE ROLE "' + ownership.role + '" LOGIN PASSWORD ' + "'" + password + "'");
  for (const db of ownership.databases) {
    if (!/^motel_test_[0-9a-f]{12}_(fresh|upgrade|diff|registry)$/.test(db))
      throw new Error("Invalid test name");
    await adminQuery('CREATE DATABASE "' + db + '" OWNER "' + ownership.role + '"');
    await adminQuery('COMMENT ON DATABASE "' + db + '" IS ' + "'" + runId + "'");
  }
  pass("Reused project development PostgreSQL; isolated run-owned databases and role");
  const migration = (
    await Promise.all(
      [
        "prisma/master/migrations/20261018000000_tenant_registry/migration.sql",
        "prisma/master/migrations/20261019000000_saas_pipeline/migration.sql",
        "prisma/master/migrations/20261020000000_casbin_authorization/migration.sql",
      ].map((path) => readFile(path, "utf8")),
    )
  ).join("\n");
  if (
    /\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(
      migration.replace(/--[^\n]*/g, "").replace(/ON (DELETE|UPDATE) RESTRICT/g, ""),
    )
  )
    throw new Error("Unexpected destructive migration statement");
  pass("Migration SQL reviewed: additive schema operations only");
  await cli(ownership.databases[0], ["migrate", "deploy", "--config", fullConfig]);
  await cli(ownership.databases[0], ["migrate", "status", "--config", fullConfig]);
  const fresh = await catalog(ownership.databases[0]);
  if (
    fresh.columns.length === 0 ||
    fresh.enums.length !== 12 ||
    fresh.constraints.filter((c) => c.definition.startsWith("FOREIGN KEY")).length !== 8
  )
    throw new Error("Incomplete fresh schema");
  const baselineDir = join(temp, "baseline");
  await mkdir(join(baselineDir, "20261014000000_initialize"), { recursive: true });
  await copyFile(baseline, join(baselineDir, "20261014000000_initialize", "migration.sql"));
  await copyFile(
    "prisma/master/migrations/migration_lock.toml",
    join(baselineDir, "migration_lock.toml"),
  );
  const baselineConfig = join(temp, "baseline.config.ts");
  await writeFile(
    baselineConfig,
    "import {defineConfig} from " +
      JSON.stringify(pathToFileURL(resolve("node_modules/prisma/config.js")).href) +
      "; export default defineConfig({schema:" +
      JSON.stringify(schema) +
      ",migrations:{path:" +
      JSON.stringify(baselineDir) +
      "},datasource:{url:process.env.MASTER_DIRECT_URL}});",
  );
  await cli(ownership.databases[1], ["migrate", "deploy", "--config", baselineConfig]);
  const before = await query(
    ownership.databases[1],
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  if (before.length !== 1 || before[0].tablename !== "_prisma_migrations")
    throw new Error("Unexpected baseline schema");
  await cli(ownership.databases[1], ["migrate", "deploy", "--config", fullConfig]);
  const upgraded = await catalog(ownership.databases[1]);
  if (JSON.stringify(fresh) !== JSON.stringify(upgraded))
    throw new Error("Fresh/upgrade catalogs differ");
  const hash = createHash("sha256")
    .update(await readFile(baseline))
    .digest("hex");
  const historySql =
    'SELECT migration_name,checksum,finished_at FROM "_prisma_migrations" ORDER BY migration_name';
  const history = await query(ownership.databases[1], historySql);
  if (
    history.length !== 4 ||
    history[0].migration_name !== "20261014000000_initialize" ||
    history[0].checksum !== hash
  )
    throw new Error("Unexpected migration history or baseline checksum");
  pass("A/B: Fresh replay and baseline upgrade equivalent; checksum preserved");
  await cli(ownership.databases[1], ["migrate", "deploy", "--config", fullConfig]);
  if (
    JSON.stringify(await catalog(ownership.databases[1])) !== JSON.stringify(upgraded) ||
    JSON.stringify(await query(ownership.databases[1], historySql)) !== JSON.stringify(history)
  )
    throw new Error("Repeated deploy changed schema/history");
  pass("C: Repeated migrate deploy is idempotent");
  for (const db of [ownership.databases[0], ownership.databases[1]])
    await cli(db, [
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      schema,
      "--config",
      fullConfig,
      "--exit-code",
    ]);
  const freshSchema = (
    await cli(ownership.databases[0], ["db", "pull", "--print", "--config", fullConfig])
  ).stdout;
  const upgradedSchema = (
    await cli(ownership.databases[1], ["db", "pull", "--print", "--config", fullConfig])
  ).stdout;
  await writeFile(join(temp, "fresh.prisma"), freshSchema);
  await writeFile(join(temp, "upgraded.prisma"), upgradedSchema);
  await cli(ownership.databases[0], [
    "migrate",
    "diff",
    "--from-schema",
    join(temp, "fresh.prisma"),
    "--to-schema",
    join(temp, "upgraded.prisma"),
    "--exit-code",
    "--config",
    fullConfig,
  ]);
  await cli(ownership.databases[2], ["migrate", "deploy", "--config", fullConfig]);
  await query(ownership.databases[2], 'ALTER TABLE "Tenant" ADD COLUMN "phase2_drift_probe" TEXT');
  const drift = await cli(
    ownership.databases[2],
    [
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      schema,
      "--config",
      fullConfig,
      "--exit-code",
    ],
    [2],
  );
  if (!drift.stdout.includes("phase2_drift_probe")) throw new Error("Expected drift not detected");
  pass("D: Clean Prisma diffs; harmless drift detected with exit 2; no diff SQL executed");
  const activeIndex = fresh.indexes.find(
    (i) => i.indexname === "tenant_provisioning_one_inflight_key",
  );
  if (
    !activeIndex?.indexdef.includes("UNIQUE") ||
    !activeIndex.indexdef.includes("PENDING") ||
    !activeIndex.indexdef.includes("RUNNING")
  )
    throw new Error("Partial index missing");
  for (const name of [
    "provisioning_attempt_count_nonnegative",
    "outbox_attempt_count_nonnegative",
    "tenant_database_provisioned_identity",
    "tenant_database_identity_values",
    "tenant_database_port_valid",
    "provisioning_lease_pair",
    "outbox_lease_pair",
    "migration_attempt_nonnegative",
    "migration_lease_pair",
    "login_rate_positive",
    "tenant_database_provider_value",
    "authz_state_singleton",
    "authz_audit_revision_positive",
    "platform_user_status",
    "platform_email_canonical",
    "platform_session_version_positive",
  ])
    if (!fresh.constraints.some((c) => c.conname === name))
      throw new Error("Missing CHECK: " + name);
  const rolloutIndex = fresh.indexes.find(
    (i) => i.indexname === "tenant_migration_one_inflight_key",
  );
  if (
    !rolloutIndex?.indexdef.includes("UNIQUE") ||
    !rolloutIndex.indexdef.includes("PENDING") ||
    !rolloutIndex.indexdef.includes("RUNNING")
  )
    throw new Error("Migration rollout partial index missing");
  pass("Catalog: provisioning/rollout partial indexes and sixteen CHECK constraints verified");
  await cli(ownership.databases[3], ["migrate", "deploy", "--config", fullConfig]);
  await assertTestTarget(url(ownership.databases[3]), ownership);
  const tests = command(
    process.execPath,
    [
      "--experimental-vm-modules",
      "node_modules/jest/bin/jest.js",
      "--testPathPatterns=master-registry",
      "--runInBand",
    ],
    testEnv(ownership.databases[3]),
  );
  console.log(scrub(tests.stdout));
  console.log(scrub(tests.stderr));
  pass("E: Prisma constraints, concurrency, transactions, registry and HTTP tests");
  console.log(
    JSON.stringify({ result: "PASS", target: "owned-local-postgresql", checks: results }, null, 2),
  );
} catch (e) {
  console.error(scrub(e.stack || String(e)));
  process.exitCode = 1;
} finally {
  if (adminConfig) {
    try {
      inspectOwnedContainer(ownership);
      for (const db of ownership.databases) {
        const rows = await adminQuery(
          "SELECT shobj_description(oid,'pg_database') AS owner_run, pg_get_userbyid(datdba) AS owner_role FROM pg_database WHERE datname=$1",
          [db],
        );
        if (!rows.length) continue;
        assertCleanupOwner(rows[0]);
        await adminQuery('DROP DATABASE "' + db + '" WITH (FORCE)');
      }
      await adminQuery('DROP ROLE IF EXISTS "' + ownership.role + '"');
      console.log(
        "Cleanup: removed run-owned test databases/role; shared PostgreSQL container and volumes retained",
      );
    } catch (e) {
      console.error("Test cleanup failed: " + scrub(e.message));
      process.exitCode = 1;
    }
  }
  const cleanupTarget = resolve(temp);
  if (
    cleanupTarget.startsWith(resolve(tmpdir()) + sep) &&
    basename(cleanupTarget).startsWith("motel-phase2-master-")
  ) {
    await rm(cleanupTarget, { recursive: true, force: true });
  } else {
    console.error("Refusing unexpected temporary directory cleanup target");
    process.exitCode = 1;
  }
}
