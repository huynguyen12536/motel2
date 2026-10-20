# Future tenant provisioning — design only

> Current Phase 3–6 implementation and runtime boundaries are documented in [saas-implementation.md](saas-implementation.md) and [saas-operations.md](saas-operations.md). Earlier milestone descriptions below are historical context.

No Neon Management API calls, tenant databases, roles, queues, publishers, consumers,
tenant authentication or dynamic Prisma registry are implemented.

Future configuration requires NEON_PROJECT_ID, NEON_BRANCH_ID and a server-only NEON_API_KEY.
A project contains branches; a branch can contain multiple databases. A tenant database is
not automatically a branch or a project. Choose isolation based on workload and operational
requirements rather than creating a project per tenant by assumption.

Future ordered workflow:

1. Record tenant registry state and a stable provisioning operation ID in the master database.
2. Publish a versioned durable job through an outbox with publisher confirms.
3. A worker reads the project/branch mapping and reconciles existing resources before creating them.
4. Create a database and a dedicated least-privilege application role through approved Neon APIs.
5. Store encrypted connection references: pooled runtime and direct administration URLs.
6. Run reviewed tenant migrations with explicit direct credentials and a version/concurrency lock.
7. Verify schema/version and connection permissions, then atomically activate the tenant.
8. Acknowledge only after durable state transitions; use bounded retry and dead-letter handling.

Use scoped provisioning credentials in the worker only. Never use the Neon API key in a frontend,
or a privileged administrative role for normal application traffic.
Separate application roles from migration/administration roles and restrict tenant ownership.

After an uncertain API response, query/reconcile resource existence using the persisted operation
mapping before retrying creation. A timeout does not prove creation failed. Persist intermediate
states and resource IDs; implement idempotent transitions, bounded exponential backoff, jitter,
rate-limit handling and manual recovery for ambiguous conflicts. Do not automatically delete
resources during compensation without a reviewed ownership and safety policy.

Database-per-tenant scaling is bounded by current Neon project/branch/database/role quotas,
connection limits, compute, storage, API rate limits and plan pricing. Shared branches also share
compute and operational characteristics. Read current limits before capacity planning;
do not bake fixed quota or price assumptions into runtime code. Budget total connections across
all tenant pools, cap cached clients and dispose idle clients. Schema rollout must support
bounded concurrency, failed tenants, audit history and resumability.

References:

- [Neon databases](https://neon.com/docs/manage/databases)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon plans](https://neon.com/pricing)
- [Neon API reference](https://api-docs.neon.tech/reference/getting-started-with-neon-api)
