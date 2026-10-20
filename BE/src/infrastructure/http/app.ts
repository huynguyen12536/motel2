import { env } from "../../config/env.js";
import cors from "cors";
import express from "express";
import { appConfig } from "../../config/app.config.js";
import { corsOptions } from "../../config/cors.js";
import { securityHeaders } from "../../config/security-headers.js";
import { extraSecurityHeaders } from "./middleware/extra-security-headers.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createHealthRouter } from "./health.routes.js";

export function createApp(options: { nest?: boolean; pingDatabase?: () => Promise<boolean> } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", false);

  app.use(requestId);
  app.use(securityHeaders);
  if (env.SWAGGER_ENABLED)
    app.use((req, res, next) => {
      if (req.path === "/api/docs" || req.path.startsWith("/api/docs/"))
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
        );
      next();
    });
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

  const health = createHealthRouter(
    options.pingDatabase ??
      (() => Promise.reject(new Error("Database health dependency unavailable"))),
  );
  app.use("/health", health);
  app.use("/api/v1/health", health);

  if (!options.nest) {
    app.use(notFoundHandler);
    app.use(errorHandler);
  }

  return app;
}
