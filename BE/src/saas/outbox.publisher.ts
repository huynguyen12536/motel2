import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import type { OutboxEvent } from "../generated/master-authorized/client.js";
import { ProvisioningBroker } from "./broker.js";
import { provisioningMessage } from "./provisioning.service.js";
@Injectable()
export class OutboxPublisher {
  constructor(@Inject(MasterPrismaService) private readonly master: MasterPrismaService) {}
  async claim(): Promise<{ row: OutboxEvent; token: string } | null> {
    const db = await this.master.client(),
      token = randomUUID();
    const rows = await db.$queryRaw<
      OutboxEvent[]
    >`UPDATE "OutboxEvent" SET "leaseToken"=${token}::uuid,
      "leaseUntil"=now()+interval '30 seconds',"attemptCount"="attemptCount"+1
      WHERE id=(SELECT id FROM "OutboxEvent" WHERE status='PENDING' AND "nextAttemptAt"<=now()
        AND ("leaseUntil" IS NULL OR "leaseUntil"<now()) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`;
    return rows[0] ? { row: rows[0], token } : null;
  }
  async tick(broker: ProvisioningBroker): Promise<boolean> {
    const claim = await this.claim();
    if (!claim) return false;
    const { row, token } = claim,
      db = await this.master.client();
    const parsed = provisioningMessage.safeParse(row.payload);
    if (
      !parsed.success ||
      parsed.data.eventId !== row.id ||
      parsed.data.tenantId !== row.aggregateId ||
      row.eventType !== parsed.data.eventType
    ) {
      await db.outboxEvent.updateMany({
        where: { id: row.id, leaseToken: token },
        data: {
          status: "FAILED",
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: "INVALID_OUTBOX_PAYLOAD",
        },
      });
      return true;
    }
    try {
      await broker.publish(parsed.data, undefined, parsed.data.correlationId);
      await db.outboxEvent.updateMany({
        where: { id: row.id, leaseToken: token },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: null,
        },
      });
    } catch {
      await db.outboxEvent.updateMany({
        where: { id: row.id, leaseToken: token },
        data: {
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(
            Date.now() + Math.min(60000, 1000 * 2 ** Math.min(row.attemptCount, 6)),
          ),
          lastErrorCode: "BROKER_PUBLISH_FAILED",
        },
      });
    }
    return true;
  }
}
