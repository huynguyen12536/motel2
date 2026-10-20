# Backend CI/CD and Neon

The backend currently uses Express (not NestJS). Prisma 7.10.0 is the persistence
adapter; this change adds infrastructure only, with no domain models or AI code.
`src/modules/chatbox/` is an empty local folder; Git does not track empty folders.

## Database

Neon project: `apa-nano-prod`, branch: `production`, PostgreSQL 18.
Existing database: `neondb`. Do not reset it or use `prisma db push` in production.

- `DATABASE_URL`: pooled connection from Neon Connect, for the API.
- `DIRECT_URL`: unpooled connection from Neon Connect, for Prisma migrations.
- Both are secrets, stored in ignored `.env` locally, and runtime secrets on the server.
- TLS certificate verification is enabled for Neon.
- Preserve independently generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

Commands:

```sh
pnpm install --frozen-lockfile
pnpm db:validate
pnpm db:generate
pnpm db:deploy
pnpm db:ping
pnpm dev
```

The initial migration creates only the `public` schema if absent. Prisma records
the migration in `_prisma_migrations`. No application tables or sample data exist.
`db:migrate` is for future model development against a development database only.
Generation/build/typecheck work offline; the fallback URL in `prisma.config.ts`
is exclusively for those tasks. `db:deploy` refuses to run without a direct URL.

## CI

`BE CI` runs on PRs into `develop` and pushes to `develop`, using Node 24 and
pnpm 11.22.0. Existing `typecheck` and `build` checks remain. New checks:

- `database`: disposable PostgreSQL 18 service; schema validation, client generation,
  migration deploy twice (idempotency), and Prisma connection ping.
- `docker`: builds the image without pushing and without production secrets.

CI never uses the production Neon database. Add the observed checks to branch
protection manually if required. No branch protection changes are automated.

## CD

`BE CD` runs only on pushed `vMAJOR.MINOR.PATCH` tags. It checks the format,
requires the commit to belong to `origin/develop`, refuses existing semantic image
tags, and publishes with GitHub's `GITHUB_TOKEN` (no PAT):

```text
ghcr.io/huynguyen12536/apa_nano_be:vX.Y.Z
ghcr.io/huynguyen12536/apa_nano_be:sha-<full-commit-sha>
ghcr.io/huynguyen12536/apa_nano_be:prod
```

`prod` and SHA tags are publication aliases; semantic tags are protected against
overwriting by the workflow. No release tag is created automatically. Tag only
after PR checks pass and the PR is merged into `develop`.

`BE Database Migration` is separately dispatched manually from `develop`, using
the `production` environment and its `DIRECT_URL` secret. Configure environment
reviewers before use if approval is required. No migration runs on a PR or during
image building. Migration failure fails the job.

The runtime image receives DATABASE_URL and JWT secrets at startup. It runs as
the node user and checks `/health`, including the Prisma DB ping. The image
contains no `.env`, Git metadata, migrations CLI, or secret build args.

No server deployment target has been configured. Publishing to GHCR and deploying
database migrations do not deploy the API to Northflank or another host.

Official references: [Prisma 7 configuration](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference),
[PostgreSQL driver adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).
