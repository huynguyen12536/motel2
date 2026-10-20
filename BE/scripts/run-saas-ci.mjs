import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
if (process.env.CI !== "true" || process.env.GITHUB_ACTIONS !== "true")
  throw Error("CI resource setup is restricted to isolated GitHub runners");
for (const name of ["motel-postgres-1", "motel-rabbitmq-1"]) {
  if (spawnSync("docker", ["inspect", name], { stdio: "ignore" }).status === 0)
    throw Error("Refusing to replace an existing motel infrastructure");
}
const runId = randomUUID(),
  temp = await mkdtemp(join(tmpdir(), "motel-saas-ci-")),
  envFile = join(temp, "credentials.env");
await writeFile(
  envFile,
  "SAAS_CI_RUN=" +
    runId +
    "\nCI_POSTGRES_PASSWORD=" +
    randomBytes(32).toString("hex") +
    "\nCI_RABBITMQ_PASSWORD=" +
    randomBytes(32).toString("hex") +
    "\n",
  { mode: 0o600 },
);
const args = ["compose", "--env-file", envFile, "-f", "tests/compose.saas-ci.yml"];
function run(binary, parameters) {
  if (spawnSync(binary, parameters, { stdio: "inherit" }).status !== 0)
    throw Error("CI integration command failed");
}
function verifyContainer(c) {
  if (c.Config.Labels?.["motel.ci.run"] !== runId || c.Config.Labels?.["com.docker.compose.project"] !== "motel")
    throw Error("Refusing CI cleanup: ownership mismatch");
}
function verifyTemporaryDirectory() {
  if (!resolve(temp).startsWith(resolve(tmpdir()) + sep) || !temp.includes("motel-saas-ci-"))
    throw Error("Invalid CI temporary directory");
}
try {
  run("docker", [...args, "up", "-d", "--wait"]);
  run(process.execPath, ["scripts/test-saas-integration.mjs"]);
  run(process.execPath, ["scripts/test-authorization-integration.mjs"]);
} finally {
  for (const name of ["motel-postgres-1", "motel-rabbitmq-1"]) {
    const result = spawnSync("docker", ["inspect", name], { encoding: "utf8" });
    if (result.status !== 0) continue;
    const c = JSON.parse(result.stdout)[0];
    verifyContainer(c);
  }
  run("docker", [...args, "down"]); // No -v, no global prune, no unrelated containers.
  verifyTemporaryDirectory();
  await rm(temp, { recursive: true, force: true });
}
