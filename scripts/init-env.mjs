import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; kept unchanged.");
} else {
  const template = readFileSync(".env.example", "utf8");
  const content = template
    .replace("POSTGRES_PASSWORD=", "POSTGRES_PASSWORD=" + randomBytes(24).toString("hex"))
    .replace("REDIS_PASSWORD=", "REDIS_PASSWORD=" + randomBytes(24).toString("hex"));
  writeFileSync(".env", content, { flag: "wx", mode: 0o600 });
  console.log("Created .env with random local passwords. Values are not printed.");
}
