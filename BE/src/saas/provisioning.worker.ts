import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_BACKEND, safeFailure, PipelineError } from "./contracts.js";
import type { DatabaseBackend } from "./contracts.js";
import { ProvisioningService, provisioningMessage } from "./provisioning.service.js";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import { ProvisioningBroker } from "./broker.js";
import type { ConsumeMessage } from "amqplib";
import { env } from "../config/env.js";
import { logger } from "../../logger/index.js";
@Injectable()
export class ProvisioningWorker {
  private readonly aborts = new Set<AbortController>();
  private stopping = false;
  constructor(
    @Inject(ProvisioningService) private readonly operations: ProvisioningService,
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(DATABASE_BACKEND) private readonly backend: DatabaseBackend,
  ) {}
  async handle(raw: ConsumeMessage, broker: ProvisioningBroker) {
    if (this.stopping) throw new Error("WORKER_STOPPING");
    let input: unknown;
    try {
      input = JSON.parse(raw.content.toString());
    } catch {
      input = null;
    }
    const parsed = provisioningMessage.safeParse(input);
    if (!parsed.success) {
      await broker.dead(raw, "INVALID_MESSAGE_SCHEMA");
      broker.ack(raw);
      return;
    }
    const message = parsed.data,
      db = await this.master.client();
    const record = await db.tenantProvisioning.findFirst({
      where: { id: message.provisioningId, tenantId: message.tenantId },
    });
    if (!record || !record.requestedAt) {
      await broker.dead(raw, "UNKNOWN_PROVISIONING_INTENT");
      broker.ack(raw);
      return;
    }
    if (record.status === "SUCCEEDED" || record.status === "FAILED") {
      broker.ack(raw);
      return;
    }
    const claim = await this.operations.claim(message);
    if (!claim) {
      await broker.publish(message, "retry.1", message.correlationId);
      broker.ack(raw);
      return;
    }
    const abort = new AbortController();
    this.aborts.add(abort);
    let heartbeat = Promise.resolve();
    const timer = setInterval(
      () => {
        heartbeat = heartbeat
          .then(async () => {
            if (!(await this.operations.heartbeat(record.id, claim.token))) abort.abort();
          })
          .catch(() => {
            abort.abort();
          });
      },
      Math.floor(env.TENANT_PROVISIONING_LEASE_MS / 3),
    );
    timer.unref();
    try {
      await this.operations.progress(record.id, claim.token, "CREATING_DATABASE");
      const patch = await this.backend.provision(claim.mapping, abort.signal);
      await this.operations.progress(record.id, claim.token, "MIGRATING", patch);
      const mapping = { ...claim.mapping, ...patch };
      const version = await this.backend.migrate(mapping, abort.signal);
      await this.operations.progress(record.id, claim.token, "VERIFYING");
      await this.backend.verify(mapping, abort.signal);
      if (abort.signal.aborted) throw new PipelineError("LEASE_LOST", true);
      await this.operations.complete(record.id, claim.token, version, mapping);
      logger.info(
        {
          event: "tenant.provisioned",
          tenantId: message.tenantId,
          operationId: record.id,
          correlationId: message.correlationId,
        },
        "Tenant infrastructure and identity schema verified",
      );
      broker.ack(raw);
    } catch (error) {
      if (abort.signal.aborted) throw error;
      const safe = safeFailure(error);
      const result = await this.operations.fail(record.id, claim.token, safe.code, safe.retryable);
      logger.warn(
        {
          event: "tenant.provisioning_failed",
          tenantId: message.tenantId,
          operationId: record.id,
          code: safe.code,
        },
        "Provisioning attempt failed",
      );
      if (result.retry)
        await broker.publish(message, "retry." + result.attempt, message.correlationId);
      else await broker.dead(raw, safe.code);
      broker.ack(raw);
    } finally {
      clearInterval(timer);
      await heartbeat;
      this.aborts.delete(abort);
    }
  }
  stop() {
    this.stopping = true;
    for (const abort of this.aborts) abort.abort();
  }
}
