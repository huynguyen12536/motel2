import { spawn } from "node:child_process";
const compiler = spawn(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json", "--watch"],
  { stdio: "inherit" },
);
const server = spawn(process.execPath, ["--watch", "dist/src/index.js"], { stdio: "inherit" });
function stop() {
  compiler.kill();
  server.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  compiler.kill();
  process.exitCode = code ?? 0;
});
