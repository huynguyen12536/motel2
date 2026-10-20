import { Global, Module } from "@nestjs/common";
import { MasterPrismaService } from "./master-prisma.service.js";
@Global()
@Module({ providers: [MasterPrismaService], exports: [MasterPrismaService] })
export class MasterDatabaseModule {}
