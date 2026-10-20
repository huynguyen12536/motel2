# Motel backend

NestJS 12 on the existing Express 5 application, strict TypeScript, Prisma 7.10,
local development PostgreSQL / production Neon, RabbitMQ and Redis. Node **24.9+ in the 24 LTS line**,
pnpm **11.22.0**. One shared Compose project named motel is defined at the repository root.

## Implemented SaaS foundation

Provisioning/outbox/worker, dynamic tenant Prisma routing, tenant sessions/RBAC and controlled
migration operations are implemented and verified locally. Real Neon provisioning remains disabled.
New migrations are applied only to verified test-owned databases, not the existing dev Master/Neon.

- [Consolidated Phase 3–6 implementation report](docs/saas-implementation.md)
- [SaaS operations, configuration and recovery](docs/saas-operations.md)

## Quick start

Run all commands in `BE/`. Copy `.env.example` to `.env` **only if .env does not already exist**;
otherwise merge the documented new keys manually. Set independent RabbitMQ and Redis credentials.
The ignored .env.docker.local retains the existing local PostgreSQL credential and local Master URL.
See [infrastructure](docs/infrastructure.md) for dev/prod configuration.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:validate
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

Swagger: http://127.0.0.1:8080/api/docs
Liveness: http://127.0.0.1:8080/api/v1/health/live
Readiness: http://127.0.0.1:8080/api/v1/health/ready

For host development, start only the services, then start the API locally:

```sh
docker compose --env-file .env -f ../compose.yaml -f ../compose.dev.yaml up -d postgres rabbitmq redis --wait
pnpm dev
```

Do not run the Compose API and host API on the same port. `pnpm dev` performs an initial
build, then watches TypeScript and the emitted Node application. Changes to schemas need explicit generation.

## Verification

```sh
pnpm lint
pnpm test:unit
pnpm test:smoke
pnpm test:logger
pnpm db:validate
docker compose --env-file .env -f ../compose.yaml -f ../compose.dev.yaml config --quiet
```

`pnpm test` builds and runs Jest; the external connectivity test is skipped by default.
See [local development](docs/local-development.md) for the opt-in integration command.
Jest ESM uses Node's experimental VM modules flag. TypeScript compilation uses tsc directly,
with decorator metadata enabled; no Nest CLI dependency is required.

## Database safety

No migration is part of startup or Docker build. The dedicated Master integration runner applies
reviewed migrations only inside isolated run-owned databases on the existing development PostgreSQL. Normal API startup does not provision tenant databases or declare provisioning queues.
Dedicated SaaS tests use only run-owned temporary resources. Runtime clients are lazy and readiness queries Neon only with
`DATABASE_VERIFY=true`. Existing `DATABASE_URL` remains a runtime alias.
Legacy `prisma/schema.prisma` and migration history are retained as reference and are
**not** the active schema paths. The initial migration is copied byte-for-byte into the active
Master history; the additive Phase 2 migration has not been applied to Neon.

- [Phase 2 registry and verification](docs/phase2-master-registry.md)
- [Phase 2 implementation report](docs/phase2-report.md)
- [Architecture](docs/architecture.md)
- [Infrastructure and production considerations](docs/infrastructure.md)
- [Environment variables](docs/environment-variables.md)
- [Prisma and Neon](docs/prisma-neon.md)
- [SonarQube Cloud analysis](docs/sonarcloud.md)
- [Future provisioning](docs/tenant-provisioning-future.md)
- [Implementation and verification report](docs/phase1-report.md)

Older `docs/environment.md` and `docs/ci-cd.md` describe the pre-Phase-1 setup.
The documents linked above supersede their startup and migration instructions.

## Phase 2 verification

Run pnpm test:master:integration for fresh replay, upgrade, idempotency, diff/drift, PostgreSQL
constraints and real registry HTTP tests on the existing motel-postgres-1 container. Only run-owned
test databases and roles are removed afterward; containers and application data remain. Current admin routes require a verified platform identity and Casbin permissions; optional legacy keys also require an explicitly mapped persisted account. Phase 2 does not edit .env.

## Complete SaaS verification

Run pnpm test:saas:integration for the mocked-Neon/real-PostgreSQL/RabbitMQ pipeline, standalone
workers, authentication, tenant isolation and failure recovery. It reuses the current shared development
containers and cleans only run-owned databases, roles and broker objects.

compose.dev.yaml includes tenant-provisioning-worker under the workers profile. Development scripts
enable that profile in the same motel project and leave provisioning disabled. pnpm docker:worker:config
validates its configuration; it does not deploy live provisioning.

For current Neon discovery, local regression results and the live authorization boundary, see
[Phase 7 readiness](docs/phase7-readiness-report.md). `pnpm neon:readiness --env-file <explicit-file>`
performs read-only metadata checks; it never applies migrations or enables provisioning.

## Casbin authorization and Settings

[Authorization architecture and controlled initialization](docs/casbin-authorization.md) documents the new platform sessions, persisted role policies, Settings frontend, and opt-in seed job. See [implementation evidence](docs/casbin-implementation-report.md) for actual local results and pending persistent-environment migration/account creation.
