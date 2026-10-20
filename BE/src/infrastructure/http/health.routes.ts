import { env } from "../../config/env.js";
import { Router } from "express";
import { appConfig } from "../../config/app.config.js";
export function createHealthRouter(ping: () => Promise<boolean>) {
  const router = Router();
  router.get("/", async (_req, res) => {
    const startedAt = Date.now();
    let database = "skipped";
    if (env.DATABASE_VERIFY) {
      try {
        database = (await ping()) ? "up" : "down";
      } catch {
        database = "down";
      }
    }
    const healthy = database !== "down";
    res
      .status(healthy ? 200 : 503)
      .json({
        data: {
          name: appConfig.name,
          status: healthy ? "ok" : "degraded",
          database,
          uptimeSec: Math.round(process.uptime()),
          durationMs: Date.now() - startedAt,
        },
      });
  });
  return router;
}
