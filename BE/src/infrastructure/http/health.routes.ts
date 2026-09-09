import { Router } from "express";
import { appConfig } from "../../config/app.config.js";
import { pingDatabase } from "../../database/postgres.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const startedAt = Date.now();
  let database = "down";

  try {
    const ok = await pingDatabase();
    database = ok ? "up" : "down";
  } catch {
    database = "down";
  }

  const healthy = database === "up";
  res.status(healthy ? 200 : 503).json({
    data: {
      name: appConfig.name,
      status: healthy ? "ok" : "degraded",
      database,
      uptimeSec: Math.round(process.uptime()),
      durationMs: Date.now() - startedAt,
    },
  });
});
