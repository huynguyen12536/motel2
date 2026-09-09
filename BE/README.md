# WMS APA Nano Backend

Express + TypeScript API. Routes live under `/api/v1/`.

## Local development

PostgreSQL and Redis run from the repository Compose file:

```bash
docker compose --env-file FE/.env up -d postgres redis --wait
```

Copy `BE/.env.example` to `BE/.env`. Set `POSTGRES_PASSWORD` (and `REDIS_PASSWORD`) to the same values as `FE/.env`. Default API port is `8080` so it matches `NEXT_PUBLIC_API_URL`.

```bash
cd BE
pnpm install
pnpm db:ping
pnpm dev
```

Health:

- `GET http://127.0.0.1:8080/health`
- `GET http://127.0.0.1:8080/api/v1/health`

## Layout

- `src/config` — env, logger, CORS, security headers
- `src/database` — PostgreSQL pool (`pg`)
- `src/infrastructure/http` — Express app and middleware
- `src/shared` — cross-module utilities
- `src/modules` — domain modules (not implemented yet)
- `migrations/` — schema migrations (not initialized)
