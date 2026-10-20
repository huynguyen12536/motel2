import { env } from "../../../config/env.js";
export const rabbitmqConfig = {
  protocol: "amqp",
  hostname: env.RABBITMQ_HOST,
  port: env.RABBITMQ_PORT,
  username: env.RABBITMQ_USER,
  password: env.RABBITMQ_PASSWORD,
  vhost: env.RABBITMQ_VHOST,
  heartbeat: 10,
};
