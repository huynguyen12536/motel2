# Phase 2 implementation report

> Historical verification snapshot. The shared project configuration in [infrastructure.md](infrastructure.md) supersedes the Docker startup and test-target instructions below.

Recorded 2026-10-19 (Asia/Bangkok), in the existing Motel/BE repository.

Implementation and isolated verification are complete. **The Phase 2 migration is NOT APPLIED to Neon.** No commit, push, deployment or Phase 3 provisioning was performed.

## A. Investigation and preservation

The repository instructions, Git working tree, Nest modules, Prisma configuration and migration history, Compose configuration, environment configuration, RabbitMQ/Redis adapters, health endpoints, Swagger and existing tests were inspected before implementation. Existing user work was preserved.

Read-only Neon investigation found only public._prisma_migrations and the completed 20261014000000_initialize migration. The final read-only check confirmed the same state. The intended Master project/branch and ownership remain unconfirmed; no remote schema changes were authorized or attempted.

The original 105-byte initialization migration remains intact. Its byte-identical copy now belongs to the active Master migration directory. Both have SHA-256:

    43636b583ef766e0459613bf05ef7f83e77c0952731643b665dab7625557d57a

The .gitattributes rule preserves migration SQL LF bytes. Git comparison shows no changes to compose.yml, compose.dev.yml, Dockerfile or the legacy initialization migration. No writes were made to .env; its recorded modification time remains 2026-10-18 22:03:08. Only .env.example documents the optional admin secret. No dependencies or alternative migration frameworks were added.

## B. Database and client ownership

The Master schema defines Tenant, TenantDatabase, TenantProvisioning and OutboxEvent, with UUID keys, lifecycle enums, defaults, timestamps, query indexes and RESTRICT foreign keys.

MasterPrismaService is a Nest singleton that owns its own pg.Pool, PrismaPg adapter and generated Prisma Client. Its shared initialization promise prevents duplicate concurrent initialization. Failed initialization releases resources before retry; shutdown waits for initialization, disconnects the client and ends the pool in finally, is idempotent and prevents reinitialization. disposeExternalPool is false. No Tenant Client is instantiated or adapter shared with one.

Repositories, health checks and the database ping CLI use dependency injection. Missing database configuration fails safely without preventing Phase 1 infrastructure from starting. Client output is src/generated/master-registry, separate from the older image's src/generated/master output. This avoids a development-image startup generator overwriting the new client. The source watcher restarted the development API while source changes were incomplete; no existing Docker service was rebuilt, recreated or explicitly restarted for Phase 2.

## C. Migration and integrity evidence

Prisma CLI, Client and PostgreSQL adapter are 7.10.0. The Master generator alone enables partialIndexes. Prisma generated the Phase 2 SQL; the reviewed migration adds four tables, three enums, indexes and foreign keys, plus five explicit SQL CHECK constraints inside a transaction. It contains no data manipulation or destructive schema operations.

The partial unique index tenant_provisioning_one_inflight_key has predicate:

    status = ANY (ARRAY['PENDING'::"ProvisioningStatus", 'RUNNING'::"ProvisioningStatus"])

PostgreSQL catalog checks, full migration replay, upgrade replay, introspection and Prisma schema diffs verified this predicate. Concurrent PENDING/PENDING, RUNNING/RUNNING and PENDING/RUNNING inserts for one tenant each allow exactly one active record and reject the other at the database layer. Finished history and separate tenants remain allowed.

TenantDatabase permits incomplete nullable metadata. A provisioned mapping requires provider neon, project ID, branch ID and database name. Nonblank identity checks reject boundary whitespace including tabs/newlines, and database names retain case. Composite unique constraints scope database name and optional database ID by provider/project/branch. Tests verify PostgreSQL NULL-distinct behavior, rejection of complete duplicate identities even before provisionedAt, and allowance of separate projects/branches. No globally unique nullable Neon ID is used.

CHECK constraints enforce nonnegative provisioning/outbox attempt counts. Because Prisma does not fully represent CHECK constraints, direct catalog and rejection tests supplement schema diff checks.

Migration/status wrappers require an explicit target-specific direct URL. Startup and build never deploy migrations. Neon migration status: **NOT APPLIED**.

## D. Registry and API protection

The controller/service/repository split implements:

| Endpoint                        | Verified behavior                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| POST /api/v1/admin/tenants      | 201; transaction creates one pending Tenant and one pending provisioning record, counter zero |
| GET /api/v1/admin/tenants       | Pagination, status/search filters, total, deterministic createdAt/id descending ordering      |
| GET /api/v1/admin/tenants/:id   | Safe tenant/database metadata and latest provisioning, or 404                                 |
| PATCH /api/v1/admin/tenants/:id | Name only; protected fields rejected                                                          |

Zod validates and normalizes inputs; DTOs document Swagger contracts. Default pagination is page 1/limit 20, maximum limit 100. Validation returns 400, protected fields 403, duplicate normalized identifiers 409, missing records 404 and unavailable database/schema 503. Concurrent duplicate registration and transaction rollback are covered.

