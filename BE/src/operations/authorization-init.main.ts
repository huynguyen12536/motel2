import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Client, Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as MasterClient } from "../generated/master-authorized/client.js";
import { PrismaClient as TenantClient } from "../generated/tenant-authorized/client.js";
import { seedAuthorization } from "../modules/authorization/seed.js";
import { pgConfig } from "../saas/tenant-migrator.js";
// No dotenv/URL fallback. This executable is never imported during build or API startup.
let pool: Pool | undefined, prisma: MasterClient | TenantClient | undefined;
try {
  const e = process.env,
    value = e.AUTHZ_INIT_DATABASE_URL,
    domain = e.AUTHZ_INIT_DOMAIN;
  if (
    !value ||
    !domain ||
    !e.AUTHZ_INIT_AUTHORIZATION_REF ||
    !e.AUTHZ_INIT_EXPECTED_HOST ||
    !e.AUTHZ_INIT_EXPECTED_DATABASE ||
    !e.AUTHZ_INIT_EXPECTED_OWNER ||
    !e.AUTHZ_INIT_EXPECTED_PORT
  )
    throw Error("Explicit authorization and expected target required");
  const u = new URL(value),
    neon = u.hostname.endsWith(".neon.tech");
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    u.hostname !== e.AUTHZ_INIT_EXPECTED_HOST ||
    decodeURIComponent(u.pathname.slice(1)) !== e.AUTHZ_INIT_EXPECTED_DATABASE ||
    Number(u.port || 5432) !== Number(e.AUTHZ_INIT_EXPECTED_PORT) ||
    u.hostname.includes("-pooler.") ||
    !u.username ||
    !u.password ||
    (!neon && u.hostname !== "127.0.0.1" && u.hostname !== "postgres") ||
    [...u.searchParams.keys()].some((k) => !["sslmode", "channel_binding"].includes(k)) ||
    (neon && !["require", "verify-full"].includes(u.searchParams.get("sslmode") ?? ""))
  )
    throw Error("Target rejected");
  if (domain !== "platform" && !/^tenant:[0-9a-f-]{36}$/.test(domain))
    throw Error("Domain rejected");
  const config = pgConfig(value, neon),
    probe = new Client(config);
  try {
    await probe.connect();
    await probe.query("BEGIN READ ONLY");
    const identity = (
      await probe.query(
        "SELECT current_database() AS name,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()",
      )
    ).rows[0];
    if (
      identity.name !== e.AUTHZ_INIT_EXPECTED_DATABASE ||
      identity.owner !== e.AUTHZ_INIT_EXPECTED_OWNER
    )
      throw Error("Ownership mismatch");
    const root = resolve("prisma", domain === "platform" ? "master" : "tenant", "migrations");
    const names = (await readdir(root, { withFileTypes: true }))
      .filter((x) => x.isDirectory())
      .map((x) => x.name)
      .sort();
    const records = (
      await probe.query(
        "SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name",
      )
    ).rows;
    if (records.length !== names.length) throw Error("Migrations incomplete");
    for (const name of names) {
      const hash = createHash("sha256")
        .update(await readFile(resolve(root, name, "migration.sql")))
        .digest("hex");
      if (
        !records.some(
          (r) =>
            r.migration_name === name && r.checksum === hash && r.finished_at && !r.rolled_back_at,
        )
      )
        throw Error("Migration checksum/state mismatch");
    }
    await probe.query("ROLLBACK");
  } finally {
    await probe.end();
  }
  pool = new Pool({ ...config, max: 2 });
  pool.on("error", () => {});
  const adapter = new PrismaPg(pool, { disposeExternalPool: false });
  prisma = domain === "platform" ? new MasterClient({ adapter }) : new TenantClient({ adapter });
  const result = await seedAuthorization(prisma, domain, {
    enabled: e.PLATFORM_BOOTSTRAP_ENABLED === "true",
    email: e.PLATFORM_BOOTSTRAP_EMAIL,
    password: e.PLATFORM_BOOTSTRAP_PASSWORD,
  });
  console.log(
    JSON.stringify({
      initialized: true,
      domain: result.domain,
      policyVersion: result.policyVersion,
      designatedAccountCreatedOrVerified: Boolean(result.bootstrapAccountId),
    }),
  );
} catch {
  console.error(
    "AUTHORIZATION_INIT_FAILED: verify explicit target/owner, applied migration checksums and designated bootstrap credentials; no fallback or credential reset performed",
  );
  process.exitCode = 1;
} finally {
  try {
    await prisma?.$disconnect();
  } finally {
    await pool?.end();
  }
}
