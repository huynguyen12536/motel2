import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const authenticated = context
      .switchToHttp()
      .getRequest<Request & { platformPrincipal?: { scope: string } }>();
    // Only the global permission guard sets this after session/DB/Casbin verification.
    if (authenticated.platformPrincipal?.scope === "platform") return true;
    const secret = env.PLATFORM_ADMIN_SECRET;
    if (!secret) throw new ServiceUnavailableException("Platform administration is not configured");
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers["x-platform-admin-key"];
    if (
      typeof key !== "string" ||
      key.length > 1024 ||
      !timingSafeEqual(
        createHash("sha256").update(key).digest(),
        createHash("sha256").update(secret).digest(),
      )
    )
      throw new UnauthorizedException("Platform admin credential required");
    return true;
  }
}
