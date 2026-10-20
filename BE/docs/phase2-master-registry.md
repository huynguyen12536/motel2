# Phase 2 — Master Database and Tenant Registry

Phase 2 extends the existing BE application. It does not create tenant databases, publish
provisioning jobs or apply migrations to Neon.

## Master schema and migration history

Active schema: prisma/master/schema.prisma. Generated client: src/generated/master-registry.
Tenant schema/client remain separate and unchanged. Prisma CLI/client/pg adapter stay at 7.10.0.
No new ORM or migration framework is introduced.

The exact 105-byte baseline 20261014000000_initialize is copied unchanged into active Master
history. The legacy location remains intact. Baseline SHA-256:
43636b583ef766e0459613bf05ef7f83e77c0952731643b665dab7625557d57a

The new 20261018000000_tenant_registry migration adds four models and three enums.
Tenant code and slug are unique; initial lifecycle is PENDING_PROVISIONING.
TenantDatabase has unique tenantId and stores only resource metadata.
TenantProvisioning retains historical operations; a partial unique index permits only one
PENDING/RUNNING operation per tenant. OutboxEvent is persistence preparation only.

Prisma 7.10 partialIndexes is enabled only for the Master generator. Generated SQL:

    CREATE UNIQUE INDEX "tenant_provisioning_one_inflight_key"
    ON "TenantProvisioning"("tenantId")
    WHERE (status = ANY (ARRAY['PENDING'::"ProvisioningStatus", 'RUNNING'::"ProvisioningStatus"]));

Five custom PostgreSQL CHECK constraints enforce non-negative provisioning/outbox counters,
nonblank provider/identity values and complete Neon identity when provisionedAt is set.
Leading/trailing spaces, tabs and newlines are rejected. Database names preserve case
and are limited to 63 bytes.

Resource uniqueness is scoped by provider/project/branch, using databaseName and,
when present, neonDatabaseId. PostgreSQL NULL-distinct semantics permit incomplete metadata
for multiple tenants, while complete duplicate identities are rejected before or after
provisioning. Foreign keys use RESTRICT. There is no delete API.

Migration SQL is additive and transactional. No migrations run during startup/build.
Prisma does not fully model CHECK constraints: PostgreSQL catalog checks supplement schema diffs.
The .gitattributes migration rule keeps LF bytes stable across Windows/Linux checkouts.

## API contracts

All endpoints use the existing API_PREFIX, default api/v1, and require X-Platform-Admin-Key.

| Method | Path                      | Contract                                                                   |
| ------ | ------------------------- | -------------------------------------------------------------------------- |
| POST   | /api/v1/admin/tenants     | name/code/slug; atomically creates pending tenant and metadata; 201        |
| GET    | /api/v1/admin/tenants     | page=1, limit=20 (max 100), optional status/search; items/page/limit/total |
| GET    | /api/v1/admin/tenants/:id | safe metadata and latest provisioning; 200 or 404                          |
| PATCH  | /api/v1/admin/tenants/:id | name only; 200 or 404                                                      |

Name is trimmed, 1–200 characters without controls. Code is trimmed/uppercased, 1–64 ASCII
letters/digits/underscores starting with alphanumeric. Slug is trimmed/lowercased,
1–63 lowercase alphanumeric kebab-case characters.
Malformed input/UUID/query, empty PATCH and unknown fields return 400.
Protected identity/lifecycle fields return 403. Duplicate normalized code/slug, including
concurrent registration, return 409. Missing records return 404.
Database/schema failures return sanitized 503/500 responses; logs contain allowlisted Prisma codes only.

Lists sort createdAt DESC then id DESC; items/count use RepeatableRead for consistency.
Details never expose raw provisioning error fields, passwords or connection strings.

Reserved transitions: PENDING_PROVISIONING → PROVISIONING; PROVISIONING → ACTIVE or
PROVISIONING_FAILED; ACTIVE → SUSPENDED. ACTIVE requires a verified provisioned database.
These are policy definitions only. Retry/resume operations are not exposed.

## Interim administration

PLATFORM_ADMIN_SECRET has no default. Infrastructure starts without it, but administration
returns 503 without querying the database. With a configured secret, absent/wrong headers return 401.
Supply 32+ cryptographically random bytes encoded as base64url or hex.
Format/length checks cannot prove entropy. No secret is generated or written to .env by Phase 2.
The independent guard can later be replaced by platform-admin OIDC/JWT.

Swagger groups routes as Tenant Administration, documents contracts/error responses and API-key
authorization, and does not persist authorization. A docs-only CSP permits its local scripts/styles;
API responses retain their restrictive CSP.

## Runtime and verification

Current Docker/test-target operations are documented in [infrastructure.md](infrastructure.md).
The project now reuses the shared development PostgreSQL rather than creating a test container.

MASTER_DATABASE_URL is the pooled runtime URL; DATABASE_URL remains a legacy runtime alias.
MASTER_DIRECT_URL is explicitly required for migration/status wrappers; there is no pooled/legacy
migration fallback. The Master service owns its pool, adapter and client and closes them via Nest.
No tenant client is initialized.

From BE/:

    pnpm build
    pnpm typecheck
    pnpm lint
    pnpm db:validate
    pnpm test:unit
    pnpm test:smoke
    pnpm test:logger
    pnpm test:master:integration

The Master runner reuses motel-postgres-1 and creates four random run-owned test databases
and a restricted role. Exact container/project/service/development labels, loopback port,
database owner and run UUID comments are verified. Cleanup removes only test databases/role;
no containers or volumes are created/deleted. Replay, upgrade, idempotency, diffs, catalogs,
constraints and HTTP tests remain covered.

Only after separately approving the target and SQL may operators use:

    pnpm prisma:master:migrate:status
    pnpm prisma:master:migrate:deploy

These explicit commands do not authorize changing the current Neon database.
Phase 2 migrations have NOT been applied to Neon. They are applied only to local dev motel_master. The existing .env has not been changed.
Administration remains fail-closed until operators configure a secret and apply the reviewed
migration to an approved Master target.
