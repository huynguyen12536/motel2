# Tenant Registry — Phase 2

Controller, service and repository are separate DI layers.
TenantsRepository uses the exclusively owned MasterPrismaService client.
Registration atomically creates a pending tenant and one pending provisioning record.
It creates no TenantDatabase, OutboxEvent, queue or message.

One Tenant represents one company. PATCH changes only the company display name.
Identity, lifecycle, database identifiers and schema versions are immutable through this API.
Lifecycle definitions exist but no transition endpoint is implemented.
Future resolution, tenant authentication, dynamic connections and provisioning are out of scope.
See docs/phase2-master-registry.md.
