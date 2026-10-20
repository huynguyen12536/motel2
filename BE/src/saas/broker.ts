import { connect } from "amqplib";
import type { ChannelModel, ConfirmChannel, ConsumeMessage, Options } from "amqplib";
import { randomUUID } from "node:crypto";
import { rabbitmqConfig } from "../infrastructure/messaging/rabbitmq/rabbitmq.config.js";
import { env } from "../config/env.js";
import { digest } from "./security.js";
export interface Topology {
  exchange: string;
  queue: string;
  retry: string;
  dlq: string;
  retryMs: number;
  attempts: number;
}
export function topology(): Topology {
  return {
    exchange: env.RABBITMQ_PROVISIONING_EXCHANGE,
    queue: env.RABBITMQ_PROVISIONING_QUEUE,
    retry: env.RABBITMQ_PROVISIONING_RETRY_QUEUE,
    dlq: env.RABBITMQ_PROVISIONING_DLQ,
    retryMs: env.TENANT_PROVISIONING_RETRY_MS,
    attempts: env.TENANT_PROVISIONING_MAX_ATTEMPTS,
  };
}
export const requestedKey = "tenant.provision.requested";
export class ProvisioningBroker {
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private opening?: Promise<ConfirmChannel>;
  private stopped = false;
  private generation = 0;
  private consumerTag?: string;
  private readonly inflight = new Set<Promise<void>>();
  constructor(
    readonly config: Topology = topology(),
    private readonly settings: Options.Connect = rabbitmqConfig,
  ) {}
  async ready(): Promise<ConfirmChannel> {
    if (this.stopped) throw new Error("BROKER_STOPPED");
    if (this.channel) return this.channel;
    if (!this.opening) {
      const generation = ++this.generation;
      this.opening = this.open(generation).catch((e) => {
        if (this.generation === generation) this.opening = undefined;
        throw e;
      });
    }
    return this.opening;
  }
  private async open(generation: number): Promise<ConfirmChannel> {
    const connection = await connect(this.settings, { timeout: 5000 });
    this.connection = connection;
    connection.on("error", () => undefined);
    connection.on("close", () => {
      if (this.connection !== connection || generation !== this.generation) return;
      this.channel = undefined;
      this.connection = undefined;
      this.opening = undefined;
      this.consumerTag = undefined;
    });
    const channel = await connection.createConfirmChannel().catch(async (error) => {
      await connection.close().catch(() => {});
      throw error;
    });
    channel.on("error", () => undefined);
    channel.on("close", () => {
      if (this.connection === connection && generation === this.generation) {
        this.channel = undefined;
        this.opening = undefined;
        this.consumerTag = undefined;
      }
      void connection.close().catch(() => {});
    });
    try {
      await channel.assertExchange(this.config.exchange, "direct", { durable: true });
      const quorum = {
        "x-queue-type": "quorum",
        "x-overflow": "reject-publish",
        "x-max-length": 10000,
      };
      await channel.assertQueue(this.config.queue, {
        durable: true,
        arguments: {
          ...quorum,
          "x-delivery-limit": 20,
          "x-dead-letter-exchange": this.config.exchange,
          "x-dead-letter-routing-key": "dead",
          "x-dead-letter-strategy": "at-least-once",
        },
      });
      await channel.bindQueue(this.config.queue, this.config.exchange, requestedKey);
      await channel.assertQueue(this.config.dlq, { durable: true, arguments: quorum });
      await channel.bindQueue(this.config.dlq, this.config.exchange, "dead");
      for (let attempt = 1; attempt <= this.config.attempts; attempt++) {
        const queue = this.retryQueue(attempt);
        await channel.assertQueue(queue, {
          durable: true,
          arguments: {
            ...quorum,
            "x-message-ttl": this.config.retryMs * 2 ** (attempt - 1),
            "x-dead-letter-exchange": this.config.exchange,
            "x-dead-letter-routing-key": requestedKey,
            "x-dead-letter-strategy": "at-least-once",
          },
        });
        await channel.bindQueue(queue, this.config.exchange, "retry." + attempt);
      }
      await channel.prefetch(env.TENANT_PROVISIONING_CONCURRENCY);
      if (this.stopped || generation !== this.generation) {
        await connection.close();
        throw new Error("BROKER_STOPPED");
      }
      this.channel = channel;
      return channel;
    } catch (e) {
      await connection.close().catch(() => {});
      throw e;
    }
  }
  retryQueue(attempt: number) {
    return this.config.retry + (attempt === 1 ? "" : "." + attempt);
  }
  async publish(
    payload: unknown,
    key = requestedKey,
    correlationId: string = randomUUID(),
  ): Promise<void> {
    const channel = await this.ready();
    const messageId =
      payload &&
      typeof payload === "object" &&
      "eventId" in payload &&
      typeof payload.eventId === "string"
        ? payload.eventId
        : randomUUID();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.off("return", returned);
        channel.off("close", closed);
        if (error) reject(new Error("BROKER_CONFIRM_FAILED"));
        else resolve();
      };
      const returned = (message: ConsumeMessage) => {
        if (message.properties.messageId === messageId) finish(new Error("UNROUTABLE"));
      };
      const closed = () => finish(new Error("CHANNEL_CLOSED"));
      channel.on("return", returned);
      channel.once("close", closed);
      const timer = setTimeout(() => finish(new Error("CONFIRM_TIMEOUT")), 10000);
      try {
        channel.publish(
          this.config.exchange,
          key,
          Buffer.from(JSON.stringify(payload)),
          {
            persistent: true,
            mandatory: true,
            contentType: "application/json",
            type: "tenant.provision.requested",
            messageId,
            correlationId,
          },
          (error) => finish(error),
        );
      } catch (error) {
        finish(error);
      }
    });
  }
  async dead(message: ConsumeMessage, reason: string) {
    // Do not copy untrusted/raw payloads into the DLQ: they may contain secrets.
    await this.publish(
      { reason, fingerprint: digest(message.content.toString()), eventId: randomUUID() },
      "dead",
    );
  }
  async consume(handler: (message: ConsumeMessage) => Promise<void>) {
    if (this.consumerTag) return;
    const channel = await this.ready();
    const result = await channel.consume(
      this.config.queue,
      (message) => {
        if (!message) {
          this.consumerTag = undefined;
          return;
        }
        const work = handler(message)
          .catch(async () => {
            // Closing the channel preserves the unacknowledged original for broker redelivery.
            // The runtime reconnect interval prevents a tight requeue loop.
            await channel.close().catch(() => {});
          })
          .finally(() => this.inflight.delete(work));
        this.inflight.add(work);
      },
      { noAck: false },
    );
    this.consumerTag = result.consumerTag;
  }
  ack(message: ConsumeMessage) {
    if (!this.channel) throw new Error("BROKER_CHANNEL_LOST");
    this.channel.ack(message);
  }
  async close() {
    this.stopped = true;
    if (this.consumerTag && this.channel)
      await this.channel.cancel(this.consumerTag).catch(() => {});
    await Promise.allSettled([...this.inflight]);
    await this.channel?.close().catch(() => {});
    await this.connection?.close().catch(() => {});
    await this.opening?.catch(() => {});
  }
  get healthy() {
    return !!this.channel;
  }
}
