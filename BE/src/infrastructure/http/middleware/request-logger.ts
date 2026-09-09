import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../config/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on("finish", () => {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    logger[level](
      {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode,
        durationMs: Date.now() - startedAt,
      },
      `${req.method} ${req.originalUrl} ${statusCode}`,
    );
  });

  next();
}
