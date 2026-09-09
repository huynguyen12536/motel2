import cors from "cors";
import express from "express";
import { appConfig } from "../../config/app.config.js";
import { corsOptions } from "../../config/cors.js";
import { securityHeaders } from "../../config/security-headers.js";
import { extraSecurityHeaders } from "./middleware/extra-security-headers.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { healthRouter } from "./health.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", false);

  app.use(requestId);
  app.use(securityHeaders);
  app.use(extraSecurityHeaders);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: appConfig.bodyLimit }));
  app.use(requestLogger);

  app.get("/", (_req, res) => {
    res.json({
      data: {
        name: appConfig.name,
        api: "/api/v1",
      },
    });
  });

  app.use("/health", healthRouter);
  app.use("/api/v1/health", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
