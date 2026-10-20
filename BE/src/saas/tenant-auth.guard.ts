import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { TenantAuthService } from "./auth.service.js";
import type { TenantPrincipal } from "./auth.service.js";
export type TenantRequest = Request & { tenantPrincipal?: TenantPrincipal };
export const Roles = (...roles: TenantPrincipal["role"][]) => SetMetadata("tenant.roles", roles);
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(@Inject(TenantAuthService) private readonly auth: TenantAuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer "))
      throw new UnauthorizedException("Bearer token required");
    req.tenantPrincipal = await this.auth.authenticate(header.slice(7));
    // User-controlled tenant/company headers never participate in database selection.
    return true;
  }
}
@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<TenantPrincipal["role"][]>("tenant.roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    const principal = context.switchToHttp().getRequest<TenantRequest>().tenantPrincipal;
    if (!principal) throw new UnauthorizedException();
    if (roles && !roles.includes(principal.role))
      throw new ForbiddenException("Tenant role does not permit this operation");
    return true;
  }
}
