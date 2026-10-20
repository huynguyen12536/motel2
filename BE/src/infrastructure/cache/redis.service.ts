import { Injectable } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createClient } from "redis";
import { redisConfig } from "./redis.config.js";
import { logger } from "../../../logger/index.js";
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createClient(redisConfig);
  private pending?: Promise<unknown>;
  constructor() {
    this.client.on("error", () =>
      logger.warn({ event: "redis.error" }, "Redis unavailable; reconnecting"),
    );
  }
  onModuleInit() {
    this.pending = this.client.connect().catch(() => undefined);
  }
  async check(): Promise<boolean> {
    if (!this.client.isReady) return false;
    try {
      return (await this.client.withCommandOptions({ timeout: 2000 }).ping()) === "PONG";
    } catch {
      return false;
    }
  }
  async get(key: string): Promise<string | undefined> {
    if (!this.client.isReady) return undefined;
    try {
      return (await this.client.withCommandOptions({ timeout: 500 }).get(key)) ?? undefined;
    } catch {
      return undefined;
    }
  }
  async set(key: string, value: string, ttl: number): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.client.withCommandOptions({ timeout: 500 }).set(key, value, { EX: ttl });
    } catch {
      /* Metadata always falls back to authoritative Master checks. */
    }
  }
  async invalidate(key: string): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.client.withCommandOptions({ timeout: 500 }).del(key);
    } catch {
      /* Master revision checks remain mandatory on every request. */
    }
  }
  async rateLimit(key: string, seconds: number): Promise<number | undefined> {
    if (!this.client.isReady) return undefined;
    try {
      return Number(
        await this.client
          .withCommandOptions({ timeout: 500 })
          .eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
            { keys: [key], arguments: [String(seconds)] },
          ),
      );
    } catch {
      return undefined;
    }
  }
  async onModuleDestroy() {
    if (this.client.isOpen) this.client.destroy();
    await this.pending;
  }
}
