import { MasterDatabaseModule } from "../infrastructure/database/master/master-database.module.js";
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { MessagingModule } from "../infrastructure/messaging/messaging.module.js";
import { CacheModule } from "../infrastructure/cache/cache.module.js";
@Module({
  imports: [MessagingModule, CacheModule, MasterDatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
