import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../../logger/index.js";

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
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    (error.type === "entity.parse.failed" || error.type === "entity.too.large")
  ) {
    const large = error.type === "entity.too.large";
    res
      .status(large ? 413 : 400)
      .json({
        error: {
          code: large ? "BODY_TOO_LARGE" : "INVALID_JSON",
          message: large ? "Request body too large" : "Invalid JSON body",
        },
      });
    return;
  }

  logger.error({ event: "request.unhandled_error" }, "Unhandled request error");

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
}
