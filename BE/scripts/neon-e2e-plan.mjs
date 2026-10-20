import { readFile, writeFile } from "node:fs/promises";
import { liveTestPlan } from "./lib/neon-e2e-plan.mjs";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--readiness" || args[2] !== "--output") {
  console.error(
    "Usage: node scripts/neon-e2e-plan.mjs --readiness <report.json> --output <new-plan.json>; dry-run only",
  );
  process.exit(1);
}
try {
  const report = JSON.parse(await readFile(args[1], "utf8"));
  if (report.mode !== "READ_ONLY") throw Error("INVALID_READINESS_REPORT");
  const plan = liveTestPlan(report);
  await writeFile(args[3], JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
  console.log(
    "DRY RUN ONLY: plan written; no registration, network requests, resource creation or authorization performed",
  );
} catch {
  console.error("PLAN_FAILED: verify explicit readiness input and new output path");
  process.exitCode = 1;
}
