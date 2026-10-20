import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["scripts/test-saas-integration.mjs"], {
  env: { ...process.env, SAAS_TEST_SUITE: "authorization.integration" },
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
