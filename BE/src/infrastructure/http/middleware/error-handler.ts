import type { NextFunction, Request, Response } from "express";
import { appConfig } from "../../../config/app.config.js";
import { logger } from "../../../config/logger.js";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} was not found`,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  logger.error({ err: error }, "Unhandled request error");

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: appConfig.isProduction ? "Internal server error" : message,
    },
  });
}
