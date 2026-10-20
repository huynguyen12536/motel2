# Environment configuration

No production server, domain, or database is configured. Real `.env` files stay local and are gitignored.

## Frontend

The browser calls the API through Axios `baseURL` from `NEXT_PUBLIC_API_URL` (`src/config/env.ts`, `src/lib/api/client.ts`). There is no relative `/api` proxy. Every `NEXT_PUBLIC_*` value is public and is inlined when `next build` runs.

| Key | Required | Build-time | Runtime | Public | Secret | Default |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | No | Yes | In bundle | Yes | No | `WMS APA Nano` |
| `NEXT_PUBLIC_API_URL` | No | Yes | In bundle | Yes | No | `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_DEMO_MODE` | No | Yes | In bundle | Yes | No | `true` |
| `NEXT_PUBLIC_API_CREDENTIALS` | No | Yes | In bundle | Yes | No | `true` |
| `PORT` | No | No | `pnpm dev` / `pnpm start` | No | No | `3000` |
| `DOCKER_BUILD` | No | Docker image only | No | No | No | unset; `true` selects Next standalone output |
| `E2E_BASE_URL` | No | No | Playwright only | No | No | local dev server |
| `CI` | No | No | Playwright only | No | No | set by GitHub Actions |

`pnpm env:init` also copies these local infrastructure placeholders into `.env`. The Next.js app does not read them: `APP_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`.

GLB warehouse models are static files under `public/models/warehouse/`. No CDN environment variable is used.

### Build and Docker

`pnpm build` succeeds with the defaults above. A clean shell does not need `.env`.

The frontend Dockerfile sets demo-safe build arguments:

- `NEXT_PUBLIC_APP_NAME=Workspace`
- `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1`
- `NEXT_PUBLIC_DEMO_MODE=true`
- `NEXT_PUBLIC_API_CREDENTIALS=true`

Those values are compiled into the image. One image cannot serve a different API URL later unless it is rebuilt. `.dockerignore` excludes `.env*`, so a local `.env` is not copied into the build context. Do not pass secrets as `NEXT_PUBLIC_*` build arguments.

CI `lint` and `typecheck` need no environment. CI `build` sets the same public demo values and no production secrets.

Future image publish can build without production secrets. A non-demo image must pass public build arguments, especially `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEMO_MODE=false`.

## Backend

`src/config/env.ts` validates `process.env` with Zod when the API process starts. `pnpm typecheck` and `pnpm build` only run `tsc`, so they do not need a database, Redis, or JWT secret.

| Key | Required at startup | Secret | Default |
| --- | --- | --- | --- |
| `NODE_ENV` | No | No | `development` |
| `PORT` | No | No | `8080` |
| `APP_NAME` | No | No | `wms-apa-nano-be` |
| `LOG_LEVEL` | No | No | `info` |
| `DATABASE_URL` | One of this or `POSTGRES_PASSWORD` | Yes | empty |
| `POSTGRES_HOST` | No | No | `127.0.0.1` |
| `POSTGRES_PORT` | No | No | `5432` |
| `POSTGRES_DB` | No | No | `motel` |
| `POSTGRES_USER` | No | No | `motel` |
| `POSTGRES_PASSWORD` | One of this or `DATABASE_URL` | Yes | empty |
| `POSTGRES_SSL` | No | No | `false` |
| `POSTGRES_POOL_MAX` | No | No | `10` |
| `REDIS_URL` | No | Yes if set | empty; no Redis client in source |
| `REDIS_PASSWORD` | No | Yes if set | empty; no Redis client in source |
| `CORS_ORIGINS` | No | No | `http://localhost:3000` |
| `BODY_LIMIT` | No | No | `1mb` |
| `JWT_ACCESS_SECRET` | Yes | Yes | none; minimum 32 characters |
| `JWT_REFRESH_SECRET` | Yes | Yes | none; minimum 32 characters |
| `JWT_ACCESS_EXPIRES_IN` | No | No | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | No | `7d` |

Database URL format when `DATABASE_URL` is set: `postgres://USER:PASSWORD@HOST:PORT/DB_NAME`. The source does not pin a PostgreSQL version. There is no SAP, mail, object storage, or AI key in the source.

JWT secrets are runtime-only. They must not be Docker build arguments, frontend variables, or GitHub values used only to publish an image.

This repository has no Dockerfile yet. A future image build should compile TypeScript without copying `.env`. `.dockerignore` already excludes `.env` and `.env.*` except `.env.example`. Database and JWT values are supplied when a container starts, not when an image is built.

CI `typecheck` and `build` need no environment and no production secrets.

## GitHub

Do not create staging or production GitHub Environments yet. Do not store `DATABASE_URL`, `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET` in GitHub for the current image-build phase.

Public frontend build arguments, if a later workflow overrides the Dockerfile defaults, belong in GitHub Variables. Runtime secrets belong in GitHub Secrets only after a server exists.
