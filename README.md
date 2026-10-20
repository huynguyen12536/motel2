# WMS APA Nano

Warehouse Management System for APA Nano.

## Repository Structure

FE/
Next.js frontend application.

BE/
Backend API application.

docs/
BRD, architecture, DB and API documentation.

.ua/
Repository knowledge graph.

## High-Level Architecture

Browser / Mobile
↓
Gateway
↓
┌─────┴─────┐
▼ ▼
FE /api
Next.js ↓
BE
↓
Database
↓
SAP

In production the intended same-origin layout is:

- `https://wms.apa.local/*` → Next.js frontend
- `https://wms.apa.local/api/*` → backend API (`/api/v1/...`)

The frontend talks to the backend over HTTP only. It does not query the database.

## Frontend routing (current Next.js app)

Defined under `FE/src/app/`.

## Backend API convention (future)

- `/api/v1/auth/...`
- `/api/v1/materials/...`
- `/api/v1/inventory/...`
- `/api/v1/inbound/...`
- `/api/v1/outbound/...`
- `/api/v1/quality-control/...`
- `/api/v1/reports/...`

The backend now uses NestJS on the existing Express application, with separate
Master/Tenant Prisma schemas and one shared motel infrastructure stack.
See [backend setup and verification](BE/README.md).

## Local development

One shared Docker project named motel serves the whole repository. The only Compose files are
compose.yaml and compose.dev.yaml. Development adds local PostgreSQL and the workers profile;
production uses Neon and includes no PostgreSQL container.

From BE/:

    pnpm docker:up
    pnpm docker:stop
    pnpm docker:start

Use pnpm docker:rebuild after image changes. See [infrastructure](BE/docs/infrastructure.md)
for the canonical root Compose files, reused volumes and local database setup.

Frontend on the host (not Docker):

```bash
cd FE
pnpm install
pnpm dev
```

See `FE/README.md` and `BE/README.md`.
