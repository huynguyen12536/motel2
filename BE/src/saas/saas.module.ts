import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { MasterDatabaseModule } from "../infrastructure/database/master/master-database.module.js";
import { CacheModule } from "../infrastructure/cache/cache.module.js";
import { PlatformAdminGuard } from "../modules/auth/platform-admin.guard.js";
import { DATABASE_BACKEND, TENANT_CONNECTIONS, SAAS_POLICY } from "./contracts.js";
import type { DatabaseBackend, TenantConnections, SaasPolicy } from "./contracts.js";
import { configuredPolicy } from "./policy.js";
import { NeonDatabaseBackend, SecureTenantConnections } from "./neon.backend.js";
import { ProvisioningService } from "./provisioning.service.js";
import {
  TenantResolver,
  TenantPrismaManager,
  TenantTechnicalRepository,
} from "./tenant-routing.js";
import { TenantAuthService, LoginLimiter } from "./auth.service.js";
import { TenantAuthGuard, TenantRolesGuard } from "./tenant-auth.guard.js";
import {
  ProvisioningController,
  TenantAuthController,
  TenantIdentityController,
  MigrationRolloutController,
} from "./saas.controller.js";
import { OutboxPublisher } from "./outbox.publisher.js";
import { ProvisioningWorker } from "./provisioning.worker.js";
import { ProvisioningBroker } from "./broker.js";
import { TenantMigrationOrchestrator } from "./migration-orchestrator.js";
import { SaasOperationsController } from "./operations.controller.js";
import { AuthorizationModule } from "../modules/authorization/authorization.module.js";
const services = [
  ProvisioningService,
  TenantResolver,
  TenantPrismaManager,
  TenantTechnicalRepository,
  TenantAuthService,
  LoginLimiter,
  TenantAuthGuard,
  TenantRolesGuard,
  OutboxPublisher,
  ProvisioningWorker,
  TenantMigrationOrchestrator,
];
@Module({})
export class SaasModule {
  static register(
    options: {
      backend?: DatabaseBackend;
      connections?: TenantConnections;
      policy?: SaasPolicy;
      broker?: ProvisioningBroker;
    } = {},
  ): DynamicModule {
    return {
      module: SaasModule,
      imports: [MasterDatabaseModule, CacheModule, AuthorizationModule],
      controllers: [
        ProvisioningController,
        TenantAuthController,
        TenantIdentityController,
        MigrationRolloutController,
        SaasOperationsController,
      ],
      providers: [
        ...services,
        PlatformAdminGuard,
        { provide: SAAS_POLICY, useValue: options.policy ?? configuredPolicy() },
        { provide: DATABASE_BACKEND, useValue: options.backend ?? new NeonDatabaseBackend() },
        {
          provide: TENANT_CONNECTIONS,
          useValue: options.connections ?? new SecureTenantConnections(),
        },
        { provide: ProvisioningBroker, useValue: options.broker ?? new ProvisioningBroker() },
      ],
      exports: [...services, ProvisioningBroker, SAAS_POLICY],
    };
  }
}