PlatformAdminGuard protects every route with X-Platform-Admin-Key. There is no default secret; absent configuration fails closed with 503, and missing/wrong credentials with configured protection return 401. SHA-256 digests are compared in constant time. Logs redact the secret/header; responses omit raw provisioning error fields and credentials. The interim key guard is an explicit boundary for later platform authentication.

Swagger groups routes under Tenant Administration, documents errors and API-key authentication, and does not persist credentials. A documentation-only CSP permits local Swagger assets while retaining the restrictive API policy.

Lifecycle policy permits pending to provisioning, provisioning to failed or active, and active to suspended; activation requires verified database readiness. No route persists lifecycle transitions. Registration creates no database mapping, outbox event, message or tenant database.

## E. Isolated PostgreSQL test target

The integration runner creates its own PostgreSQL 18 bookworm container, with a UUID ownership label, random credentials, dynamic localhost port and tmpfs storage. Its four test databases are phase2_fresh, phase2_upgrade, phase2_diff and phase2_registry. These are disposable Master-schema test databases, not Tenant Databases.

Before mutations the runner validates the exact container ID, ownership label, loopback port, role, database allowlist and storage. URLs are constructed exclusively from that container and explicitly replace environment database URLs; there is no .env/Neon fallback. Cleanup in finally checks ownership and temporary-directory containment, removes only its container and temporary files, and never deletes volumes.

| Migration verification                                                | Actual result   |
| --------------------------------------------------------------------- | --------------- |
| Fresh migration replay and status                                     | PASS            |
| Baseline-only replay followed by Phase 2 upgrade                      | PASS            |
| Fresh/upgraded catalogs and baseline checksum equivalence             | PASS            |
| Second deploy leaves schema/history unchanged                         | PASS            |
| Prisma live/schema and introspected schema comparisons                | PASS            |
| Harmless drift detected on separate database; diff SQL not executed   | PASS            |
| Enum, foreign key, unique/partial index and CHECK catalogs            | PASS            |
| Concurrent provisioning, identity constraints and HTTP registry suite | PASS — 34 tests |
| Owned test-container cleanup                                          | PASS            |

## F. Actual test results

| Command/group                                        | Result                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| pnpm typecheck                                       | PASS                                                                   |
| pnpm lint                                            | PASS                                                                   |
| pnpm db:validate                                     | PASS — Master and Tenant schemas                                       |
| pnpm test, including generation and TypeScript build | PASS — 6 suites, 70 tests; 2 opt-in suites/35 tests skipped            |
| pnpm test:master:integration                         | PASS — build, replay/diff/catalog checks and 34 integration/HTTP tests |
| pnpm test:logger                                     | PASS — 7 tests, including admin secret/header redaction                |
| Opt-in existing RabbitMQ/Redis connectivity test     | PASS — 1 test; AMQP connection and Redis PING                          |
| git diff --check                                     | PASS                                                                   |
| Migration applied to Neon                            | NOT RUN — prohibited; NOT APPLIED                                      |
| Phase 3 tenant provisioning                          | NOT RUN — out of scope                                                 |
| Commit, push or deployment                           | NOT RUN — prohibited                                                   |

Across the separately executed test groups, 112 tests passed (70 + 34 + 7 + 1). The ordinary Jest command intentionally skips the opt-in external suites; their dedicated executions above supply the missing evidence.

One final sandboxed attempt could not access Docker's named pipe before creating a container. The same authorized isolated runner was then executed with Docker access; this is an execution-permission distinction, not a passing test result for the failed attempt.

## G. Existing infrastructure checks

Read-only checks found the existing API, RabbitMQ and Redis healthy. Live HTTP verification returned:

| URL                   | Result                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| /api/v1/health/live   | 200                                                                           |
| /api/v1/health/ready  | 200; RabbitMQ/Redis up, optional Neon readiness skipped                       |
| /api/docs/            | 200                                                                           |
| /api/docs-json        | 200                                                                           |
| /api/v1/admin/tenants | 503, expected because the existing environment has no configured admin secret |

The dedicated isolated HTTP tests cover authenticated registry behavior against the migrated test schema. Existing-stack health does not imply the unmigrated Neon database is ready for registry operations.

## H. Deliverables and operational boundary

Core additions are the Master schema/history, MasterPrismaService/module, tenant DTO/controller/service/repository/module, lifecycle policy, admin guard, Zod pipe, owned PostgreSQL runner and unit/integration tests. Existing application wiring, health/ping integration, logging redaction, migration wrapper, environment example and Swagger configuration were updated. Usage and contracts are documented in phase2-master-registry.md, prisma-neon.md, environment-variables.md and README.md.

Remaining operational steps require a separately approved Master target, reviewed migration application and operator-supplied admin secret. They are deliberately outside this implementation. No tenant database creation, RabbitMQ provisioning publisher/consumer, outbox worker or Neon Management API implementation is included.
