# Environment configuration

Neon project `apa-nano-prod` provides PostgreSQL; no API server deployment target is configured. Real `.env` files stay local and are gitignored. See `docs/ci-cd.md` for Prisma setup and release workflows.

## Runtime validation

`src/config/env.ts` parses environment variables with Zod when the process starts. `pnpm typecheck` and `pnpm build` run `tsc` only. They do not connect to PostgreSQL and do not require JWT secrets.

## Variables

| Key                      | Group      | Required at startup                | Secret     | Default                 |
| ------------------------ | ---------- | ---------------------------------- | ---------- | ----------------------- |
| `NODE_ENV`               | APP        | No                                 | No         | `development`           |
| `PORT`                   | APP        | No                                 | No         | `8080`                  |
| `APP_NAME`               | APP        | No                                 | No         | `wms-apa-nano-be`       |
| `LOG_LEVEL`              | LOGGING    | No                                 | No         | `info`                  |
| `LOG_DIR`                | LOGGING    | No                                 | No         | `logs`                  |
| `LOG_MAX_SIZE_MB`        | LOGGING    | No                                 | No         | `10`                    |
| `BODY_LIMIT`             | APP        | No                                 | No         | `1mb`                   |
| `DATABASE_URL`           | DATABASE   | One of this or `POSTGRES_PASSWORD` | Yes        | empty                   |
| `DIRECT_URL`             | MIGRATIONS | Required for `db:deploy`           | Yes        | empty                   |
| `POSTGRES_HOST`          | DATABASE   | No                                 | No         | `127.0.0.1`             |
| `POSTGRES_PORT`          | DATABASE   | No                                 | No         | `5432`                  |
| `POSTGRES_DB`            | DATABASE   | No                                 | No         | `motel`                 |
| `POSTGRES_USER`          | DATABASE   | No                                 | No         | `motel`                 |
| `POSTGRES_PASSWORD`      | DATABASE   | One of this or `DATABASE_URL`      | Yes        | empty                   |
| `POSTGRES_SSL`           | DATABASE   | No                                 | No         | `false`                 |
| `POSTGRES_POOL_MAX`      | DATABASE   | No                                 | No         | `10`                    |
| `REDIS_URL`              | REDIS      | No                                 | Yes if set | empty                   |
| `REDIS_PASSWORD`         | REDIS      | No                                 | Yes if set | empty                   |
| `CORS_ORIGINS`           | CORS       | No                                 | No         | `http://localhost:3000` |
| `JWT_ACCESS_SECRET`      | AUTH       | Yes                                | Yes        | none                    |
| `JWT_REFRESH_SECRET`     | AUTH       | Yes                                | Yes        | none                    |
| `JWT_ACCESS_EXPIRES_IN`  | AUTH       | No                                 | No         | `15m`                   |
| `JWT_REFRESH_EXPIRES_IN` | AUTH       | No                                 | No         | `7d`                    |

`DATABASE_URL` format: `postgres://USER:PASSWORD@HOST:PORT/DB_NAME`.

Redis keys are accepted by the schema and are not used by a client in `src/`. SAP, mail, object storage, and AI keys are not present.

After startup, `src/index.ts` pings PostgreSQL and exits if the database is unreachable. That check is runtime only.

## File logging

Logger code lives in the top-level `logger/` folder beside `src/`. Logs go to both the console and
`LOG_DIR/log` as redacted JSON lines. The default per-file limit is 10 MiB;
`LOG_MAX_SIZE_MB` accepts an integer from 1 to 1024. Change `LOG_DIR` to choose
another writable directory.

When full, the active file is archived as `log1`, then `log2`, and so on, and a
fresh `log` is created. Existing numbering continues after restart. Records are
not split: a single record larger than the limit gets its own oversized archive.
Archives are retained indefinitely. One API process must own each log directory.

`logs/` is gitignored and excluded from the Docker context. The container provides
a writable `/app/logs`; mount persistent storage there if logs must survive
container replacement. An overridden `LOG_DIR` must also be writable by `node`.
Shutdown drains queued file writes before exiting. File write failures fail the
stream rather than silently dropping records.

## Docker and CI

The Dockerfile builds offline and runs the API as a non-root user. `.dockerignore` excludes `.env` and `.env.*` except `.env.example`.

The image must receive `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and database settings when the container starts. Those values must not be copied into the image or passed as build arguments.

CI does not need environment variables or production secrets.

The manual migration workflow references a `production` environment with a `DIRECT_URL` secret. JWT and database secrets are not required to compile the application or run CI against its disposable PostgreSQL service.
