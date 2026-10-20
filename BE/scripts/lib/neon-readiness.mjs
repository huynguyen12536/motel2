import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const origin = "https://console.neon.tech/api/v2";
export function describeTarget(value) {
  const u = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    !u.hostname.endsWith(".neon.tech") ||
    !["require", "verify-full"].includes(u.searchParams.get("sslmode")) ||
    !u.username ||
    !u.password ||
    !u.pathname.slice(1) ||
    [...u.searchParams.keys()].some((k) => !["sslmode", "channel_binding"].includes(k))
  )
    throw Error("NEON_READ_TARGET_INVALID");
  return {
    host: u.hostname,
    database: decodeURIComponent(u.pathname.slice(1)),
    port: Number(u.port || 5432),
    pooled: u.hostname.includes("-pooler."),
    tls: "verify-full",
  };
}

export async function migrationFiles(root = "prisma/master/migrations") {
  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter((x) => x.isDirectory())
    .map((x) => x.name)
    .sort();
  return Promise.all(
    dirs.map(async (name) => ({
      name,
      checksum: createHash("sha256")
        .update(await readFile(resolve(root, name, "migration.sql")))
        .digest("hex"),
    })),
  );
}

export function compareHistory(expected, applied) {
  return {
    pending: expected
      .filter(
        (e) =>
          !applied.some((a) => a.migration_name === e.name && a.finished_at && !a.rolled_back_at),
      )
      .map((e) => e.name),
    failed: applied.filter((a) => !a.finished_at && !a.rolled_back_at).map((a) => a.migration_name),
    mismatches: applied
      .filter(
        (a) =>
          !a.rolled_back_at &&
          expected.find((e) => e.name === a.migration_name)?.checksum !== a.checksum,
      )
      .map((a) => a.migration_name),
    // Ordering and unexpected records are independently visible; names alone are not proof.
    applied: applied.map((a) => ({
      name: a.migration_name,
      checksum: a.checksum,
      finished: Boolean(a.finished_at),
      rolledBack: Boolean(a.rolled_back_at),
    })),
  };
}

export async function inspectDatabase(value, expected, Client = pg.Client) {
  const target = describeTarget(value),
    u = new URL(value);
  u.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 12000,
  });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const query = async (sql) => (await client.query(sql)).rows;
    const identity = (
      await query(
        "SELECT current_database() AS database, current_user AS role, current_setting('transaction_read_only') AS read_only, current_setting('server_version') AS server_version, current_setting('max_connections')::int AS max_connections",
      )
    )[0];
    if (identity.database !== target.database || identity.read_only !== "on")
      throw Error("READ_TARGET_MISMATCH");
    const tables = await query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    const records = tables.some((t) => t.tablename === "_prisma_migrations")
      ? await query(
          'SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY started_at,id',
        )
      : [];
    const inventory = await query(
      "SELECT datname AS name,pg_get_userbyid(datdba) AS owner,datallowconn AS allows_connections,EXISTS (SELECT 1 FROM aclexplode(coalesce(datacl,acldefault('d',datdba))) a WHERE a.grantee=0 AND a.privilege_type='CONNECT') AS public_connect FROM pg_database WHERE NOT datistemplate ORDER BY datname",
    );
    const role = (
      await query(
        "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit,rolconnlimit FROM pg_roles WHERE rolname=current_user",
      )
    )[0];
    const memberships = await query(
      "SELECT p.rolname AS granted_role FROM pg_auth_members m JOIN pg_roles p ON p.oid=m.roleid JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user ORDER BY p.rolname",
    );
    const roleCount = (await query("SELECT count(*)::int AS count FROM pg_roles"))[0].count;
    const constraints = await query(
      "SELECT t.relname AS table_name,c.conname AS name,c.contype AS type,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' ORDER BY t.relname,c.conname",
    );
    const indexes = await query(
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
    );
    const columns = await query(
      "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    );
    const locks = await query(
      "SELECT mode,granted,count(*)::int AS count FROM pg_locks WHERE database=(SELECT oid FROM pg_database WHERE datname=current_database()) GROUP BY mode,granted ORDER BY mode,granted",
    );
    const activity = (
      await query(
        "SELECT count(*)::int AS older_than_one_minute FROM pg_stat_activity WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid() AND xact_start<now()-interval '1 minute'",
      )
    )[0];
    return {
      status: "PASS",
      target,
      identity,
      migrations: compareHistory(expected, records),
      tables,
      inventory,
      role,
      memberships,
      roleCount,
      constraints,
      indexes,
      columns,
      locks,
      activity,
    };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

export async function inspectProvider(e, request = globalThis.fetch) {
  if (!e.NEON_API_KEY || !e.NEON_PROJECT_ID || !e.NEON_BRANCH_ID)
    return { status: "UNVERIFIED", reason: "EXPLICIT_PROJECT_BRANCH_AND_API_KEY_REQUIRED" };
  const project = e.NEON_PROJECT_ID,
    branch = e.NEON_BRANCH_ID;
  if (!/^[a-z0-9-]{1,60}$/.test(project) || !/^br-[a-z0-9-]{1,57}$/.test(branch))
    return { status: "UNVERIFIED", reason: "INVALID_PROVIDER_IDS" };
  const base = "/projects/" + project;
  const get = async (path) => {
    const r = await request(origin + path, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { authorization: "Bearer " + e.NEON_API_KEY, accept: "application/json" },
    });
    if (!r.ok) throw Error("PROVIDER_READ_FAILED");
    return r.json();
  };
  try {
    const p = await get(base),
      b = await get(base + "/branches/" + branch);
    if (p.project?.id !== project || b.branch?.id !== branch || b.branch?.project_id !== project)
      return { status: "UNVERIFIED", reason: "PROVIDER_IDENTITY_MISMATCH" };
    const db = await get(base + "/branches/" + branch + "/databases");
    const roles = await get(base + "/branches/" + branch + "/roles");
    const ep = await get(base + "/endpoints");
    // Only explicit allowlisted metadata survives. Provider roles may contain passwords.
    if (!Array.isArray(db.databases) || !Array.isArray(roles.roles) || !Array.isArray(ep.endpoints))
      throw Error("PROVIDER_RESPONSE_INVALID");
    return {
      status: "PASS",
      projectId: project,
      branchId: branch,
      branchName: b.branch.name,
      environmentClassification: "UNVERIFIED",
      ownership: "UNVERIFIED",
      apiReadAccess: "PASS",
      apiWritePermissions: "UNVERIFIED",
      restoreWindowSeconds: p.project.history_retention_seconds ?? null,
      providerLimits: "UNVERIFIED",
      databases: db.databases.map((x) => ({
        id: x.id,
        name: x.name,
        branchId: x.branch_id,
        owner: x.owner_name,
      })),
      roles: roles.roles.map((x) => ({ name: x.name })),
      endpoints: ep.endpoints
        .filter((x) => x.branch_id === branch)
        .map((x) => ({ id: x.id, host: x.host, branchId: x.branch_id, type: x.type })),
    };
  } catch {
    return { status: "UNVERIFIED", reason: "PROVIDER_READ_FAILED" };
  }
}
