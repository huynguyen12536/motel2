import {
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  applyDecorators,
} from "@nestjs/common";
import { ApiExtension } from "@nestjs/swagger";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { PlatformAdminGuard } from "../auth/platform-admin.guard.js";
import { TenantAuthService } from "../../saas/auth.service.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import type { AuthorizationPrincipal } from "./platform-auth.service.js";
import type { Permission, Scope } from "./catalog.js";
import { AuthorizationService } from "./authorization.service.js";
export type AuthorizationRequest = Request & {
  authorizationPrincipal: AuthorizationPrincipal;
  platformPrincipal?: AuthorizationPrincipal;
};
const metadata = "casbin.required-permissions";
export const RequireAccess = (scope: Scope | "any", ...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(metadata, { scope, permissions }),
    ApiExtension("x-required-permissions", permissions),
    ApiExtension("x-authorization-scope", scope),
  );
export const RequirePermissions = (...permissions: Permission[]) =>
  RequireAccess(permissions[0].startsWith("platform.") ? "platform" : "tenant", ...permissions);
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PlatformAuthService) private readonly platform: PlatformAuthService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(ModuleRef) private readonly modules: ModuleRef,
  ) {}
  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<{
      scope: Scope | "any";
      permissions: Permission[];
    }>(metadata, [context.getHandler(), context.getClass()]);
    if (!required) {
      const prefix = this.reflector.get<string>("path", context.getClass()) ?? "";
      const method = this.reflector.get<string>("path", context.getHandler()) ?? "";
      if (
        /^(admin|platform|tenant)(\/|$)/.test(prefix) &&
        !(prefix === "platform/auth" && ["login", "refresh"].includes(method))
      ) {
        const request = context.switchToHttp().getRequest<Request>();
        if (!request.headers.authorization && !request.headers["x-platform-admin-key"])
          throw new UnauthorizedException("Scoped authentication required");
        throw new ForbiddenException("No authorization policy is registered for this endpoint");
      }
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthorizationRequest>(),
      response = context.switchToHttp().getResponse<Response>();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    const header = req.headers.authorization;
    let scope = required.scope;
    if (scope === "any") {
      // This only selects a verifier. Identity/domain are derived exclusively from verified claims and DB state.
      try {
        const payload = JSON.parse(
          Buffer.from((header ?? "").split(".")[1] ?? "", "base64url").toString(),
        );
        scope = payload.aud === "motel-platform" ? "platform" : "tenant";
      } catch {
        throw new UnauthorizedException("Bearer token required");
      }
    }
    let p: AuthorizationPrincipal;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      if (scope === "platform") p = await this.platform.authenticate(header.slice(7));
      else {
        const t = await this.modules
          .get(TenantAuthService, { strict: false })
          .authenticate(header.slice(7));
        Object.assign(req, { tenantPrincipal: t });
        p = {
          scope: "tenant",
          userId: t.userId,
          tenantId: t.tenantId,
          sessionId: t.sessionId,
          email: t.email,
        };
      }
    } else if (
      scope === "platform" &&
      env.PLATFORM_LEGACY_ADMIN_USER_ID &&
      req.headers["x-platform-admin-key"]
    ) {
      // Explicit compatibility only: valid key + configured active persisted user + current Casbin grants.
      new PlatformAdminGuard().canActivate(context);
      p = await this.platform.legacy(env.PLATFORM_LEGACY_ADMIN_USER_ID);
    } else throw new UnauthorizedException("Scoped bearer authentication required");
    req.authorizationPrincipal = p;
    if (p.scope === "platform") req.platformPrincipal = p;
    await this.authorization.require(p, required.permissions);
    return true;
  }
}
