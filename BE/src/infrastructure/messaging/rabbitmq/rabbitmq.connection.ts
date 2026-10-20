import { Injectable } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { connect } from "amqplib";
import type { ChannelModel } from "amqplib";
import { rabbitmqConfig } from "./rabbitmq.config.js";
import { logger } from "../../../../logger/index.js";
@Injectable()
export class RabbitmqConnection implements OnModuleInit, OnModuleDestroy {
  private connection?: ChannelModel;
  private retry?: NodeJS.Timeout;
  private stopped = false;
  private pending?: Promise<void>;
  get healthy() {
    return !!this.connection;
  }
  onModuleInit() {
    this.pending = this.open();
  }
  private async open(): Promise<void> {
    try {
      const connection = await connect(rabbitmqConfig, { timeout: 3000 });
      connection.on("error", () =>
        logger.warn({ event: "rabbitmq.error" }, "RabbitMQ connection error"),
      );
      connection.on("close", () => {
        this.connection = undefined;
        this.schedule();
      });
      if (this.stopped) {
        await connection.close();
        return;
      }
      this.connection = connection;
      logger.info({ event: "rabbitmq.connected" }, "RabbitMQ connected");
    } catch {
      logger.warn({ event: "rabbitmq.unavailable" }, "RabbitMQ unavailable; retry scheduled");
      this.schedule();
    }
  }
  private schedule() {
    if (this.stopped || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      this.pending = this.open();
    }, 3000);
    this.retry.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.retry);
    await this.pending;
    await this.connection?.close().catch(() => undefined);
    this.connection = undefined;
  }
}
