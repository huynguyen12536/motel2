import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function readEnvPort() {
  if (process.env.PORT) return String(process.env.PORT).trim();
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return "3000";
  const match = readFileSync(envPath, "utf8").match(/^\s*PORT\s*=\s*(.+)\s*$/m);
  if (!match) return "3000";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const mode = process.argv[2] === "start" ? "start" : "dev";
const port = readEnvPort();
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", mode, "--port", port],
  { stdio: "inherit", cwd: process.cwd(), shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
