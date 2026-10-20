import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import { env } from "../config/env.js";
import { SAAS_POLICY } from "./contracts.js";
import type { SaasPolicy } from "./contracts.js";
import { databaseName } from "./security.js";
import { assertTenantTransition } from "../modules/tenants/tenant-lifecycle.js";
import type {
  Prisma,
  TenantProvisioning,
  TenantDatabase,
} from "../generated/master-authorized/client.js";

export const provisioningMessage = z.strictObject({
  eventId: z.uuid(),
  eventType: z.literal("tenant.provision.requested"),
  schemaVersion: z.literal(1),
  tenantId: z.uuid(),
  provisioningId: z.uuid(),
  correlationId: z.uuid(),
});
export type ProvisioningMessage = z.infer<typeof provisioningMessage>;
export const safeOperation = (row: TenantProvisioning) => ({
  id: row.id,
  tenantId: row.tenantId,
  status: row.status,
  progress: row.progress,
  attemptCount: row.attemptCount,
  createdAt: row.createdAt,
  requestedAt: row.requestedAt,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  errorCode: row.lastErrorCode,
  errorSummary: row.lastErrorCode ? "Provisioning requires retry or operator review" : null,
});
async function enqueue(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operationId: string,
  key: string,
) {
  const eventId = randomUUID();
  const payload: ProvisioningMessage = {
    eventId,
    eventType: "tenant.provision.requested",
    schemaVersion: 1,
    tenantId,
    provisioningId: operationId,
    correlationId: operationId,
  };
  await tx.outboxEvent.upsert({
    where: { deduplicationKey: key },
    create: {
      id: eventId,
      eventType: payload.eventType,
      aggregateId: tenantId,
      payload,
      deduplicationKey: key,
    },
    update: {},
  });
}
@Injectable()
export class ProvisioningService {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(SAAS_POLICY) private readonly policy: SaasPolicy,
  ) {}
  async request(tenantId: string, retry = false) {
    if (!this.policy.provisioningEnabled)
      throw new ServiceUnavailableException("Tenant provisioning is disabled");
    if (!this.policy.projectId || !this.policy.branchId)
      throw new ServiceUnavailableException("Provisioning target is not authorized");
    const db = await this.master.client();
    try {
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenantId}::uuid FOR UPDATE`;
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) throw new NotFoundException("Tenant not found");
        const active = await tx.tenantProvisioning.findFirst({
          where: { tenantId, status: { in: ["PENDING", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active?.requestedAt) {
          if (tenant.status !== "PROVISIONING")
            throw new ConflictException("Tenant lifecycle does not permit this operation");
          if (retry) throw new ConflictException("Provisioning is already in progress");
          return { tenantId, provisioningId: active.id, status: active.status };
        }
        if (
          retry ? tenant.status !== "PROVISIONING_FAILED" : tenant.status !== "PENDING_PROVISIONING"
        )
          throw new ConflictException("Tenant lifecycle does not permit this operation");
        if (
          retry &&
          !(await tx.tenantProvisioning.findFirst({ where: { tenantId, status: "FAILED" } }))
        )
          throw new ConflictException("No failed operation is available to retry");
        assertTenantTransition(tenant.status, "PROVISIONING", false, retry);
        // Lock a singleton budget key; no external calls occur in this short transaction.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(71273101)::text`;
        const existing = await tx.tenantDatabase.findUnique({ where: { tenantId } });
        if (!existing) {
          const count = await tx.tenantDatabase.count({
            where: { neonProjectId: this.policy.projectId, neonBranchId: this.policy.branchId },
          });
          if (count >= this.policy.maxDatabases)
            throw new ConflictException("Authorized tenant database budget exhausted");
          const name = databaseName(tenantId, this.policy.prefix);
          await tx.tenantDatabase.create({
            data: {
              tenantId,
              databaseName: name,
              provider: "neon",
              neonProjectId: this.policy.projectId,
              neonBranchId: this.policy.branchId,
              ownershipToken: randomUUID(),
              applicationRole:
                "app_" + tenantId.replaceAll("-", "") + "_" + this.policy.credentialVersion,
              credentialVersion: this.policy.credentialVersion,
            },
          });
        } else if (
          existing.neonProjectId !== this.policy.projectId ||
          existing.neonBranchId !== this.policy.branchId ||
          !existing.ownershipToken ||
          !existing.databaseName
        )
          throw new ConflictException("Reserved database identity needs operator review");
        const operation = active ?? (await tx.tenantProvisioning.create({ data: { tenantId } }));
        await tx.tenantProvisioning.update({
          where: { id: operation.id },
          data: { requestedAt: new Date(), progress: "QUEUED" },
        });
        await tx.tenant.update({ where: { id: tenantId }, data: { status: "PROVISIONING" } });
        await enqueue(tx, tenantId, operation.id, "request:" + operation.id);
        await tx.securityAuditEvent.create({
          data: {
            tenantId,
            action: retry ? "PROVISION_RETRY" : "PROVISION_REQUEST",
            actorId: "platform-admin",
            targetId: operation.id,
            correlationId: operation.id,
          },
        });
        return { tenantId, provisioningId: operation.id, status: "PENDING" };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        throw new ConflictException("Provisioning operation or database identity already exists");
      throw error;
    }
  }
  async history(tenantId: string, page: number, limit: number) {
    const db = await this.master.client();
    if (!(await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })))
      throw new NotFoundException("Tenant not found");
    const [items, total] = await db.$transaction(
      [
        db.tenantProvisioning.findMany({
          where: { tenantId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.tenantProvisioning.count({ where: { tenantId } }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { items: items.map(safeOperation), total, page, limit };
  }
  async detail(tenantId: string, id: string) {
    const row = await (
      await this.master.client()
    ).tenantProvisioning.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Provisioning operation not found");
    return safeOperation(row);
  }
  async reconcile(): Promise<number> {
    const db = await this.master.client();
    return db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TenantProvisioning[]>`SELECT * FROM "TenantProvisioning"
        WHERE "requestedAt" IS NOT NULL AND status IN ('PENDING','RUNNING')
        AND "nextAttemptAt"<=now() AND ("leaseUntil" IS NULL OR "leaseUntil"<now())
        ORDER BY "nextAttemptAt" LIMIT 20 FOR UPDATE SKIP LOCKED`;
      for (const row of rows) {
        if (row.attemptCount >= env.TENANT_PROVISIONING_MAX_ATTEMPTS) {
          await tx.tenantProvisioning.update({
            where: { id: row.id },
            data: {
              status: "FAILED",
              progress: "FAILED",
              completedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
              lastErrorCode: "ATTEMPT_LIMIT_REACHED",
              lastErrorMessage: "Operator review required",
            },
          });
          await tx.tenant.updateMany({
            where: { id: row.tenantId, status: "PROVISIONING" },
            data: { status: "PROVISIONING_FAILED" },
          });
        } else if (
          !(await tx.outboxEvent.findFirst({
            where: {
              aggregateId: row.tenantId,
              status: "PENDING",
              payload: { path: ["provisioningId"], equals: row.id },
            },
            select: { id: true },
          }))
        )
          await enqueue(
            tx,
            row.tenantId,
            row.id,
            "reconcile:" + row.id + ":" + row.attemptCount + ":" + Math.floor(Date.now() / 30000),
          );
      }
      return rows.length;
    });
  }
  async claim(
    message: ProvisioningMessage,
  ): Promise<{ operation: TenantProvisioning; mapping: TenantDatabase; token: string } | null> {
    const db = await this.master.client(),
      token = randomUUID();
    return db.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<TenantProvisioning[]>`UPDATE "TenantProvisioning"
        SET status='RUNNING',"attemptCount"="attemptCount"+1,"leaseToken"=${token}::uuid,
        "leaseUntil"=now()+${env.TENANT_PROVISIONING_LEASE_MS}*interval '1 millisecond',
        "startedAt"=COALESCE("startedAt",now()),"updatedAt"=now()
        WHERE id=${message.provisioningId}::uuid AND "tenantId"=${message.tenantId}::uuid
        AND "requestedAt" IS NOT NULL AND status IN ('PENDING','RUNNING') AND "nextAttemptAt"<=now()
        AND ("leaseUntil" IS NULL OR "leaseUntil"<now()) AND "attemptCount"<${env.TENANT_PROVISIONING_MAX_ATTEMPTS}
        AND EXISTS(SELECT 1 FROM "Tenant" t WHERE t.id="TenantProvisioning"."tenantId" AND t.status='PROVISIONING')
        RETURNING *`;
      if (!claimed[0]) return null;
      const mapping = await tx.tenantDatabase.findUniqueOrThrow({
        where: { tenantId: message.tenantId },
      });
      return { operation: claimed[0], mapping, token };
    });
  }
  async heartbeat(id: string, token: string): Promise<boolean> {
    const db = await this.master.client();
    return (
      (await db.$executeRaw`UPDATE "TenantProvisioning" SET "leaseUntil"=now()+${env.TENANT_PROVISIONING_LEASE_MS}*interval '1 millisecond'
      WHERE id=${id}::uuid AND "leaseToken"=${token}::uuid AND status='RUNNING' AND "leaseUntil">now()`) ===
      1
    );
  }
  async progress(id: string, token: string, progress: string, patch?: Partial<TenantDatabase>) {
    const db = await this.master.client();
    await db.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<
        Array<{ tenantId: string }>
      >`UPDATE "TenantProvisioning" SET progress=${progress},"updatedAt"=now()
        WHERE id=${id}::uuid AND "leaseToken"=${token}::uuid AND status='RUNNING' AND "leaseUntil">now() RETURNING "tenantId"`;
      if (!updated[0]) throw new Error("LEASE_LOST");
      if (patch)
        await tx.tenantDatabase.update({
          where: { tenantId: updated[0].tenantId },
          data: {
            neonDatabaseId: patch.neonDatabaseId,
            databaseHost: patch.databaseHost,
            databasePort: patch.databasePort,
          },
        });
    });
  }
  async complete(id: string, token: string, schemaVersion: string, verified: TenantDatabase) {
    const db = await this.master.client();
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ tenantId: string }>
      >`UPDATE "TenantProvisioning" SET status='SUCCEEDED',progress='VERIFIED',
        "completedAt"=now(),"leaseToken"=NULL,"leaseUntil"=NULL,"lastErrorCode"=NULL,"lastErrorMessage"=NULL,"updatedAt"=now()
        WHERE id=${id}::uuid AND "leaseToken"=${token}::uuid AND status='RUNNING' AND "leaseUntil">now() RETURNING "tenantId"`;
      const tenantId = rows[0]?.tenantId;
      if (!tenantId) throw new Error("LEASE_LOST");
      const mapping = await tx.tenantDatabase.findUniqueOrThrow({ where: { tenantId } });
      for (const field of [
        "databaseName",
        "neonProjectId",
        "neonBranchId",
        "neonDatabaseId",
        "databaseHost",
        "databasePort",
        "applicationRole",
        "credentialVersion",
        "ownershipToken",
      ] as const)
        if (mapping[field] !== verified[field]) throw new Error("VERIFIED_MAPPING_CHANGED");
      if (
        !mapping.databaseHost ||
        !mapping.applicationRole ||
        !mapping.ownershipToken ||
        !mapping.credentialVersion
      )
        throw new Error("INCOMPLETE_MAPPING");
      await tx.tenantDatabase.update({
        where: { tenantId },
        data: { schemaVersion, provisionedAt: new Date() },
      });
      if (
        (
          await tx.tenant.updateMany({
            where: { id: tenantId, status: "PROVISIONING" },
            data: { status: "ACTIVE", activatedAt: new Date() },
          })
        ).count !== 1
      )
        throw new Error("INVALID_ACTIVATION_STATE");
      await tx.securityAuditEvent.create({
        data: {
          tenantId,
          action: "TENANT_ACTIVATED",
          actorId: "provisioning-worker",
          correlationId: id,
        },
      });
    });
  }
  async fail(id: string, token: string, code: string, retryable: boolean) {
    const db = await this.master.client();
    return db.$transaction(async (tx) => {
      const row = await tx.tenantProvisioning.findFirst({
        where: { id, leaseToken: token, status: "RUNNING", leaseUntil: { gt: new Date() } },
      });
      if (!row) throw new Error("LEASE_LOST");
      const retry = retryable && row.attemptCount < env.TENANT_PROVISIONING_MAX_ATTEMPTS;
      const delay = env.TENANT_PROVISIONING_RETRY_MS * 2 ** (row.attemptCount - 1);
      const changed = await tx.tenantProvisioning.updateMany({
        where: { id, leaseToken: token, status: "RUNNING", leaseUntil: { gt: new Date() } },
        data: {
          status: retry ? "PENDING" : "FAILED",
          progress: retry ? "RETRY_WAIT" : "FAILED",
          nextAttemptAt: new Date(Date.now() + delay),
          completedAt: retry ? null : new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: code,
          lastErrorMessage: "Provisioning requires retry or operator review",
        },
      });
      if (changed.count !== 1) throw new Error("LEASE_LOST");
      if (!retry)
        await tx.tenant.updateMany({
          where: { id: row.tenantId, status: "PROVISIONING" },
          data: { status: "PROVISIONING_FAILED" },
        });
      return { retry, attempt: row.attemptCount };
    });
  }
}
