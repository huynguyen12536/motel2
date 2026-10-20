// Phase 2: database access is owned by a Nest singleton, never by a module-level client.
export { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
export { MasterDatabaseModule } from "../infrastructure/database/master/master-database.module.js";
