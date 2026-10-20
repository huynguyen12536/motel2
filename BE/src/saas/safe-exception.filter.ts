import { Catch, HttpException, ServiceUnavailableException } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { logger } from "../../logger/index.js";
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      if (error.getStatus() === 400) {
        const body = error.getResponse();
        const fields =
          body && typeof body === "object" && "fields" in body && Array.isArray(body.fields)
            ? body.fields.filter(
                (x: unknown) => typeof x === "string" && /^[A-Za-z0-9_.]{1,100}$/.test(x),
              )
            : undefined;
        response
          .status(400)
          .json({ statusCode: 400, message: "Invalid request", ...(fields ? { fields } : {}) });
        return;
      }
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      /^P[0-9]{4}$/.test(error.code)
        ? error.code
        : "unknown";
    logger.error({ event: "request.internal_error", code }, "Request failed");
    const safe = new ServiceUnavailableException("Operation is unavailable; retry later");
    response.status(safe.getStatus()).json(safe.getResponse());
  }
}
