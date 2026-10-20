import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { finished } from "node:stream/promises";
import { test } from "node:test";
import { RotatingFileStream } from "../logger/rotating-file-stream.js";

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "apa-nano-logger-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeRecords(directory: string, limit: number, records: string[]) {
  const stream = new RotatingFileStream(directory, limit);
  const completion = finished(stream);
  for (const record of records) stream.write(record);
  stream.end();
  await completion;
}

test("rotates at the exact byte limit and creates a fresh active log", async (t) => {
  const directory = await fixture(t);
  await writeRecords(directory, 8, ["abc\n", "def\n", "ghi\n"]);
  assert.equal(await readFile(join(directory, "log1"), "utf8"), "abc\ndef\n");
  assert.equal(await readFile(join(directory, "log"), "utf8"), "ghi\n");
});

test("preserves active logs and continues numbering across restarts", async (t) => {
  const directory = await fixture(t);
  await writeFile(join(directory, "log7"), "older archive");
  await writeFile(join(directory, "log"), "abc\n");
  await writeRecords(directory, 8, ["def\n"]);
  await writeRecords(directory, 8, ["ghi\njkl\n"]);
  assert.equal(await readFile(join(directory, "log7"), "utf8"), "older archive");
  assert.equal(await readFile(join(directory, "log8"), "utf8"), "abc\ndef\n");
  assert.equal(await readFile(join(directory, "log9"), "utf8"), "ghi\njkl\n");
  assert.equal(await readFile(join(directory, "log"), "utf8"), "");
});

test("counts UTF-8 bytes and keeps oversized records whole", async (t) => {
  const directory = await fixture(t);
  await writeRecords(directory, 5, ["é\n", "é\n", "oversized\n", "x\n"]);
  assert.equal(await readFile(join(directory, "log1"), "utf8"), "é\n");
  assert.equal(await readFile(join(directory, "log2"), "utf8"), "é\n");
  assert.equal(await readFile(join(directory, "log3"), "utf8"), "oversized\n");
  assert.equal(await readFile(join(directory, "log"), "utf8"), "x\n");
});

test("serializes a burst of writes without losing or reordering records", async (t) => {
  const directory = await fixture(t);
  const records = Array.from({ length: 100 }, (_, i) => JSON.stringify({ i }) + "\n");
  await writeRecords(directory, 40, records);
  const archives = (await readdir(directory))
    .filter((name) => /^log\d+$/.test(name))
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
  const contents = await Promise.all(
    [...archives, "log"].map((name) => readFile(join(directory, name), "utf8")),
  );
  assert.equal(contents.join(""), records.join(""));
});

test("propagates file initialization errors", async (t) => {
  const directory = await fixture(t);
  const notDirectory = join(directory, "file");
  await writeFile(notDirectory, "not a directory");
  const stream = new RotatingFileStream(notDirectory, 100);
  const completion = finished(stream);
  stream.end("record\n");
  await assert.rejects(completion);
});

for (const nodeEnv of ["production", "development"]) {
  test(`actual ${nodeEnv} logger redacts secrets and drains before exit`, async (t) => {
    const directory = await fixture(t);
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
    const { logger, closeLogger } = await import('./logger/index.ts');
    logger.debug({ password: 'test-only-password', token: 'test-only-token', PLATFORM_ADMIN_SECRET: 'test-only-admin-secret', NEON_API_KEY: 'test-only-neon-api-key', TENANT_CREDENTIAL_KEY: 'test-only-derivation-key', JWT_ACCESS_SECRET: 'test-only-jwt-key', PLATFORM_JWT_SECRET: 'test-only-platform-jwt', PLATFORM_BOOTSTRAP_PASSWORD: 'test-only-bootstrap-password', AUTHZ_INIT_DATABASE_URL: 'test-only-init-url', connectionString: 'postgresql://test-only-connection', headers: { 'x-platform-admin-key': 'test-only-admin-key' } }, 'logger-test');
    await closeLogger();
  `,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: nodeEnv,
          RABBITMQ_USER: "logger-test",
          RABBITMQ_PASSWORD: "test-only-rabbit",
          REDIS_PASSWORD: "test-only-redis",
          LOG_LEVEL: "debug",
          LOG_DIR: directory,
          LOG_MAX_SIZE_MB: "1",
          DATABASE_URL: "postgresql://offline:offline@localhost:5432/offline",
          JWT_ACCESS_SECRET: "test-only-access-secret-32-characters",
          JWT_REFRESH_SECRET: "test-only-refresh-secret-32-characters",
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse((await readFile(join(directory, "log"), "utf8")).trim());
    assert.equal(record.level, 20);
    assert.equal(record.password, "[REDACTED]");
    assert.equal(record.token, "[REDACTED]");
    assert.equal(record.PLATFORM_ADMIN_SECRET, "[REDACTED]");
    for (const field of [
      "NEON_API_KEY",
      "TENANT_CREDENTIAL_KEY",
      "JWT_ACCESS_SECRET",
      "PLATFORM_JWT_SECRET",
      "PLATFORM_BOOTSTRAP_PASSWORD",
      "AUTHZ_INIT_DATABASE_URL",
      "connectionString",
    ])
      assert.equal(record[field], "[REDACTED]");
    for (const value of [
      "test-only-neon-api-key",
      "test-only-derivation-key",
      "test-only-jwt-key",
      "test-only-platform-jwt",
      "test-only-bootstrap-password",
      "test-only-init-url",
      "postgresql://test-only-connection",
    ])
      assert.ok(!result.stdout.includes(value));
    assert.equal(record.headers["x-platform-admin-key"], "[REDACTED]");
    assert.ok(!result.stdout.includes("test-only-admin-key"));
    assert.ok(!result.stdout.includes("test-only-admin-secret"));
    assert.equal(record.msg, "logger-test");
    assert.ok(!result.stdout.includes("test-only-password"));
    assert.ok(!result.stdout.includes("test-only-token"));
  });
}
