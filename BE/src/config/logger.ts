import pino from "pino";
import { appConfig } from "./app.config.js";

export const logger = pino({
  name: appConfig.name,
  level: appConfig.logLevel,
  redact: {
    paths: [
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "token",
      "authorization",
      "headers.authorization",
      "headers.Authorization",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.accessToken",
      "*.refreshToken",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
  transport: appConfig.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
});
