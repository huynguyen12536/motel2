import { RequirePermissions } from "../authorization/permissions.guard.js";
import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ApiTags, ApiSecurity, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service.js";
import { PlatformAdminGuard } from "../auth/platform-admin.guard.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { CreateTenantDto, createTenantSchema } from "./dto/create-tenant.dto.js";
import { UpdateTenantDto, updateTenantSchema } from "./dto/update-tenant.dto.js";
import { ListTenantsQueryDto, listTenantsSchema } from "./dto/list-tenants-query.dto.js";
import {
  TenantResponseDto,
  TenantDetailResponseDto,
  TenantListResponseDto,
  TenantErrorDto,
} from "./dto/tenant-response.dto.js";
@ApiTags("Tenant Administration")
@ApiSecurity("platform-admin")
@ApiBearerAuth()
@ApiResponse({ status: 400, type: TenantErrorDto, description: "Invalid body, query or UUID" })
@ApiResponse({
  status: 401,
  type: TenantErrorDto,
  description: "Missing or invalid admin credential",
})
@ApiResponse({
  status: 403,
  type: TenantErrorDto,
  description: "Identity or lifecycle fields are forbidden",
})
@ApiResponse({
  status: 503,
  type: TenantErrorDto,
  description: "Admin configuration or Master database unavailable",
})
@UseGuards(PlatformAdminGuard)
@Controller("admin/tenants")
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}
  @Post()
  @RequirePermissions("platform.tenants:create")
  @HttpCode(201)
  @ApiOperation({ summary: "Register a company tenant; provisioning remains pending" })
  @ApiResponse({ status: 201, type: TenantResponseDto })
  @ApiResponse({
    status: 409,
    type: TenantErrorDto,
    description: "Duplicate normalized code or slug",
  })
  create(@Body(new ZodPipe(createTenantSchema, "create")) input: CreateTenantDto) {
    return this.tenants.create(input);
  }
  @Get()
  @RequirePermissions("platform.tenants:read")
  @ApiResponse({ status: 200, type: TenantListResponseDto })
  list(@Query(new ZodPipe(listTenantsSchema, "query")) input: ListTenantsQueryDto) {
    return this.tenants.list({ ...input, page: input.page!, limit: input.limit! });
  }
  @Get(":id")
  @RequirePermissions("platform.tenants:read")
  @ApiResponse({ status: 200, type: TenantDetailResponseDto })
  @ApiResponse({ status: 404, type: TenantErrorDto, description: "Tenant not found" })
  find(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tenants.find(id);
  }
  @Patch(":id")
  @RequirePermissions("platform.tenants:update")
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 404, type: TenantErrorDto, description: "Tenant not found" })
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(updateTenantSchema, "update")) input: UpdateTenantDto,
  ) {
    return this.tenants.update(id, input);
  }
}
