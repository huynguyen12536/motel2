import { Module } from "@nestjs/common";
import { MasterDatabaseModule } from "../../infrastructure/database/master/master-database.module.js";
import { TenantsController } from "./tenants.controller.js";
import { TenantsService } from "./tenants.service.js";
import { TenantsRepository } from "./tenants.repository.js";
import { PlatformAdminGuard } from "../auth/platform-admin.guard.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
@Module({
  imports: [MasterDatabaseModule, AuthorizationModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, PlatformAdminGuard],
})
export class TenantsModule {}
