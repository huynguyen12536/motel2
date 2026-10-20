# Prisma 7 and Neon

> Current Phase 3–6 implementation and runtime boundaries are documented in [saas-implementation.md](saas-implementation.md) and [saas-operations.md](saas-operations.md). Earlier milestone descriptions below are historical context.

Installed Prisma, @prisma/client and @prisma/adapter-pg versions remain aligned at 7.10.0.
The pg adapter is appropriate for this long-running TCP-connected Node service.
Prisma 7 datasource URLs live in config files; schema files contain only provider and generator.

| Boundary | Schema                      | Config                  | Generated TypeScript          | Migration directory      |
| -------- | --------------------------- | ----------------------- | ----------------------------- | ------------------------ |
| Master   | prisma/master/schema.prisma | prisma.config.ts        | src/generated/master-authorized | prisma/master/migrations |
| Tenant   | prisma/tenant/schema.prisma | prisma.tenant.config.ts | src/generated/tenant-authorized          | prisma/tenant/migrations |

Outputs are ignored, generated explicitly and compiled into dist/src/generated.
The Master schema contains the four Phase 2 registry models; the tenant schema remains intentionally empty.
The legacy schema/history remain unchanged. The verified initial migration is copied into the
active Master history. Phase 2 adds an additive migration that has not been applied to Neon.
Do not deploy new history over an existing database until its existing migration history has
been reconciled and a migration plan reviewed.

```sh
pnpm prisma:master:generate
pnpm prisma:tenant:generate
pnpm db:validate
```

Runtime: MASTER_DATABASE_URL (or legacy DATABASE_URL) should use the Neon -pooler hostname.
Migration administration: MASTER_DIRECT_URL / TENANT_DIRECT_URL must use an unpooled hostname.
CLI configs have an offline dummy URL for generation/validation only; deployment wrappers
require explicit valid direct URLs and reject pooled hosts. They do not accept a fallback.

The `database` CI job sets `MASTER_DATABASE_URL` and `MASTER_DIRECT_URL` to its disposable
PostgreSQL service. Local PostgreSQL does not require Neon TLS parameters; Neon hosts still
require `sslmode=require` or `verify-full`. CI deploys twice and runs a connection ping.
The manual production migration workflow requires the `production` environment secret
`MASTER_DIRECT_URL`; the legacy `DIRECT_URL` secret is not read by the wrapper.

Future manual deployment commands, **not executed during Phase 1**:

```sh
pnpm prisma:master:migrate:deploy
pnpm prisma:tenant:migrate:deploy
```

Only SELECT 1 is used by health verification, and only with DATABASE_VERIFY=true.
No database clients are instantiated merely on module import. No tenant clients are constructed.
Neon TLS is enforced with certificate validation; SSL URL options are normalized before passing
explicit verified TLS options to pg. Connection, query and statement timeouts are bounded.
Never use db push, migrate reset or destructive schema commands on the existing Neon database.

Official references:

- [Prisma configuration](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Prisma PostgreSQL drivers](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
- [Neon Prisma guidance](https://neon.com/docs/guides/prisma)

## Phase 2 migration verification

See [Master Registry](phase2-master-registry.md) and [actual results](phase2-report.md).
The Master runner uses an owned local PostgreSQL container, tmpfs and dynamic loopback port.
The installed Prisma 7.10 partialIndexes feature represents the one-in-flight provisioning index;
PostgreSQL CHECK constraints are verified through catalogs alongside clean Prisma diffs.
