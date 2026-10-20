import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { AuthorizationService } from "./authorization.service.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { RequireAccess } from "./permissions.guard.js";
import type { AuthorizationRequest } from "./permissions.guard.js";
import type { Scope, Permission } from "./catalog.js";
const email = z.string().trim().toLowerCase().email().max(254),
  password = z.string().min(12).max(256);
const login = z.strictObject({ email, password: z.string().min(1).max(256) });
const roleCreate = z.strictObject({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
const roleEdit = roleCreate.omit({ code: true });
const pagination = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});
class LoginDto {
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({ format: "password", writeOnly: true }) password!: string;
}
class RefreshDto {
  @ApiProperty({ writeOnly: true }) refreshToken!: string;
}
class RoleCreateDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) description?: string;
}
class RoleEditDto {
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) description?: string;
}
class GrantsDto {
  @ApiProperty({ type: [String], description: "Exact catalog codes from this scope" })
  permissions!: string[];
}
class AssignmentsDto {
  @ApiProperty({ type: [String], format: "uuid" }) roleIds!: string[];
}
class UserCreateDto extends LoginDto {
  @ApiProperty({ required: false }) name?: string;
}
class UserStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "DISABLED"] }) status!: "ACTIVE" | "DISABLED";
}
@ApiTags("Platform Authentication")
@ApiResponse({ status: 401, description: "Missing, invalid, revoked or wrong-scope credentials" })
@ApiResponse({
  status: 503,
  description: "Authentication or authorization initialization unavailable",
})
@Controller("platform/auth")
export class PlatformAuthenticationController {
  constructor(
    @Inject(PlatformAuthService) private readonly auth: PlatformAuthService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}
  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  login(@Body(new ZodPipe(login, "query")) b: LoginDto, @Req() req: AuthorizationRequest) {
    return this.auth.login(b.email, b.password, req.ip ?? "unknown");
  }
  @Post("refresh")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  refresh(
    @Body(new ZodPipe(z.strictObject({ refreshToken: z.string().max(256) }), "query"))
    b: RefreshDto,
    @Req() req: AuthorizationRequest,
  ) {
    return this.auth.refresh(b.refreshToken, req.ip ?? "unknown");
  }
  @Post("logout")
  @HttpCode(200)
  @RequireAccess("platform")
  @ApiBearerAuth()
  logout(@Req() req: AuthorizationRequest) {
    return this.auth.logout(req.authorizationPrincipal);
  }
  @Get("me")
  @RequireAccess("platform")
  @ApiBearerAuth()
  async me(@Req() req: AuthorizationRequest) {
    const p = req.authorizationPrincipal,
      e = await this.authorization.effective(p);
    return { id: p.userId, name: p.email, role: e.roles[0] ?? "", ...e };
  }
}
@ApiTags("Effective Permissions")
@ApiBearerAuth()
@Controller("auth/me")
export class EffectivePermissionsController {
  constructor(@Inject(AuthorizationService) private readonly authorization: AuthorizationService) {}
  @Get("permissions")
  @RequireAccess("any")
  permissions(@Req() req: AuthorizationRequest) {
    return this.authorization.effective(req.authorizationPrincipal);
  }
}
function managementController(scope: Scope) {
  const permission = (suffix: string) => (scope + "." + suffix) as Permission;
  const usersManage = scope === "platform" ? "users:manage" : "users:assign";
  @ApiTags(scope === "platform" ? "Platform Authorization" : "Tenant Authorization")
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: "Scoped authentication required" })
  @ApiResponse({
    status: 403,
    description: "Permission or delegation authority missing; system role protected",
  })
  @ApiResponse({
    status: 409,
    description: "Duplicate, role in use or last super administrator conflict",
  })
  @ApiResponse({ status: 503, description: "Current initialized policy storage unavailable" })
  @Controller(scope)
  class ManagementController {
    constructor(@Inject(AuthorizationService) private readonly service: AuthorizationService) {}
    @Get("permissions")
    @RequireAccess(scope, permission("permissions:read"))
    @ApiOperation({ summary: "Read immutable registered permission catalog for this scope" })
    catalog(@Req() r: AuthorizationRequest) {
      return this.service.catalog(r.authorizationPrincipal);
    }
    @Get("roles")
    @RequireAccess(scope, permission("roles:read"))
    roles(
      @Req() r: AuthorizationRequest,
      @Query(new ZodPipe(pagination, "query")) q: z.infer<typeof pagination>,
    ) {
      return this.service.roles(r.authorizationPrincipal, q);
    }
    @Get("roles/:id")
    @RequireAccess(scope, permission("roles:read"))
    role(@Req() r: AuthorizationRequest, @Param("id", new ParseUUIDPipe()) id: string) {
      return this.service.role(r.authorizationPrincipal, id);
    }
    @Post("roles")
    @RequireAccess(scope, permission("roles:manage"))
    create(
      @Req() r: AuthorizationRequest,
      @Body(new ZodPipe(roleCreate, "query")) b: RoleCreateDto,
    ) {
      return this.service.createRole(r.authorizationPrincipal, b);
    }
    @Patch("roles/:id")
    @RequireAccess(scope, permission("roles:manage"))
    edit(
      @Req() r: AuthorizationRequest,
      @Param("id", new ParseUUIDPipe()) id: string,
      @Body(new ZodPipe(roleEdit, "query")) b: RoleEditDto,
    ) {
      return this.service.updateRole(r.authorizationPrincipal, id, b);
    }
    @Delete("roles/:id")
    @RequireAccess(scope, permission("roles:manage"))
    remove(@Req() r: AuthorizationRequest, @Param("id", new ParseUUIDPipe()) id: string) {
      return this.service.deleteRole(r.authorizationPrincipal, id);
    }
    @Put("roles/:id/permissions")
    @RequireAccess(
      scope,
      permission(scope === "platform" ? "permissions:manage" : "permissions:assign"),
    )
    grants(
      @Req() r: AuthorizationRequest,
      @Param("id", new ParseUUIDPipe()) id: string,
      @Body(
        new ZodPipe(
          z.strictObject({ permissions: z.array(z.string().max(100)).max(200) }),
          "query",
        ),
      )
      b: GrantsDto,
    ) {
      return this.service.replacePermissions(r.authorizationPrincipal, id, b.permissions);
    }
    @Get("users")
    @RequireAccess(scope, permission("users:read"))
    users(
      @Req() r: AuthorizationRequest,
      @Query(new ZodPipe(pagination, "query")) q: z.infer<typeof pagination>,
    ) {
      return this.service.users(r.authorizationPrincipal, q);
    }
    @Post("users")
    @RequireAccess(scope, permission(scope === "platform" ? "users:manage" : "users:create"))
    createUser(
      @Req() r: AuthorizationRequest,
      @Body(
        new ZodPipe(
          z.strictObject({ email, password, name: z.string().trim().min(1).max(200).optional() }),
          "query",
        ),
      )
      b: UserCreateDto,
    ) {
      return this.service.createUser(r.authorizationPrincipal, b);
    }
    @Patch("users/:id")
    @RequireAccess(scope, permission(scope === "platform" ? "users:manage" : "users:update"))
    status(
      @Req() r: AuthorizationRequest,
      @Param("id", new ParseUUIDPipe()) id: string,
      @Body(new ZodPipe(z.strictObject({ status: z.enum(["ACTIVE", "DISABLED"]) }), "query"))
      b: UserStatusDto,
    ) {
      return this.service.status(r.authorizationPrincipal, id, b.status);
    }
    @Get("users/:id/roles")
    @RequireAccess(scope, permission("users:read"))
    userRoles(@Req() r: AuthorizationRequest, @Param("id", new ParseUUIDPipe()) id: string) {
      return this.service.userRoles(r.authorizationPrincipal, id);
    }
    @Put("users/:id/roles")
    @RequireAccess(scope, permission(usersManage))
    assign(
      @Req() r: AuthorizationRequest,
      @Param("id", new ParseUUIDPipe()) id: string,
      @Body(new ZodPipe(z.strictObject({ roleIds: z.array(z.uuid()).max(100) }), "query"))
      b: AssignmentsDto,
    ) {
      return this.service.assignRoles(r.authorizationPrincipal, id, b.roleIds);
    }
  }
  Object.defineProperty(ManagementController, "name", {
    value:
      scope === "platform" ? "PlatformAuthorizationController" : "TenantAuthorizationController",
  });
  return ManagementController;
}
export const PlatformAuthorizationController = managementController("platform");
export const TenantAuthorizationController = managementController("tenant");
