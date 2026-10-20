import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import type { TenantMigrationRun } from "../generated/master-authorized/client.js";
import { DATABASE_BACKEND, SAAS_POLICY, safeFailure } from "./contracts.js";
import type { DatabaseBackend, SaasPolicy } from "./contracts.js";
import { env } from "../config/env.js";
@Injectable()
export class TenantMigrationOrchestrator {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(DATABASE_BACKEND) private readonly backend: DatabaseBackend,
    @Inject(SAAS_POLICY) private readonly policy: SaasPolicy,
  ) {}
  async create(authorizationRef: string, tenantIds?: string[]) {
    if (!this.policy.rolloutEnabled)
      throw new ServiceUnavailableException("Tenant migration rollout is disabled");
    const db = await this.master.client(),
      rolloutId = randomUUID();
    try {
      return await db.$transaction(async (tx) => {
        const tenants = await tx.tenant.findMany({
          where: { status: "ACTIVE", ...(tenantIds ? { id: { in: tenantIds } } : {}) },
          select: { id: true },
        });
        if (!tenants.length || (tenantIds && new Set(tenantIds).size !== tenants.length))
          throw new ConflictException("Rollout requires active provisioned tenants");
        await tx.tenantMigrationRun.createMany({
          data: tenants.map((t) => ({ rolloutId, tenantId: t.id, authorizationRef })),
        });
        await tx.securityAuditEvent.create({
          data: {
            action: "MIGRATION_ROLLOUT_CREATED",
            actorId: "platform-admin",
            correlationId: rolloutId,
          },
        });
        return { rolloutId, tenants: tenants.length, status: "PENDING" };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        throw new ConflictException("A tenant already has a pending migration rollout");
      throw error;
    }
  }
  async list(rolloutId: string) {
    const db = await this.master.client();
    return db.tenantMigrationRun.findMany({
      where: { rolloutId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        tenantId: true,
        status: true,
        attemptCount: true,
        schemaVersion: true,
        lastErrorCode: true,
        completedAt: true,
      },
    });
  }
  async run(rolloutId: string) {
    if (!this.policy.rolloutEnabled)
      throw new ServiceUnavailableException("Tenant migration rollout is disabled");
    const db = await this.master.client();
    await db.tenantMigrationRun.updateMany({
      where: {
        rolloutId,
        status: "RUNNING",
        attemptCount: { gte: 3 },
        leaseUntil: { lt: new Date() },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode: "MIGRATION_ATTEMPT_LIMIT_REACHED",
      },
    });
    const ids = (
      await db.tenantMigrationRun.findMany({
        where: {
          rolloutId,
          status: { in: ["PENDING", "FAILED", "RUNNING"] },
          attemptCount: { lt: 3 },
        },
        select: { id: true },
      })
    ).map((r) => r.id);
    const work = async () => {
      for (;;) {
        const id = ids.shift();
        if (!id) return;
        const token = randomUUID();
        const claimed = await db.$queryRaw<
          TenantMigrationRun[]
        >`UPDATE "TenantMigrationRun" SET status='RUNNING',"attemptCount"="attemptCount"+1,
          "leaseToken"=${token}::uuid,"leaseUntil"=now()+${env.TENANT_PROVISIONING_LEASE_MS}*interval '1 millisecond'
          WHERE id=${id}::uuid AND status IN ('PENDING','FAILED','RUNNING') AND "attemptCount"<3 AND ("leaseUntil" IS NULL OR "leaseUntil"<now())
          AND EXISTS(SELECT 1 FROM "Tenant" WHERE id="TenantMigrationRun"."tenantId" AND status='ACTIVE')
          AND NOT EXISTS(SELECT 1 FROM "TenantMigrationRun" other WHERE other."tenantId"="TenantMigrationRun"."tenantId"
            AND other.id<>"TenantMigrationRun".id AND other.status IN ('PENDING','RUNNING')) RETURNING *`.catch(
          (error: unknown) => {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "P2010" &&
              "meta" in error &&
              error.meta &&
              typeof error.meta === "object" &&
              "code" in error.meta &&
              error.meta.code === "23505"
            )
              return [];
            throw error;
          },
        );
        const row = claimed[0];
        if (!row) continue;
        const abort = new AbortController();
        let beat = Promise.resolve();
        const timer = setInterval(() => {
          beat = beat
            .then(async () => {
              const n =
                await db.$executeRaw`UPDATE "TenantMigrationRun" SET "leaseUntil"=now()+${env.TENANT_PROVISIONING_LEASE_MS}*interval '1 millisecond'
            WHERE id=${id}::uuid AND "leaseToken"=${token}::uuid AND "leaseUntil">now()`;
              if (n !== 1) abort.abort();
            })
            .catch(() => abort.abort());
        }, env.TENANT_PROVISIONING_LEASE_MS / 3);
        try {
          const mapping = await db.tenantDatabase.findUniqueOrThrow({
            where: { tenantId: row.tenantId },
          });
          const version = await this.backend.migrate(mapping, abort.signal);
          await this.backend.verify(mapping, abort.signal);
          if (abort.signal.aborted) throw new Error("LEASE_LOST");
          await db.$transaction(async (tx) => {
            const result = await tx.tenantMigrationRun.updateMany({
              where: { id, leaseToken: token, leaseUntil: { gt: new Date() }, status: "RUNNING" },
              data: {
                status: "SUCCEEDED",
                schemaVersion: version,
                completedAt: new Date(),
                leaseToken: null,
                leaseUntil: null,
                lastErrorCode: null,
              },
            });
            if (result.count !== 1) throw new Error("LEASE_LOST");
            await tx.tenantDatabase.update({
              where: { tenantId: row.tenantId },
              data: { schemaVersion: version },
            });
          });
        } catch (error) {
          if (!abort.signal.aborted)
            await db.tenantMigrationRun.updateMany({
              where: { id, leaseToken: token, leaseUntil: { gt: new Date() } },
              data: {
                status: "FAILED",
                lastErrorCode: safeFailure(error).code,
                completedAt: new Date(),
                leaseToken: null,
                leaseUntil: null,
              },
            });
        } finally {
          clearInterval(timer);
          await beat;
        }
      }
    };
    await Promise.all(Array.from({ length: env.TENANT_PROVISIONING_CONCURRENCY }, work));
    return this.list(rolloutId);
  }
}
