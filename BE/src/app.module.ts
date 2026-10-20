import { TenantsModule } from "./modules/tenants/tenants.module.js";
import { LifecycleService } from "./infrastructure/logging/lifecycle.service.js";
import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { SaasModule } from "./saas/saas.module.js";
@Module({
  imports: [HealthModule, TenantsModule, SaasModule.register()],
  providers: [LifecycleService],
})
export class AppModule {}
