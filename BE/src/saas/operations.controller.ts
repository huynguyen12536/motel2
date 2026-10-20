import { RequirePermissions } from "../modules/authorization/permissions.guard.js";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
import { PlatformAdminGuard } from "../modules/auth/platform-admin.guard.js";
import { TenantPrismaManager } from "./tenant-routing.js";
@ApiTags("Tenant Operations")
@ApiSecurity("platform-admin")
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller("admin/saas")
export class SaasOperationsController {
  constructor(
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
    @Inject(TenantPrismaManager) private readonly manager: TenantPrismaManager,
  ) {}
  @Get("metrics")
  @RequirePermissions("platform.metrics:read")
  @ApiOperation({
    summary: "Aggregate job states and this API instance's tenant pool utilization; no credentials",
  })
  async metrics() {
    const db = await this.master.client();
    const [tenants, provisioning, outbox, migrations, expiredProvisioningLeases] =
      await Promise.all([
        db.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
        db.tenantProvisioning.groupBy({ by: ["status"], _count: { _all: true } }),
        db.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } }),
        db.tenantMigrationRun.groupBy({ by: ["status"], _count: { _all: true } }),
        db.tenantProvisioning.count({
          where: { status: "RUNNING", leaseUntil: { lt: new Date() } },
        }),
      ]);
    return {
      at: new Date().toISOString(),
      tenants,
      provisioning,
      outbox,
      migrations,
      expiredProvisioningLeases,
      tenantPools: this.manager.metrics(),
    };
  }
}
