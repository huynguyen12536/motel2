# Multi-tenant backend implementation — Phase 3–6

Recorded 2026-10-19, Asia/Bangkok. This report covers implementation and isolated verification in the existing BE repository. It does **not** certify a live Neon deployment. Real provisioning remains disabled.

## A. Repository audit

The existing NestJS 12.1.3 application, Prisma CLI/Client/pg adapter 7.10.0, Zod validation, PlatformAdminGuard, MasterPrismaService and Tenant Registry were reused. Existing uncommitted user work was preserved. No dependencies, ORM or migration framework were added; pnpm and the lockfile remain in use.

The shared Docker project is motel. Its existing API, PostgreSQL development service, RabbitMQ and Redis were healthy during investigation. Read-only checks found two migrations in local motel_master: 20261014000000_initialize and 20261018000000_tenant_registry. Configured Neon contained only 20261014000000_initialize. Neon project/branch ownership, management credentials, budget and Master authorization were unconfirmed.

The Tenant schema had no models or migration history. This implementation adds only technical bootstrap and identity/session tables; it adds no warehouse, room, booking, invoice or other business entities. The prior Phase 2 registration contract still creates a PENDING operation without provisioning automatically.

## B. Architecture

Protected provision/retry requests take a short Master transaction: lock the tenant, reuse or create the operation, reserve deterministic resource identity, enforce the scoped resource budget, update lifecycle, save audit intent and insert the outbox event. No external API call runs inside that transaction.

The independent worker process hosts a bounded publisher, consumer and reconciler. PostgreSQL leases and fencing protect worker progress and final activation. Outbox claiming uses SKIP LOCKED; operation and rollout partial indexes remain final concurrency safeguards. Failed attempts, explicit retries and terminal outcomes remain auditable.

Routing checks authoritative Master status and mapping revision on every request. Redis stores non-sensitive identity/revision metadata only; failures cannot bypass Master checks. TenantPrismaManager owns a separate client, adapter and pool per tenant/revision, shares concurrent initialization, bounds physical pool admission, evicts idle clients and drains active requests during shutdown. Nothing sets a global current tenant or falls back to Master credentials.

Authentication resolves companyCode before accessing a tenant database. Password hashes, users and sessions belong to that database. JWT/session checks establish trusted tenant identity; headers and request fields cannot override it. Tenant roles and platform administration remain independent.

## C. Files

New application files:

- src/saas/contracts.ts, policy.ts, security.ts and safe-exception.filter.ts.
- src/saas/provisioning.service.ts, outbox.publisher.ts, broker.ts and provisioning.worker.ts.
- src/saas/neon.client.ts, neon.backend.ts and tenant-migrator.ts.
- src/saas/tenant-routing.ts, auth.service.ts, tenant-auth.guard.ts and migration-orchestrator.ts.
- src/saas/saas.module.ts, saas.controller.ts and operations.controller.ts.
- src/workers/provisioning.main.ts and provisioning.module.ts.
- src/operations/migrate-tenants.main.ts.

Prisma additions:

- prisma/master/migrations/20261019000000_saas_pipeline/migration.sql.
- prisma/tenant/migrations/20261019000000_tenant_identity/migration.sql and migration_lock.toml.

Verification and runtime additions:

- scripts/test-saas-integration.mjs, scripts/lib/saas-test-resources.mjs and scripts/run-saas-ci.mjs.
- tests/integration/saas.integration.test.mjs; tests/support/local-saas-backend.mjs and saas-worker.mjs.
- tests/unit/saas-security.test.mjs, saas-runtime.test.mjs and neon-adapter.test.mjs.
- tests/compose.saas-ci.yml and .github/workflows/saas-integration.yml.
- tenant-provisioning-worker in repository-root compose.dev.yaml and BE/docker/nginx/motel.conf.example.
- This report and saas-operations.md.

