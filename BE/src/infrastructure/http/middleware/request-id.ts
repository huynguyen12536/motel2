import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id") ?? req.header("x-correlation-id");
  const id =
    incoming && incoming.trim().length > 0 ? incoming.trim().slice(0, 128) : randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  res.setHeader("X-Correlation-Id", id);
  next();
}
