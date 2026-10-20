# Shared project infrastructure

The repository has one Docker Compose project: **motel**. Service containers are api,
postgres (development only), rabbitmq and redis. The optional full profile also starts
frontend. Projects are not divided by implementation phase.

Canonical files live at Motel/compose.yaml (production base) and Motel/compose.dev.yaml
(development override). Obsolete BE Compose files were removed.

## Development

From BE/:

    pnpm docker:up
    pnpm docker:stop
    pnpm docker:start
    pnpm docker:rebuild

Regular up/start reuses existing containers. Rebuild is explicit when dependencies or image
sources change. Stop keeps containers and volumes; docker:down removes containers but preserves
external data volumes. Never add -v.

The ignored BE/.env.docker.local stores the preserved local PostgreSQL credential and
MASTER_DATABASE_URL / MASTER_DIRECT_URL pointing to postgres:5432/motel_master. Existing
BE/.env and FE/.env were not modified. The local file is excluded from Git and Docker images.
On a new installation, supply this file with the PostgreSQL volume's actual credential and
local URLs before using the development override. The local Master database is initialized
explicitly with Prisma; migrations never run automatically during startup/build.

The original database motel, including its warehouse tables, is preserved. The separate
motel_master database on the same PostgreSQL server holds the current Master schema.
This is a Master database, not a provisioned Tenant Database.

| Service                    | Development host binding | Persistent storage                  |
| -------------------------- | ------------------------ | ----------------------------------- |
| api                        | 127.0.0.1:8080           | Application source bind mounts      |
| postgres                   | 127.0.0.1:5432           | Existing wms-apa-nano_postgres_data |
| rabbitmq                   | 127.0.0.1:5672 and 15672 | Existing motel-phase1_rabbitmq_data |
| redis                      | 127.0.0.1:6379           | Existing motel-phase1_redis_data    |
| tenant-provisioning-worker | none                     | none                                |

Historical volume names are retained to reuse data without copying or deleting it; they do
not create additional Compose projects. The unused original apanano Redis volume is retained
for recovery. The old apanano/phase1 containers and phase1 API image were removed after the
replacement stack was healthy.

## Production

Only use the base file, with an explicitly configured production environment:

    docker compose --env-file BE/.env -f compose.yaml config --services

It contains api, rabbitmq and redis, plus optional frontend. It contains **no PostgreSQL
service or PostgreSQL volume** and does not load .env.docker.local. Runtime database URLs come
from the production environment and point to Neon with verified TLS. Migration wrappers
require an explicit direct URL; migration deployment remains a separate authorized operation.
Broker/cache ports are unpublished in production; API binds to loopback for a gateway.
Do not switch this running development stack to production as part of a validation command.

## Verification

    pnpm test:master:integration

The runner reuses motel-postgres-1. It validates project/service/development labels, exact
container ID and loopback port. Each run creates a random restricted role and four uniquely
named test databases on that server, checks role/database ownership and UUID comments before
mutations, and removes only those databases/role in finally. It never creates, stops or removes
a container and never uses Neon or application databases. Do not recreate PostgreSQL while a
run is in progress; loss of container identity aborts database operations.

Prisma replay, upgrade, idempotency, diff/drift, catalogs and HTTP/constraint tests use these
isolated databases. Historical Phase 1/2 reports describe the earlier verification arrangement;
this document describes the current operational arrangement.

## Verified consolidation (2026-10-19)

- Shared project motel: four running, healthy services; old apanano/phase1 projects removed.
- Production Compose service list: api, rabbitmq, redis; no PostgreSQL service.
- Local motel_master: both Prisma migrations applied; original motel database preserved.
- Shared-container migration/constraint/HTTP runner: PASS, 34 tests; test database/role cleanup confirmed.
- Test-target safety unit tests: PASS, 8 tests. ESLint and Git whitespace checks: PASS.
- API readiness and Swagger: HTTP 200. Existing .env unchanged; Neon migration NOT APPLIED.

The first shared-container test run was interrupted by the configuration change recreating
PostgreSQL. Ownership checks stopped operations, the four verified test databases were cleaned,
and the full runner passed after the stack was stable. Subsequent tests create no containers.

## Optional SaaS worker

The same motel project runs tenant-provisioning-worker from compose.dev.yaml when the workers
profile is enabled. Development scripts enable that profile. The worker publishes no port and
defaults provisioning to disabled. compose.yaml has no worker and no PostgreSQL service.
Existing dev services are reused. The one-shot authorization-init service stays in compose.yaml
under the authorization-init profile and stays out of default startup.
See [SaaS operations](saas-operations.md) for health/configuration and [verification report](saas-implementation.md)
for isolated test evidence. This addition does not authorize migrating the existing dev Master or Neon.
