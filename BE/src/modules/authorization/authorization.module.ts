import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MasterDatabaseModule } from "../../infrastructure/database/master/master-database.module.js";
import { AuthorizationService } from "./authorization.service.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PermissionsGuard } from "./permissions.guard.js";
import {
  EffectivePermissionsController,
  PlatformAuthenticationController,
  PlatformAuthorizationController,
  TenantAuthorizationController,
} from "./authorization.controller.js";
@Global()
@Module({
  imports: [MasterDatabaseModule],
  providers: [
    AuthorizationService,
    PlatformAuthService,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  controllers: [
    EffectivePermissionsController,
    PlatformAuthenticationController,
    PlatformAuthorizationController,
    TenantAuthorizationController,
  ],
  exports: [AuthorizationService, PlatformAuthService],
})
export class AuthorizationModule {}
