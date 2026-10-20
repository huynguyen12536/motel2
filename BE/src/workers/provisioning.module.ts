import { Module, Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { writeFile } from "node:fs/promises";
import { SaasModule } from "../saas/saas.module.js";
import { SAAS_POLICY } from "../saas/contracts.js";
import type { SaasPolicy } from "../saas/contracts.js";
import { ProvisioningBroker } from "../saas/broker.js";
import { OutboxPublisher } from "../saas/outbox.publisher.js";
import { ProvisioningWorker } from "../saas/provisioning.worker.js";
import { ProvisioningService } from "../saas/provisioning.service.js";
import { env } from "../config/env.js";
import { logger } from "../../logger/index.js";
import { LifecycleService } from "../infrastructure/logging/lifecycle.service.js";
export const workerHealthPath = "/tmp/motel-provisioning-worker-health.json";
@Injectable()
export class WorkerRuntime implements OnModuleDestroy {
  private stopped = false;
  private timer?: NodeJS.Timeout;
  private pending?: Promise<void>;
  private lastReconcile = 0;
  constructor(
    @Inject(SAAS_POLICY) private readonly policy: SaasPolicy,
    @Inject(ProvisioningBroker) private readonly broker: ProvisioningBroker,
    @Inject(OutboxPublisher) private readonly publisher: OutboxPublisher,
    @Inject(ProvisioningWorker) private readonly consumer: ProvisioningWorker,
    @Inject(ProvisioningService) private readonly operations: ProvisioningService,
  ) {}
  start() {
    if (!this.pending && !this.stopped) this.pending = this.loop();
  }
  private async loop() {
    let healthy = !this.policy.provisioningEnabled,
      queueDepth: number | null = null;
    try {
      if (this.policy.provisioningEnabled) {
        await this.broker.consume((message) => this.consumer.handle(message, this.broker));
        for (let n = 0; n < 10; n++) if (!(await this.publisher.tick(this.broker))) break;
        if (Date.now() - this.lastReconcile > 30000) {
          await this.operations.reconcile();
          this.lastReconcile = Date.now();
        }
        const info = await (await this.broker.ready()).checkQueue(this.broker.config.queue);
        queueDepth = info.messageCount;
        healthy = true;
      }
    } catch {
      logger.warn(
        { event: "worker.poll_failed" },
        "Provisioning worker is unavailable; retry scheduled",
      );
    }
    await writeFile(
      workerHealthPath,
      JSON.stringify({
        pid: process.pid,
        at: Date.now(),
        healthy,
        status: this.policy.provisioningEnabled ? "enabled" : "disabled",
        queueDepth,
      }),
    ).catch(() => {});
    if (!this.stopped)
      this.timer = setTimeout(() => {
        this.pending = this.loop();
      }, env.TENANT_PROVISIONING_POLL_MS);
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.consumer.stop();
    await this.pending;
    await this.broker.close();
  }
}
@Module({ imports: [SaasModule.register()], providers: [WorkerRuntime, LifecycleService] })
export class ProvisioningWorkerModule {}