Modified integration points include Master/Tenant schemas, AppModule, main/Swagger, environment validation/example, RedisService, logging redaction/error handling, Tenant Registry's narrow provisioning insert projection, lifecycle policy, Dockerfile, package scripts, regression assertions and operational documentation. Existing .env files and live migration histories were not edited.

## D. APIs and security

All paths below use the existing /api/v1 prefix.

| Method/path                                      | Contract                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| POST /admin/tenants/:id/provision                | Platform key; 202 with tenantId, provisioningId, status; reuses initial PENDING operation                      |
| POST /admin/tenants/:id/provisioning/retry       | Platform key; failed lifecycle only; 202; creates a new operation while retaining history                      |
| GET /admin/tenants/:id/provisioning              | Platform key; page/limit, total and safe operation history                                                     |
| GET /admin/tenants/:id/provisioning/:operationId | Platform key; safe step, attempts, timestamps and error code/summary                                           |
| POST /admin/tenants/:id/users/bootstrap          | Platform key and explicit bootstrap flag; email/password; one-time Tenant Admin creation                       |
| POST /auth/login                                 | companyCode, email, password; access/refresh pair, Bearer type, expiresIn                                      |
| POST /auth/refresh                               | companyCode and opaque refresh token; atomic rotation                                                          |
| POST /auth/logout                                | Bearer/session required; immediate session revocation                                                          |
| GET /tenant/me                                   | Validated user, tenant, email and database-backed role                                                         |
| GET /tenant/admin/identity                       | Tenant Admin policy; technical identity/schema proof only                                                      |
| POST /admin/tenant-migrations                    | Platform key and rollout flag; approval reference and optional tenant IDs; creates a plan, does not execute it |
| GET /admin/tenant-migrations/:rolloutId          | Platform key; safe persisted per-tenant results                                                                |
| GET /admin/saas/metrics                          | Platform key; aggregate job states and this API instance's pool utilization                                    |

Zod rejects unexpected body fields and validates UUIDs, pagination, company codes and credentials. Disabled operations fail closed. Lifecycle/identity cannot be changed through the existing Tenant PATCH. Platform and Tenant guards are separate; reusable Roles/TenantRolesGuard policies read actual user roles from the selected tenant database.

Passwords use salted scrypt with fixed N=32768, r=8, p=3 and a bounded memory limit, following one of the [OWASP recommended scrypt configurations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). JWT validation pins HS256, issuer, audience, UUID identities, lifetime and session version. Access tokens last 15 minutes; opaque refresh sessions last seven days. Rotation invalidates the old access version; refresh replay revokes that session. Logout, disabled users and suspended tenants are checked server-side on subsequent requests.

Login limiting applies per IP and per company/email/IP. Redis supplies early rejection and Master counters preserve enforcement across cache outages/recovery and replicas. Tokens are returned with no-store headers. Raw provider responses, SQL errors, credentials and password hashes are excluded from responses/logs. Platform bootstrap writes audit intent before tenant changes and never generates a default password.

## E. RabbitMQ

Default topology:

| Object       | Name/behavior                                                                    |
| ------------ | -------------------------------------------------------------------------------- |
| Exchange     | tenant.provisioning.exchange, durable direct                                     |
| Main queue   | tenant.provisioning.requested, durable quorum                                    |
| Routing key  | tenant.provision.requested                                                       |
| Retry queues | tenant.provisioning.retry, .retry.2 and .retry.3; fixed TTL per exponential tier |
| DLQ          | tenant.provisioning.dlq, durable quorum                                          |

Persistent mandatory publishes await confirms and fail on returns/nacks/timeouts. Messages carry only versioned UUID metadata, correlation and event identity. Main/retry queues use quorum at-least-once dead lettering with reject-publish overflow; application handoffs use confirms before ACK. Prefetch and worker concurrency are bounded. There is no immediate infinite requeue loop.

