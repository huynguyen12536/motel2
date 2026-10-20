import "../support/phase2-env.mjs";
import { test, expect } from "@jest/globals";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
Object.assign(process.env, { TENANT_CLIENT_MAX: "2", TENANT_CLIENT_IDLE_MS: "1000" });
const { TenantPrismaManager, TenantResolver } =
  await import("../../dist/src/saas/tenant-routing.js");
const { ProvisioningBroker } = await import("../../dist/src/saas/broker.js");
const { ProvisioningWorker } = await import("../../dist/src/saas/provisioning.worker.js");
const { OutboxPublisher } = await import("../../dist/src/saas/outbox.publisher.js");
const { PipelineError } = await import("../../dist/src/saas/contracts.js");
const { ProvisioningService } = await import("../../dist/src/saas/provisioning.service.js");
const { TenantMigrationOrchestrator } =
  await import("../../dist/src/saas/migration-orchestrator.js");
const id = randomUUID(),
  tenant = { id, code: "A", revision: "1", mapping: { tenantId: id } };
const connection = {
  resolve: async (m) => ({ url: "postgresql://test-only", tls: false, fingerprint: m.tenantId }),
};
class Manager extends TenantPrismaManager {
  pools = [];
  clients = [];
  createPool() {
    const p = {
      endCount: 0,
      on() {},
      end: async () => {
        p.endCount++;
      },
      totalCount: 1,
    };
    this.pools.push(p);
    return p;
  }
  createClient() {
    const index = this.clients.length;
    const c = {
      connectCount: 0,
      disconnectCount: 0,
      $connect: async () => {
        c.connectCount++;
      },
      $disconnect: async () => {
        c.disconnectCount++;
      },
      tenantBootstrap: { findUnique: async () => ({ tenantId: this.identities?.[index] ?? id }) },
    };
    this.clients.push(c);
    return c;
  }
}
test("concurrent first access shares one tenant client/pool; shutdown closes owned resources", async () => {
  const m = new Manager(connection);
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => m.withClient(tenant, async (c) => c)),
    );
    expect(new Set(results).size).toBe(1);
    expect(m.pools).toHaveLength(1);
    expect(m.clients[0].connectCount).toBe(1);
    expect(m.metrics()).toMatchObject({ clients: 1, busy: 0 });
  } finally {
    await m.onModuleDestroy();
    await m.onModuleDestroy();
  }
  expect(m.pools[0].endCount).toBe(1);
  expect(m.clients[0].disconnectCount).toBe(1);
  await expect(m.withClient(tenant, async () => null)).rejects.toThrow("stopping");
});
test("clients are isolated by tenant and credential/mapping revision", async () => {
  const other = { ...tenant, id: randomUUID(), mapping: { tenantId: randomUUID() } };
  const m = new Manager(connection);
  m.identities = [tenant.id, other.id, tenant.id];
  try {
    const a = await m.withClient(tenant, async (c) => c),
      b = await m.withClient(other, async (c) => c);
    expect(a).not.toBe(b);
    expect(m.pools[0]).not.toBe(m.pools[1]);
    const rotated = await m.withClient({ ...tenant, revision: "rotated" }, async (c) => c);
    expect(rotated).not.toBe(a);
    expect(m.metrics().clients).toBeLessThanOrEqual(2);
  } finally {
    await m.onModuleDestroy();
  }
});
test("identity mismatch fails closed and initialization failure can be retried", async () => {
  const m = new Manager(connection);
  m.identities = [randomUUID(), tenant.id];
  try {
    await expect(m.withClient(tenant, async () => true)).rejects.toThrow("unavailable");
    expect(m.pools[0].endCount).toBe(1);
    expect(await m.withClient(tenant, async () => true)).toBe(true);
  } finally {
    await m.onModuleDestroy();
  }
});
test("idle eviction drains resources, and active capacity is bounded", async () => {
  const m = new Manager(connection);
  let release;
  const wait = new Promise((r) => (release = r));
  try {
    const busy = m.withClient(tenant, async () => wait);
    await new Promise((r) => setTimeout(r, 5));
    const second = { ...tenant, id: randomUUID(), mapping: { tenantId: randomUUID() } };
    m.identities = [tenant.id, second.id];
    const busy2 = m.withClient(second, async () => wait);
    await new Promise((r) => setTimeout(r, 5));
    await expect(m.withClient({ ...tenant, revision: "third" }, async () => true)).rejects.toThrow(
      "capacity",
    );
    release();
    await Promise.all([busy, busy2]);
    await new Promise((r) => setTimeout(r, 1010));
    await m.evict();
    expect(m.metrics().clients).toBe(0);
  } finally {
    release();
    await m.onModuleDestroy();
  }
});
test("resolver checks Master status even with stale Redis metadata", async () => {
  const resolver = new TenantResolver(
    {
      client: async () => ({
        tenant: {
          findUnique: async () => ({
            id,
            status: "SUSPENDED",
            database: { provisionedAt: new Date() },
          }),
        },
      }),
    },
    { get: async () => JSON.stringify({ id, status: "ACTIVE" }), set: async () => {} },
  );
  await expect(resolver.resolve({ id })).rejects.toThrow("Tenant is unavailable");
});
test("publisher waits for confirms and rejects nack/unroutable messages", async () => {
  const channel = new EventEmitter();
  let callback;
  channel.publish = (_exchange, _key, _body, options, done) => {
    callback = done;
    expect(options.persistent).toBe(true);
    expect(options.mandatory).toBe(true);
  };
  const b = new ProvisioningBroker();
  b.ready = async () => channel;
  let finished = false;
  const promise = b.publish({ eventId: id }).then(() => (finished = true));
  await Promise.resolve();
  expect(finished).toBe(false);
  callback(null);
  await promise;
  expect(finished).toBe(true);
  const nack = b.publish({ eventId: id });
  await Promise.resolve();
  callback(new Error("nack"));
  await expect(nack).rejects.toThrow("BROKER_CONFIRM_FAILED");
  const returned = b.publish({ eventId: id });
  await Promise.resolve();
  channel.emit("return", { properties: { messageId: id } });
  await expect(returned).rejects.toThrow("BROKER_CONFIRM_FAILED");
});
test("poison payload is fingerprinted rather than copied to DLQ", async () => {
  const broker = new ProvisioningBroker();
  let payload;
  broker.publish = async (p) => (payload = p);
  await broker.dead({ content: Buffer.from('{"password":"secret"}') }, "INVALID");
  expect(JSON.stringify(payload)).not.toContain("secret");
  expect(payload.fingerprint).toMatch(/^[a-f0-9]{64}$/);
});
const message = () => ({
  eventId: randomUUID(),
  eventType: "tenant.provision.requested",
  schemaVersion: 1,
  tenantId: id,
  provisioningId: randomUUID(),
  correlationId: randomUUID(),
});
test("worker does not ACK a retry if confirmed publication fails", async () => {
  const input = message(),
    record = { id: input.provisioningId, requestedAt: new Date(), status: "PENDING" };
  let ack = 0;
  const worker = new ProvisioningWorker(
    {
      claim: async () => ({ token: randomUUID(), mapping: {}, operation: record }),
      progress: async () => {},
      fail: async () => ({ retry: true, attempt: 1 }),
    },
    { client: async () => ({ tenantProvisioning: { findFirst: async () => record } }) },
    {
      provision: async () => {
        throw new PipelineError("TRANSIENT", true);
      },
    },
  );
  const broker = {
    publish: async () => {
      throw new Error("publish failed");
    },
    ack: () => ack++,
  };
  await expect(
    worker.handle({ content: Buffer.from(JSON.stringify(input)) }, broker),
  ).rejects.toThrow("publish failed");
  expect(ack).toBe(0);
});
test("completed duplicate messages are ACKed without provisioning again", async () => {
  let ack = 0,
    calls = 0;
  const input = message();
  const worker = new ProvisioningWorker(
    {},
    {
      client: async () => ({
        tenantProvisioning: {
          findFirst: async () => ({
            id: input.provisioningId,
            status: "SUCCEEDED",
            requestedAt: new Date(),
          }),
        },
      }),
    },
    { provision: async () => calls++ },
  );
  await worker.handle({ content: Buffer.from(JSON.stringify(input)) }, { ack: () => ack++ });
  expect(ack).toBe(1);
  expect(calls).toBe(0);
});
test("outbox remains pending when broker confirmation fails", async () => {
  const changes = [],
    input = message();
  const db = { outboxEvent: { updateMany: async (op) => changes.push(op) } };
  const publisher = new OutboxPublisher({ client: async () => db });
  publisher.claim = async () => ({
    row: {
      id: input.eventId,
      aggregateId: id,
      eventType: input.eventType,
      payload: input,
      attemptCount: 1,
    },
    token: randomUUID(),
  });
  await publisher.tick({
    publish: async () => {
      throw new Error("offline");
    },
  });
  expect(changes[0].data.status).toBeUndefined();
  expect(changes[0].data.lastErrorCode).toBe("BROKER_PUBLISH_FAILED");
  expect(changes[0].data.leaseToken).toBeNull();
});
test("disabled provisioning and rollout refuse before any database or provider call", async () => {
  const master = {
    client: async () => {
      throw Error("must not connect");
    },
  };
  await expect(
    new ProvisioningService(master, { provisioningEnabled: false }).request(id),
  ).rejects.toThrow("disabled");
  await expect(
    new TenantMigrationOrchestrator(master, {}, { rolloutEnabled: false }).create("ticket"),
  ).rejects.toThrow("disabled");
});
test("late failure cannot overwrite a new worker's lease", async () => {
  const db = {
    $transaction: async (fn) =>
      fn({
        tenantProvisioning: {
          findFirst: async () => ({ tenantId: id, attemptCount: 1 }),
          updateMany: async () => ({ count: 0 }),
        },
      }),
  };
  await expect(
    new ProvisioningService({ client: async () => db }, {}).fail(
      id,
      randomUUID(),
      "TRANSIENT",
      true,
    ),
  ).rejects.toThrow("LEASE_LOST");
});
test("graceful manager shutdown waits for active request drainage", async () => {
  const m = new Manager(connection);
  let release, entered;
  const started = new Promise((r) => (entered = r)),
    wait = new Promise((r) => (release = r));
  const request = m.withClient(tenant, async () => {
    entered();
    await wait;
    return true;
  });
  await started;
  let closed = false;
  const close = m.onModuleDestroy().then(() => (closed = true));
  await Promise.resolve();
  expect(closed).toBe(false);
  release();
  expect(await request).toBe(true);
  await close;
  expect(m.clients[0].disconnectCount).toBe(1);
  expect(m.pools[0].endCount).toBe(1);
});
