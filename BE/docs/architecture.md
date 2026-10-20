# Phase 1 architecture

> Current Phase 3–6 implementation and runtime boundaries are documented in [saas-implementation.md](saas-implementation.md) and [saas-operations.md](saas-operations.md). Earlier milestone descriptions below are historical context.

A single NestJS API is bootstrapped through an ExpressAdapter around the existing
Express application. Existing root metadata, /health and /api/v1/health routes, request
IDs, CORS, body limits, security headers and Pino file rotation remain available.
The legacy health routes report database=skipped when verification is disabled.

Registered modules: AppModule, HealthModule, MessagingModule, CacheModule.
LifecycleService releases the database and logger after module destruction.
SIGTERM/SIGINT trigger Nest shutdown hooks; Docker init forwards signals and reaps children.

The API starts even when Redis or RabbitMQ is unreachable. Readiness is 503 until both
are connected. RabbitMQ retries every three seconds with a three-second socket timeout;
heartbeat detects dead connections. Redis reconnects with a three-second interval and timeout.
No queues, channels, publishers or consumers are declared.
Redis PING is bounded to two seconds. Database checks use a bounded connection and query timeout.

Liveness is always 200 while the process is serving HTTP. Readiness includes RabbitMQ,
Redis and optional Neon, reports only up/down/skipped, and never returns connection details.

Future boundaries:

- modules/tenants: Tenant Registry and Tenant Resolver.
- modules/auth: tenant authentication and authorization.
- infrastructure/database: master metadata, tenant client manager, migration runner and Neon client responsibilities.
- infrastructure/provisioning: provisioning service and worker.
- infrastructure/messaging/contracts: future versioned broker contracts.

These are documented boundaries, with no unused placeholder providers or endpoints.
No business tables, tenant routing, database creation or provisioning jobs exist.
The existing src/database path is retained as a compatibility facade.