Unknown versions/poison payloads are replaced by a fingerprint and safe reason in the DLQ; raw payloads are not copied. Broker handoff failure leaves the original unacknowledged. Consumer closure/restart and expired leases permit redelivery. A crash after confirmation can produce duplicates; Master state and leases make processing idempotent. These semantics follow [RabbitMQ quorum queue/dead-letter guidance](https://www.rabbitmq.com/docs/quorum-queues).

## F. Neon and credentials

NeonClient implements typed project, branch, database and connection-URI operations against the fixed official API origin. It validates target/resource identity and parses the real response envelopes. Timeouts, permissions, rate limits, conflicts and ambiguous POST outcomes become safe typed failures. See the official [database creation](https://api-docs.neon.tech/reference/createprojectbranchdatabase) and [connection URI](https://api-docs.neon.tech/reference/getconnectionuri) contracts.

Database names use a validated prefix and the full UUID without hyphens, independent of company names. Master stores reserved ownership tokens, provider identity, endpoint metadata and credential version, never a password or PostgreSQL URL. Retry retains the reserved name. Existing databases require the expected owner and exact ownership marker. Unmarked/ambiguous resources stop for operator review; no cleanup deletes tenant resources automatically.

A separately configured provisioning credential performs migrations and role setup. Tenant application roles are SQL-created non-owner roles with no superuser, role/database creation, inheritance, bypass-RLS or membership privileges. New tenant databases revoke PUBLIC access and explicitly grant their application role. Activation audits cross-database CONNECT permissions; an unsafe existing branch is rejected rather than silently changing other databases' ACLs. Neon documents that SQL-created roles differ from Console/API-created roles; see [role management](https://neon.com/docs/manage/roles).

The secret provider boundary derives distinct passwords with HMAC from an operator-supplied 32-byte root key, tenant/project/branch scope and version. A versioned keyring supports deliberate rotation. API runtime needs its credential provider but not the Neon management key or provisioning owner URL. Deployments must inject these secrets through their approved secret manager. Root keys never enter Master, Redis or messages.

## G. Prisma and lifecycle

Master changes are additive: leases/scheduling/progress, safe resource identity, rate buckets, security audit events and persisted migration rollouts. New CHECK constraints supplement Prisma's modeled schema; replay/catalog tests verify them. The initialization migration remains byte-identical and the Phase 2 migration is retained unchanged.

Tenant models are TenantBootstrap, User and AuthSession, plus TenantRole/UserStatus enums. Technical seeding upserts one identity marker and rejects a mismatched tenant. It creates no users or business data. The tenant runner uses installed Prisma 7.10, fixed argv/config, a validated tenant-specific direct URL, bounded runtime and sanitized output. It verifies migration checksums/history before recording schema readiness. It never runs reset/db push or falls back to Master.

ACTIVE means verified database ownership, connectivity, technical identity/authentication schema and technical seed readiness. A tenant still has no users until controlled bootstrap; no business functionality is implied. Final activation commits mapping/schema version, successful operation, tenant state and audit together, fenced by the live lease and verified mapping.

The rollout CLI is explicitly invoked with a persisted rollout UUID. It discovers eligible active mappings, uses bounded concurrency and per-tenant leases/partial uniqueness, preserves per-tenant results and resumes expired work. Failed SQL migrations require operator review; the runner does not fabricate success or automatically resolve failed Prisma history.

## H. Actual verification

| Check                                                 | Result                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| TypeScript typecheck and emitted build                | PASS                                                    |
| Prisma Master/Tenant validate and generate            | PASS                                                    |
| ESLint                                                | PASS                                                    |
| Ordinary Jest unit/smoke suite                        | PASS — 109 tests; external suites skipped intentionally |
| Master replay/upgrade/idempotency/diff/catalog runner | PASS, including 34 registry/integrity/HTTP tests        |
| SaaS isolated integration/E2E suite                   | PASS — 30 tests                                         |
| Logger rotation/redaction                             | PASS — 7 tests                                          |
| Existing RabbitMQ handshake/Redis PING                | PASS — 1 test                                           |
| Worker image build and Compose validation             | PASS                                                    |
| Local worker startup/health, provisioning disabled    | PASS                                                    |
| Existing API liveness/readiness, Swagger/OpenAPI      | PASS — HTTP 200                                         |
| Secret literal scan and Git whitespace check          | PASS                                                    |
| GitHub-hosted workflow execution                      | NOT RUN — workflow added; no push/dispatch              |
| Live Neon provisioning, migrations or restore         | NOT RUN — outside authorization                         |

The separately executed automated groups total 181 passing tests (109 + 34 + 30 + 7 + 1). Ordinary Jest's skipped external suites are covered by their explicit dedicated executions.

E2E uses the existing development PostgreSQL with random run-owned databases/roles, a loopback authenticated Neon HTTP mock, isolated RabbitMQ topology and standalone Nest worker processes. Tests cover duplicate requests, outbox claim races, rollback, lease expiry/fencing, migration failure/retry, real halfway-SQL rollback, worker crash/redelivery, unknown-resource refusal, two-tenant authentication and PostgreSQL privilege isolation, same-email identities, forged headers/tokens, RBAC, refresh replay/logout, suspension, cache-outage fallback, mapping corruption, operator rollouts and broker reconnection. Cleanup verifies ownership before removing only test resources; no existing database or volume is removed.

An initial test failure exposed Prisma's inability to deserialize advisory-lock void results; casting the result to text corrected it. Regression assertions were updated for narrow insertion projection and the third migration. Subsequent full suites passed. Real migration errors remain failures, with no automatic reset or adoption.

## I. Operational status

Code and local/mock verification are implemented. Real Neon provisioning is **DISABLED**. Master Neon Phase 2/new migrations are **NOT APPLIED**. The new Master migration is also not applied to the existing motel_master development database; only verified test-owned databases received it. Existing motel/other project data and .env files remain unchanged.

The worker overlay belongs to the same motel project and exposes no HTTP port. Its default disabled health state must not be interpreted as readiness for live provisioning. Production base Compose still has no local PostgreSQL. No production deployment, commit or push was performed.

Final read-only verification found all five local services healthy, worker status disabled with TENANT_PROVISIONING_ENABLED=false, and zero leftover run-owned test databases. Local motel_master still has only the two original migrations; configured Neon still has only 20261014000000_initialize. Both initialization SQL copies retain SHA-256 43636b583ef766e0459613bf05ef7f83e77c0952731643b665dab7625557d57a. Existing .env and .env.docker.local modification times are unchanged by this task.

## J. External blockers and limits

Live operation needs explicit Neon/Master ownership confirmation, approved resource budget, project/branch/endpoint identity, reviewed Master migrations, appropriate owner privileges and cross-database ACL policy, a managed credential key/keyring, JWT/platform credentials and separate authorization for a disposable live Neon test. Enabling one flag cannot bypass validation.

Tenant-admin identity delivery is an operator responsibility; bootstrap is disabled by default and requires a supplied strong password through an approved channel. No public registration, password reset, MFA, SSO, email delivery or unrelated business APIs are claimed. The Nginx example is not a deployed TLS gateway. External alert transport, backup scheduling, production retention and RPO/RTO need operator configuration. CI workflow execution and live disaster-recovery exercises were not performed.

Ambiguous Neon resources without trustworthy ownership proof intentionally require manual review. Failed Prisma history requires a reviewed recovery decision. Neither condition is hidden by a success status.

## K. Routing and next work

Dynamic tenant resolution, owned Prisma clients, metadata cache boundaries, JWT/session authentication and reusable RBAC are implemented and exercised across two isolated tenant databases. New tenants are discovered without changing a hardcoded database list or restarting the API. Future domain repositories can reuse TenantResolver/TenantPrismaManager while preserving the authenticated tenant context. Business schema and business modules remain separate future requirements.

Operational procedures and external authorization steps are in [saas-operations.md](saas-operations.md). Historical Phase 1/2 reports describe their original verification snapshots; this document is the consolidated implementation report.
