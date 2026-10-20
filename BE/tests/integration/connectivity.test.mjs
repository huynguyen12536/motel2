import { test, expect } from "@jest/globals";
// Explicitly opt in; these checks open connections but publish no messages and declare no queues.
const integration = process.env.RUN_INFRA_INTEGRATION === "true" ? test : test.skip;
integration(
  "RabbitMQ handshake and Redis PING",
  async () => {
    const { config } = await import("dotenv");
    config({ quiet: true });
    const { connect } = await import("amqplib");
    const { createClient } = await import("redis");
    const rabbit = await connect(
      {
        hostname: process.env.RABBITMQ_HOST || "127.0.0.1",
        port: Number(process.env.RABBITMQ_PORT || 5672),
        username: process.env.RABBITMQ_USER,
        password: process.env.RABBITMQ_PASSWORD,
        vhost: process.env.RABBITMQ_VHOST || "/",
      },
      { timeout: 3000 },
    );
    rabbit.on("error", () => {});
    const redis = createClient({
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
        connectTimeout: 3000,
        reconnectStrategy: false,
      },
    });
    redis.on("error", () => {});
    try {
      await redis.connect();
      expect(await redis.ping()).toBe("PONG");
    } finally {
      if (redis.isOpen) redis.destroy();
      await rabbit.close();
    }
  },
  10000,
);
