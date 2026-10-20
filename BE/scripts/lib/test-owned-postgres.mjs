import { spawnSync } from "node:child_process";
import pg from "pg";
export function inspectOwnedContainer(ownership, cleanup = false) {
  if (
    !ownership ||
    !/^[0-9a-f]{64}$/.test(ownership.containerId) ||
    !/^[0-9a-f-]{36}$/.test(ownership.runId)
  )
    throw new Error("Missing test ownership evidence");
  const result = spawnSync("docker", ["inspect", ownership.containerId], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Test-owned PostgreSQL container is unavailable");
  const c = JSON.parse(result.stdout)[0],
    port = c.NetworkSettings.Ports["5432/tcp"]?.[0];
  if (ownership.shared) {
    if (
      c.Id !== ownership.containerId ||
      c.Config.Labels?.["com.docker.compose.project"] !== "motel" ||
      c.Config.Labels?.["com.docker.compose.service"] !== "postgres" ||
      c.Config.Labels?.["motel.database.environment"] !== "development" ||
      !c.State.Running ||
      port?.HostIp !== "127.0.0.1" ||
      Number(port.HostPort) !== ownership.port ||
      !/^motel_test_[0-9a-f]{12}$/.test(ownership.role) ||
      !ownership.databases.every(
        (db) =>
          db.startsWith(ownership.role + "_") &&
          /^motel_test_[0-9a-f]{12}_(fresh|upgrade|diff|registry)$/.test(db),
      )
    )
      throw new Error("Refusing shared database operation: development target mismatch");
    return c;
  }
  if (cleanup) {
    if (
      c.Id !== ownership.containerId ||
      c.Config.Labels?.["motel.phase2.test.run"] !== ownership.runId
    )
      throw new Error("Cleanup ownership mismatch");
    return c;
  }
  if (
    c.Id !== ownership.containerId ||
    c.Config.Labels?.["motel.phase2.test.run"] !== ownership.runId ||
    !c.State.Running ||
    port?.HostIp !== "127.0.0.1" ||
    Number(port.HostPort) !== ownership.port ||
    !c.HostConfig.Tmpfs?.["/var/lib/postgresql"] ||
    c.Mounts.some((m) => m.Type === "volume")
  )
    throw new Error("Refusing database operation: test container ownership mismatch");
  return c;
}
export async function assertTestTarget(url, ownership, allowAdmin = false) {
  const u = new URL(url);
  if (
    u.protocol !== "postgresql:" ||
    u.hostname !== "127.0.0.1" ||
    Number(u.port) !== ownership?.port ||
    decodeURIComponent(u.username) !== (ownership?.role ?? "phase2_test") ||
    !u.password ||
    !(
      ownership.databases.includes(u.pathname.slice(1)) ||
      (allowAdmin && u.pathname === "/postgres")
    )
  )
    throw new Error("Refusing database operation: not an explicit owned local test URL");
  inspectOwnedContainer(ownership);
  const c = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 2000,
    query_timeout: 3000,
  });
  try {
    await c.connect();
    const { rows } = await c.query("SELECT current_database() AS db,current_user AS role");
    if (rows[0].db !== u.pathname.slice(1) || rows[0].role !== (ownership.role ?? "phase2_test"))
      throw new Error("Test database identity mismatch");
    if (ownership.shared) {
      const { rows: identity } = await c.query(
        "SELECT shobj_description(oid,'pg_database') AS run, pg_get_userbyid(datdba) AS role FROM pg_database WHERE datname=current_database()",
      );
      if (identity[0]?.run !== ownership.runId || identity[0]?.role !== ownership.role)
        throw new Error("Shared test database ownership mismatch");
    }
  } finally {
    await c.end().catch(() => {});
  }
}
