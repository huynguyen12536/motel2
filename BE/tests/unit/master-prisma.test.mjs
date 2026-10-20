import "../support/phase2-env.mjs";
import { test, expect, jest, afterEach } from "@jest/globals";
import {
  MasterPrismaService,
  masterPoolConfig,
} from "../../dist/src/infrastructure/database/master/master-prisma.service.js";
import { env } from "../../dist/src/config/env.js";
const initial = env.databaseUrl;
afterEach(() => {
  env.databaseUrl = initial;
});
class Fixture extends MasterPrismaService {
  pools = [];
  adapters = [];
  clients = [];
  connect = async () => {};
  createPool() {
    const p = { on: jest.fn(), end: jest.fn(async () => {}) };
    this.pools.push(p);
    return p;
  }
  createAdapter(pool) {
    const a = { pool };
    this.adapters.push(a);
    return a;
  }
  createClient(adapter) {
    const c = {
      adapter,
      $connect: jest.fn(() => this.connect()),
      $disconnect: jest.fn(async () => {}),
    };
    this.clients.push(c);
    return c;
  }
}
test("simultaneous callers share a single initialization, client and owned pool", async () => {
  const service = new Fixture();
  const [a, b, c] = await Promise.all([service.client(), service.client(), service.client()]);
  expect(a).toBe(b);
  expect(b).toBe(c);
  expect(service.pools).toHaveLength(1);
  expect(a.$connect).toHaveBeenCalledTimes(1);
  await Promise.all([service.onModuleDestroy(), service.onModuleDestroy()]);
  expect(a.$disconnect).toHaveBeenCalledTimes(1);
  expect(service.pools[0].end).toHaveBeenCalledTimes(1);
  await expect(service.client()).rejects.toMatchObject({ status: 503 });
});
test("different services never share adapter, pool or client", async () => {
  const a = new Fixture(),
    b = new Fixture();
  await Promise.all([a.client(), b.client()]);
  expect(a.pools[0]).not.toBe(b.pools[0]);
  expect(a.adapters[0]).not.toBe(b.adapters[0]);
  expect(a.clients[0]).not.toBe(b.clients[0]);
  await Promise.all([a.onModuleDestroy(), b.onModuleDestroy()]);
});
test("initialization failure cleans resources once and permits a fresh retry", async () => {
  const service = new Fixture();
  service.connect = async () => {
    throw new Error("postgresql://secret:credential@private/db");
  };
  const results = await Promise.allSettled([service.client(), service.client()]);
  expect(results.every((r) => r.status === "rejected")).toBe(true);
  expect(results[0].reason.message).toBe("Master database is unavailable");
  expect(service.clients[0].$disconnect).toHaveBeenCalledTimes(1);
  expect(service.pools[0].end).toHaveBeenCalledTimes(1);
  service.connect = async () => {};
  await service.client();
  expect(service.pools).toHaveLength(2);
  await service.onModuleDestroy();
  expect(service.pools[0].end).toHaveBeenCalledTimes(1);
  expect(service.pools[1].end).toHaveBeenCalledTimes(1);
});
test("shutdown waits for in-flight initialization and closes once", async () => {
  const service = new Fixture();
  let unblock;
  service.connect = () =>
    new Promise((r) => {
      unblock = r;
    });
  const pending = service.client();
  const closing = service.onModuleDestroy();
  unblock();
  await pending;
  await closing;
  expect(service.clients[0].$disconnect).toHaveBeenCalledTimes(1);
  expect(service.pools[0].end).toHaveBeenCalledTimes(1);
});
test("missing configuration fails safely without constructing a pool", async () => {
  env.databaseUrl = undefined;
  const service = new MasterPrismaService();
  await expect(service.client()).rejects.toMatchObject({ status: 503 });
  await service.onModuleDestroy();
});
test("Neon pool configuration enforces verified TLS and bounded pool/queries", () => {
  env.databaseUrl = "postgresql://test:test@ep-test.neon.tech/db?sslmode=require";
  const config = masterPoolConfig();
  expect(config.ssl).toEqual({ rejectUnauthorized: true });
  expect(config.connectionString).not.toContain("sslmode");
  expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
  expect(config.query_timeout).toBeGreaterThan(0);
});

test("pool is still closed once when Prisma disconnect fails", async () => {
  const service = new Fixture();
  const client = await service.client();
  client.$disconnect = jest.fn(async () => {
    throw new Error("disconnect failure");
  });
  await Promise.all([service.onModuleDestroy(), service.onModuleDestroy()]);
  expect(client.$disconnect).toHaveBeenCalledTimes(1);
  expect(service.pools[0].end).toHaveBeenCalledTimes(1);
});
