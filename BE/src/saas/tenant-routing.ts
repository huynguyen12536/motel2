import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/tenant-authorized/client.js";
import type { TenantDatabase } from "../generated/master-authorized/client.js";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import { RedisService } from "../infrastructure/cache/redis.service.js";
import { env } from "../config/env.js";
import { TENANT_CONNECTIONS } from "./contracts.js";
import type { TenantConnections } from "./contracts.js";
import { digest } from "./security.js";
import { pgConfig } from "./tenant-migrator.js";

export interface ResolvedTenant {
  id: string;
  code: string;
  mapping: TenantDatabase;
  revision: string;
}
@Injectable()
export class TenantResolver {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}
  async resolve(identity: { id: string } | { code: string }): Promise<ResolvedTenant> {
    // Status/mapping revision are authoritative on every request, including Redis hits/failures.
    const db = await this.master.client();
    const tenant = await db.tenant.findUnique({ where: identity, include: { database: true } });
    if (
      !tenant ||
      tenant.status !== "ACTIVE" ||
      !tenant.database?.provisionedAt ||
      !tenant.database.schemaVersion
    )
      throw new UnauthorizedException("Tenant is unavailable");
    const mapping = tenant.database;
    if (
      !mapping.databaseName ||
      !mapping.databaseHost ||
      !mapping.applicationRole ||
      !mapping.credentialVersion ||
      !mapping.ownershipToken
    )
      throw new ServiceUnavailableException("Tenant database mapping is incomplete");
    const revision = digest(
      tenant.updatedAt.toISOString() + mapping.updatedAt.toISOString() + JSON.stringify(mapping),
    );
    const key = "tenant:metadata:" + tenant.id;
    const cached = await this.redis.get(key);
    // Only non-sensitive identity/revision data is cached. Routing never trusts cached credentials.
    if (cached !== JSON.stringify({ id: tenant.id, code: tenant.code, revision }))
      await this.redis.set(
        key,
        JSON.stringify({ id: tenant.id, code: tenant.code, revision }),
        env.TENANT_CACHE_TTL_SECONDS,
      );
    return { id: tenant.id, code: tenant.code, mapping, revision };
  }
  async invalidate(tenantId: string) {
    await this.redis.invalidate("tenant:metadata:" + tenantId);
  }
}
interface Entry {
  key: string;
  tenantId: string;
  promise: Promise<PrismaClient>;
  pool?: Pool;
  client?: PrismaClient;
  active: number;
  lastUsed: number;
  drain?: () => void;
  disposal?: Promise<void>;
}
@Injectable()
export class TenantPrismaManager implements OnModuleDestroy {
  private readonly entries = new Map<string, Entry>();
  private stopped = false;
  private closing?: Promise<void>;
  private admission: Promise<void> = Promise.resolve();
  private readonly timer: NodeJS.Timeout;
  constructor(@Inject(TENANT_CONNECTIONS) private readonly connections: TenantConnections) {
    this.timer = setInterval(
      () => {
        void this.evict().catch(() => {});
      },
      Math.min(10000, env.TENANT_CLIENT_IDLE_MS),
    );
    this.timer.unref();
  }
  protected createPool(url: string, tls: boolean) {
    return new Pool({ ...pgConfig(url, tls), max: env.TENANT_POOL_MAX, idleTimeoutMillis: 30000 });
  }
  protected createClient(pool: Pool) {
    return new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: false }) });
  }
  private async initialize(entry: Entry, url: string, tls: boolean) {
    try {
      entry.pool = this.createPool(url, tls);
      entry.pool.on("error", () => undefined);
      entry.client = this.createClient(entry.pool);
      await entry.client.$connect();
      const proof = await entry.client.tenantBootstrap.findUnique({
        where: { id: 1 },
        select: { tenantId: true },
      });
      if (proof?.tenantId !== entry.tenantId) throw new Error("TENANT_IDENTITY_MISMATCH");
      return entry.client;
    } catch {
      await this.dispose(entry);
      if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
      throw new ServiceUnavailableException("Tenant database is unavailable");
    }
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.admission;
    let release!: () => void;
    this.admission = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
  private async dispose(entry: Entry) {
    entry.disposal ??= (async () => {
      try {
        await entry.client?.$disconnect();
      } catch {
        /* Sanitized at request boundary. */
      } finally {
        await entry.pool?.end().catch(() => {});
      }
    })();
    await entry.disposal;
  }
  async withClient<T>(
    tenant: ResolvedTenant,
    work: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (this.stopped) throw new ServiceUnavailableException("Tenant connections are stopping");
    const target = await this.connections.resolve(tenant.mapping);
    if (this.stopped) throw new ServiceUnavailableException("Tenant connections are stopping");
    const key = tenant.id + ":" + tenant.revision + ":" + target.fingerprint;
    const entry = await this.exclusive(async () => {
      if (this.stopped) throw new ServiceUnavailableException("Tenant connections are stopping");
      let entry = this.entries.get(key);
      if (!entry) {
        // Reserve synchronously before awaiting initialization; concurrent first access shares it.
        if (this.entries.size >= env.TENANT_CLIENT_MAX) {
          const victim = [...this.entries.values()]
            .filter((x) => x.active === 0)
            .sort((a, b) => a.lastUsed - b.lastUsed)[0];
          if (!victim) throw new ServiceUnavailableException("Tenant connection capacity reached");
          this.entries.delete(victim.key);
          await victim.promise.catch(() => {});
          await this.dispose(victim);
          if (this.stopped)
            throw new ServiceUnavailableException("Tenant connections are stopping");
        }
        entry = {
          key,
          tenantId: tenant.id,
          promise: undefined as unknown as Promise<PrismaClient>,
          active: 0,
          lastUsed: Date.now(),
        };
        this.entries.set(key, entry);
        entry.promise = this.initialize(entry, target.url, target.tls);
      }
      entry.active++;
      entry.lastUsed = Date.now();
      return entry;
    });
    try {
      return await work(await entry.promise);
    } finally {
      entry.active--;
      entry.lastUsed = Date.now();
      if (entry.active === 0) entry.drain?.();
    }
  }
  async evict() {
    await this.exclusive(async () => {
      if (this.stopped) return;
      for (const entry of this.entries.values())
        if (entry.active === 0 && Date.now() - entry.lastUsed >= env.TENANT_CLIENT_IDLE_MS) {
          this.entries.delete(entry.key);
          await entry.promise.catch(() => {});
          await this.dispose(entry);
        }
    });
  }
  metrics() {
    return {
      clients: this.entries.size,
      busy: [...this.entries.values()].filter((x) => x.active > 0).length,
      totalPoolConnections: [...this.entries.values()].reduce(
        (n, x) => n + (x.pool?.totalCount ?? 0),
        0,
      ),
    };
  }
  onModuleDestroy(): Promise<void> {
    if (!this.closing) {
      this.stopped = true;
      clearInterval(this.timer);
      this.closing = (async () => {
        await this.admission;
        for (const entry of this.entries.values()) {
          if (entry.active > 0)
            await new Promise<void>((resolve) => {
              entry.drain = resolve;
            });
          await entry.promise.catch(() => {});
          await this.dispose(entry);
        }
        this.entries.clear();
      })();
    }
    return this.closing;
  }
}
@Injectable()
export class TenantTechnicalRepository {
  constructor(
    @Inject(TenantResolver) private readonly resolver: TenantResolver,
    @Inject(TenantPrismaManager) private readonly manager: TenantPrismaManager,
  ) {}
  async identity(authenticatedTenantId: string) {
    const tenant = await this.resolver.resolve({ id: authenticatedTenantId });
    return this.manager.withClient(tenant, (client) =>
      client.tenantBootstrap.findUniqueOrThrow({
        where: { id: 1 },
        select: { tenantId: true, schemaVersion: true },
      }),
    );
  }
}
