import { env } from "../../config/env.js";
export const redisConfig = {
  ...(env.REDIS_URL ? { url: env.REDIS_URL } : {}),
  password: env.REDIS_PASSWORD,
  socket: {
    ...(!env.REDIS_URL ? { host: env.REDIS_HOST, port: env.REDIS_PORT } : {}),
    connectTimeout: 3000,
    reconnectStrategy: () => 3000,
  },
  disableOfflineQueue: true,
};
