import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import type { PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/master-authorized/client.js";
import { env } from "../../../config/env.js";

export function masterPoolConfig(): PoolConfig {
  if (!env.databaseUrl) throw new ServiceUnavailableException("Master database is not configured");
  const url = new URL(env.databaseUrl);
  const tls =
    url.hostname.endsWith(".neon.tech") ||
    env.POSTGRES_SSL ||
    ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  if (tls)
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    max: env.POSTGRES_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
    ...(tls ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

@Injectable()
export class MasterPrismaService implements OnModuleDestroy {
  private pool?: Pool;
  private adapter?: PrismaPg;
  private prisma?: PrismaClient;
  private initialization?: Promise<PrismaClient>;
  private closing?: Promise<void>;
  private stopped = false;

  // Factory methods allow lifecycle tests without opening a database connection.
  protected createPool(config: PoolConfig) {
    return new Pool(config);
  }
  protected createAdapter(pool: Pool) {
    return new PrismaPg(pool, { disposeExternalPool: false });
  }
  protected createClient(adapter: PrismaPg) {
    return new PrismaClient({ adapter });
  }

  client(): Promise<PrismaClient> {
    if (this.stopped)
      return Promise.reject(new ServiceUnavailableException("Master database is stopping"));
    if (!this.initialization) this.initialization = this.initialize();
    return this.initialization;
  }
  private async initialize(): Promise<PrismaClient> {
    try {
      this.pool = this.createPool(masterPoolConfig());
      // Avoid unhandled pool errors; details may include connection information.
      this.pool.on("error", () => undefined);
      this.adapter = this.createAdapter(this.pool);
      this.prisma = this.createClient(this.adapter);
      await this.prisma.$connect();
      return this.prisma;
    } catch {
      await this.release();
      // Retry with fresh, exclusively owned resources on the next request.
      this.initialization = undefined;
      throw new ServiceUnavailableException("Master database is unavailable");
    }
  }
  private async release(): Promise<void> {
    try {
      await this.prisma?.$disconnect();
    } catch {
      /* Sanitized at request boundary. */
    } finally {
      try {
        await this.pool?.end();
      } catch {
        /* A failed initialization may already close the socket. */
      }
      this.prisma = undefined;
      this.adapter = undefined;
      this.pool = undefined;
    }
  }
  async ping(): Promise<boolean> {
    const client = await this.client();
    const rows = await client.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    return rows[0]?.ok === 1;
  }
  onModuleDestroy(): Promise<void> {
    if (!this.closing) {
      this.stopped = true;
      this.closing = (async () => {
        await this.initialization?.catch(() => undefined);
        await this.release();
      })();
    }
    return this.closing;
  }
}
