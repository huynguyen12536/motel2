# Database boundaries

master/MasterPrismaService is the single Nest owner of its pg.Pool, PrismaPg adapter and
Master PrismaClient. Resources are instance-private and are never shared with tenant clients.
One initialization promise deduplicates concurrent callers. The adapter uses
disposeExternalPool=false; the service disconnects Prisma and ends its pool exactly once,
including initialization failure and shutdown paths.

Active generated Master output: src/generated/master-registry.
The old ignored src/generated/master location is not imported by application code.
A pre-existing development image regenerates that legacy location from its bundled Phase 1
schema when restarting. The new output avoids overwriting Phase 2 without changing Compose.
src/database now re-exports the service/module, without a global client/adapter.
Health routes and the ping CLI use dependency injection.

Tenant output remains src/generated/tenant and is not instantiated.
Future tenant connection management, migration orchestration and Neon provisioning remain unimplemented.
