import { RequireAccess, RequirePermissions } from "../modules/authorization/permissions.guard.js";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import { z } from "zod";
import { ZodPipe } from "../common/validation/zod.pipe.js";
import { PlatformAdminGuard } from "../modules/auth/platform-admin.guard.js";
import {
  ListTenantsQueryDto,
  listTenantsSchema,
} from "../modules/tenants/dto/list-tenants-query.dto.js";
import { ProvisioningService } from "./provisioning.service.js";
import { TenantAuthService } from "./auth.service.js";
import { TenantAuthGuard } from "./tenant-auth.guard.js";
import type { TenantRequest } from "./tenant-auth.guard.js";
import { TenantTechnicalRepository } from "./tenant-routing.js";
import { TenantMigrationOrchestrator } from "./migration-orchestrator.js";
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(256);
const companyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_]{0,63}$/);
const bootstrapSchema = z.strictObject({ email, password });
const loginSchema = z.strictObject({ companyCode, email, password: z.string().min(1).max(256) });
const refreshSchema = z.strictObject({ companyCode, refreshToken: z.string().min(1).max(256) });
class LoginDto {
  @ApiProperty({ example: "COMPANY_A" }) companyCode!: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({ format: "password", writeOnly: true, maxLength: 256 }) password!: string;
}
class BootstrapDto {
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({ format: "password", writeOnly: true, minLength: 12, maxLength: 256 })
  password!: string;
}
class RefreshDto {
  @ApiProperty() companyCode!: string;
  @ApiProperty({ writeOnly: true }) refreshToken!: string;
}
class RolloutDto {
  @ApiProperty({ description: "Operator approval/ticket reference", maxLength: 100 })
  authorizationRef!: string;
  @ApiProperty({ type: [String], required: false }) tenantIds?: string[];
}
class ProvisionAcceptedDto {
  @ApiProperty({ format: "uuid" }) tenantId!: string;
  @ApiProperty({ format: "uuid" }) provisioningId!: string;
  @ApiProperty({ enum: ["PENDING", "RUNNING"] }) status!: string;
}
class OperationDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) tenantId!: string;
  @ApiProperty({ enum: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"] }) status!: string;
  @ApiProperty({ description: "Safe durable step label" }) progress!: string;
  @ApiProperty({ minimum: 0 }) attemptCount!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) requestedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) startedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) completedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) errorCode!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Generic sanitized summary; no provider error text",
  })
  errorSummary!: string | null;
}
class HistoryDto {
  @ApiProperty({ type: [OperationDto] }) items!: OperationDto[];
  @ApiProperty() total!: number;
  @ApiProperty({ minimum: 1, default: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100, default: 20 }) limit!: number;
}
class TokenPairDto {
  @ApiProperty({ description: "HS256 access JWT, 15 minute lifetime" }) accessToken!: string;
  @ApiProperty({ description: "Opaque, single-use rotating refresh credential" })
  refreshToken!: string;
  @ApiProperty({ enum: ["Bearer"] }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}
class TenantMeDto {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ format: "uuid" }) tenantId!: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty({ enum: ["TENANT_ADMIN", "TENANT_USER"] }) role!: string;
}
@ApiTags("Tenant Administration")
@ApiSecurity("platform-admin")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Platform credential required" })
@ApiResponse({ status: 400, description: "Invalid UUID, pagination or body" })
@ApiResponse({ status: 404, description: "Tenant or provisioning operation not found" })
@ApiResponse({ status: 409, description: "Lifecycle, operation or resource identity conflict" })
@ApiResponse({ status: 503, description: "Feature disabled or infrastructure unavailable" })
@UseGuards(PlatformAdminGuard)
@Controller("admin/tenants")
export class ProvisioningController {
  constructor(
    @Inject(ProvisioningService) private readonly provisioning: ProvisioningService,
    @Inject(TenantAuthService) private readonly auth: TenantAuthService,
  ) {}
  @Post(":id/provision")
  @RequirePermissions("platform.tenants:provision")
  @HttpCode(202)
  @ApiOperation({ summary: "Queue tenant provisioning; performs no synchronous resource creation" })
  @ApiResponse({ status: 202, type: ProvisionAcceptedDto })
  start(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.provisioning.request(id);
  }
  @Post(":id/provisioning/retry")
  @RequirePermissions("platform.tenants:retry")
  @HttpCode(202)
  @ApiResponse({ status: 202, type: ProvisionAcceptedDto })
  retry(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.provisioning.request(id, true);
  }
  @Get(":id/provisioning")
  @RequirePermissions("platform.tenants:read")
  @ApiResponse({ status: 200, type: HistoryDto })
  history(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query(new ZodPipe(listTenantsSchema.pick({ page: true, limit: true }), "query"))
    query: ListTenantsQueryDto,
  ) {
    return this.provisioning.history(id, query.page!, query.limit!);
  }
  @Get(":id/provisioning/:provisioningId")
  @RequirePermissions("platform.tenants:read")
  @ApiResponse({ status: 200, type: OperationDto })
  detail(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("provisioningId", new ParseUUIDPipe()) operation: string,
  ) {
    return this.provisioning.detail(id, operation);
  }
  @Post(":id/users/bootstrap")
  @RequirePermissions("platform.users:manage")
  @ApiOperation({
    summary: "Explicit, one-time, platform-controlled administrator bootstrap; disabled by default",
  })
  bootstrap(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(bootstrapSchema, "query")) body: BootstrapDto,
  ) {
    return this.auth.bootstrap(id, body.email, body.password);
  }
}
@ApiTags("Tenant Authentication")
@ApiResponse({ status: 400, description: "Invalid request" })
@ApiResponse({
  status: 401,
  description: "Invalid company, credentials, token or tenant/session status",
})
@ApiResponse({ status: 429, description: "Authentication rate limit exceeded" })
@ApiResponse({ status: 503, description: "Authentication configuration or database unavailable" })
@Controller("auth")
export class TenantAuthController {
  constructor(@Inject(TenantAuthService) private readonly auth: TenantAuthService) {}
  @Post("login")
  @ApiResponse({ status: 200, type: TokenPairDto })
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema, "query")) body: LoginDto, @Req() req: TenantRequest) {
    return this.auth.login(body, req.ip ?? "unknown");
  }
  @Post("refresh")
  @ApiResponse({ status: 200, type: TokenPairDto })
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema, "query")) body: RefreshDto, @Req() req: TenantRequest) {
    return this.auth.refresh(body, req.ip ?? "unknown");
  }
  @Post("logout")
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @HttpCode(200)
  @UseGuards(TenantAuthGuard)
  @ApiBearerAuth()
  logout(@Req() req: TenantRequest) {
    return this.auth.logout(req.tenantPrincipal!);
  }
}
@ApiTags("Tenant Identity")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Validated tenant/session identity required" })
@ApiResponse({ status: 403, description: "Tenant role does not permit this operation" })
@ApiResponse({ status: 503, description: "Tenant mapping or database unavailable" })
@UseGuards(TenantAuthGuard)
@Controller("tenant")
export class TenantIdentityController {
  constructor(
    @Inject(TenantTechnicalRepository) private readonly repository: TenantTechnicalRepository,
  ) {}
  @Get("me")
  @RequireAccess("tenant")
  @ApiResponse({ status: 200, type: TenantMeDto })
  me(@Req() req: TenantRequest) {
    const p = req.tenantPrincipal!;
    return { userId: p.userId, tenantId: p.tenantId, email: p.email, role: p.role };
  }
  @Get("admin/identity")
  @RequirePermissions("tenant.settings:update")
  @ApiOperation({ summary: "Technical identity verification; no business CRUD" })
  identity(@Req() req: TenantRequest) {
    return this.repository.identity(req.tenantPrincipal!.tenantId);
  }
}
@ApiTags("Tenant Operations")
@ApiSecurity("platform-admin")
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller("admin/tenant-migrations")
export class MigrationRolloutController {
  constructor(
    @Inject(TenantMigrationOrchestrator) private readonly migrations: TenantMigrationOrchestrator,
  ) {}
  @Post()
  @RequirePermissions("platform.migrations:manage")
  @HttpCode(202)
  @ApiOperation({
    summary: "Create an explicitly authorized rollout; CLI execution is a separate operator action",
  })
  create(
    @Body(
      new ZodPipe(
        z.strictObject({
          authorizationRef: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .regex(/^[A-Za-z0-9_.:/-]+$/),
          tenantIds: z.array(z.uuid()).min(1).max(1000).optional(),
        }),
        "query",
      ),
    )
    body: RolloutDto,
  ) {
    return this.migrations.create(body.authorizationRef, body.tenantIds);
  }
  @Get(":id")
  @RequirePermissions("platform.migrations:read")
  list(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.migrations.list(id);
  }
}
