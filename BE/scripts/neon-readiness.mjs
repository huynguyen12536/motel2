import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import {
  compareHistory,
  describeTarget,
  inspectDatabase,
  inspectProvider,
  migrationFiles,
} from "./lib/neon-readiness.mjs";

// Read-only: never loads application modules, starts workers, invokes migrate deploy,
// creates resources, changes process.env, or follows provider redirects.
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
if (
  args.length % 2 ||
  args.some((x, i) => i % 2 === 0 && !["--env-file", "--output"].includes(x)) ||
  !args.includes("--env-file")
) {
  console.error(
    "Usage: node scripts/neon-readiness.mjs --env-file <explicit file> [--output <report.json>]",
  );
  process.exit(1);
}
try {
  const e = parse(await readFile(option("--env-file"))),
    expected = await migrationFiles();
  const key = e.MASTER_DIRECT_URL
    ? "MASTER_DIRECT_URL"
    : e.MASTER_DATABASE_URL
      ? "MASTER_DATABASE_URL"
      : "DATABASE_URL";
  const report = {
    observedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    configFile: option("--env-file"),
    databaseSource: key,
    classification: "UNVERIFIED",
    migrationApplied: false,
    liveE2E: "NOT RUN",
    expectedMigrations: expected,
    configured: Object.fromEntries(
      [
        "MASTER_DIRECT_URL",
        "MASTER_DATABASE_URL",
        "NEON_API_KEY",
        "NEON_PROJECT_ID",
        "NEON_BRANCH_ID",
        "NEON_PROVISIONING_DIRECT_URL",
        "PLATFORM_ADMIN_SECRET",
        "JWT_ACCESS_SECRET",
        "TENANT_CREDENTIAL_KEY",
        "TENANT_CREDENTIAL_KEYS",
      ].map((k) => [k, Boolean(e[k])]),
    ),
    flags: Object.fromEntries(
      [
        "TENANT_PROVISIONING_ENABLED",
        "TENANT_ADMIN_BOOTSTRAP_ENABLED",
        "TENANT_MIGRATION_ROLLOUT_ENABLED",
      ].map((k) => [k, e[k] === "true"]),
    ),
    provider: await inspectProvider(e),
  };
  try {
    report.target = describeTarget(e[key]);
    report.database = await inspectDatabase(e[key], expected);
  } catch {
    report.database = { status: "UNVERIFIED", reason: "READ_ONLY_DATABASE_CHECK_FAILED" };
    report.migrations = compareHistory(expected, []);
  }
  report.liveGate =
    "BLOCKED_PENDING_OPERATOR_TARGET_CLASSIFICATION_RECOVERY_AND_SPECIFIC_AUTHORIZATION";
  const json = JSON.stringify(report, null, 2) + "\n";
  if (args.includes("--output")) await writeFile(option("--output"), json, { flag: "wx" });
  console.log(json);
  if (report.database.status !== "PASS") process.exitCode = 2;
} catch {
  console.error(
    "READINESS_FAILED: check explicit input file, target and output path; raw errors suppressed",
  );
  process.exitCode = 1;
}
