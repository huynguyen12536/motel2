# Casbin authorization and Settings operations

The API is the authority for access. UI visibility follows the same effective permissions but never replaces an API guard. Existing tenant routing, provisioning and Prisma migrations remain in place.

## Architecture

`src/modules/authorization` contains the catalog, immutable Prisma-backed Casbin adapter, domain-aware enforcement, platform sessions, management controllers and global guard. The model is `sub, dom, obj, act`, with domain-scoped role links and exact resource/action matches. Domains are `platform` and `tenant:<UUID>`; there are no wildcard grants. Casbin supports domain role inheritance, while this management API deliberately exposes flat roles only.

Master stores platform identities and policies. Each tenant database stores its own users and policies. `AuthzUserRole` has RESTRICT foreign keys to its identity and role. Relational rows are canonical; direct adapter mutation is prohibited. No credentials or connection URLs are policy attributes.

Each decision reads the current domain/catalog/revision in a database transaction. Enforcers are cached by domain and revision, with bounded size. A committed change is observed by the next decision on every instance, including after restart. In-flight decisions retain their transaction snapshot. State unavailability, wrong domain/catalog, missing configuration and unknown sensitive routes fail closed. Redis is not required for policy consistency.

Management transactions serialize on AuthzState, re-check the actor, enforce delegation within the actor's effective grants, replace assignments atomically, increment revision and audit. Protected system roles cannot be edited or deleted. Disabling/removing the last eligible ACTIVE platform super admin is rejected, including concurrent attempts.

## Authentication

Platform sign-in is `/auth/platform-sign-in`; tenant sign-in retains company code. PlatformUser/PlatformSession and `PLATFORM_JWT_SECRET` are separate from tenant identities, issuer/audience and JWT keys. Access tokens are memory-only in real frontend mode. Opaque rotating refresh tokens use an HttpOnly SameSite=Strict cookie through fixed same-origin BFF session routes. Refresh replay and logout revoke sessions. Cookie values, hashes and credentials never appear in permission responses.

Set `AUTH_PUBLIC_ORIGIN` on the frontend server to the exact browser origin. Configure the existing backend CORS allowlist for that origin. The BFF validates Origin and fetch-site before writes; do not trust arbitrary forwarded origins. Existing demo mode remains explicitly separate and cannot create a platform session.

Legacy `X-Platform-Admin-Key` is optional compatibility only: configure `PLATFORM_LEGACY_ADMIN_USER_ID` to an actual ACTIVE platform identity. The key must pass existing verification and the mapped account must pass current Casbin permissions. A key alone grants nothing.

## Catalog and API inventory

The 26 canonical codes and descriptions live in `src/modules/authorization/catalog.ts`. `docs/authorization-route-inventory.json` records actual Swagger routes, scopes, required permissions and coverage captured against an owned local test API. Swagger also publishes `x-required-permissions` and `x-authorization-scope`.

- Platform Settings: `platform.settings:read`.
- Registry list/detail: `platform.tenants:read`; register: `platform.tenants:create`; rename: `platform.tenants:update`; provision: `platform.tenants:provision`; retry: `platform.tenants:retry`.
- Platform role list: `platform.roles:read`; create/update/delete: `platform.roles:manage`.
- Platform permission catalog: `platform.permissions:read`; replace role grants: `platform.permissions:manage`.
- Platform users/list assignments: `platform.users:read`; create/status/assignment writes: `platform.users:manage`.
- Metrics: `platform.metrics:read`; rollout results: `platform.migrations:read`; rollout planning: `platform.migrations:manage`.
- Tenant Settings read/update: `tenant.settings:read`, `tenant.settings:update`; identity: `tenant.info:read`.
- Tenant users list/create/status/assignment: `tenant.users:read`, `tenant.users:create`, `tenant.users:update`, `tenant.users:assign` respectively.
- Tenant role list/write: `tenant.roles:read`, `tenant.roles:manage`; permission catalog/assignment: `tenant.permissions:read`, `tenant.permissions:assign`.

The relevant UI sections use these exact codes. `/auth/me/permissions` returns scope, current role assignments, effective permissions and policyVersion. Tenant session introspection requires a verified tenant session. Public login/refresh and health contracts are explicit exceptions.

## Migrations and controlled initialization

New migrations are `20261020000000_casbin_authorization` (Master) and `20261020000000_tenant_authorization` (Tenant). They add policy tables, identity references and CHECK constraints; Master also adds platform identities/sessions. Existing migration SQL is unchanged. Generated clients are `src/generated/master-authorized` and `tenant-authorized` to avoid stale development image regeneration collisions. Nothing migrates or seeds on image build or ordinary API startup.

For an approved environment, first record direct host, port, database, owner and authorization reference; inspect migration status and SQL. Back up according to that environment's existing procedure. Apply Master migrations using the existing explicit direct-URL Prisma deployment wrapper. Apply Tenant migrations through the existing approved rollout process, never by pointing Master migrations at tenant databases.

Then run a separately authorized initializer for each domain with all of:

- `AUTHZ_INIT_DATABASE_URL` (explicit direct credential, never pooled or runtime fallback)
- `AUTHZ_INIT_DOMAIN` (`platform` or `tenant:<UUID>`)
- `AUTHZ_INIT_AUTHORIZATION_REF`
- `AUTHZ_INIT_EXPECTED_HOST`, `AUTHZ_INIT_EXPECTED_PORT`, `AUTHZ_INIT_EXPECTED_DATABASE`, `AUTHZ_INIT_EXPECTED_OWNER`

For the designated platform account also inject `PLATFORM_BOOTSTRAP_ENABLED=true`, `PLATFORM_BOOTSTRAP_EMAIL`, and `PLATFORM_BOOTSTRAP_PASSWORD` (12–256 characters) through the secret manager. Build first, then `pnpm auth:seed` in BE. The initializer verifies target, owner and every applied migration checksum before seeding. Wrong/missing targets or credentials exit nonzero. Repeated runs preserve account ID/password and do not duplicate grants. An ordinary pre-existing account cannot be silently adopted. Remove bootstrap credentials and disable bootstrap after initialization. Runtime requires a separately generated `PLATFORM_JWT_SECRET`, different from tenant JWT secrets.

For Docker, opt in to profile `authorization-init` on the repository-root compose.yaml; inject approved values using the untracked `BE/.env.auth-init` secret-manager file, then run only `authorization-init` with `--rm --no-deps`. Do not enable it in default startup. It joins the existing infrastructure network, creates no database/volume and exposes no port. Base production Compose still has no PostgreSQL service; local development retains the shared project PostgreSQL service.

New tenant migration technical seed initializes catalog/system roles without creating users. Existing one-time tenant bootstrap atomically assigns TENANT_ADMIN. Repeated technical seed preserves revoked assignments. Existing tenant databases need the new tenant migration and explicit initializer before using authorization endpoints.

## Settings

`/settings` shows current verified identity/domain/roles/version. `/settings/roles` supports role CRUD and resource/action permission matrix with review/save/cancel; `/settings/users` supports account creation, status and role assignment; `/settings/tenants` and `/settings/tenants/<UUID>` show registration, safe metadata and persisted provisioning history. `/settings/operations` and `/settings/migrations` expose existing permission-gated operations.

Navigation and actions are permission-filtered before privileged queries render. Direct URLs show denied state. Failed permission refresh removes access; focus and five-second polling refresh current permissions, and API 403 triggers immediate invalidation. Backend revocation enforcement is immediate after commit; UI propagation is bounded by the refresh cycle while the tab is active. Provisioning acceptance (202) is not success: only persisted ACTIVE marks success. No synthetic percentages or production mocks.

## Verification

Run `pnpm test:authorization:integration` in BE for isolated database/API tests. Set `AUTHORIZATION_UI_E2E=true` for real connected Settings Playwright tests. The runner uses run-owned local databases/roles/queues, mock Neon only, random synthetic credentials and localhost ports. It verifies ownership and cleans only its own resources. No fallback to Neon or shared database URLs. Screenshot artifacts are under FE/test-results; test error artifacts are scrubbed of synthetic passwords.

See `docs/casbin-implementation-report.md` for actual results and remaining authorization boundaries. Persistent admin creation and Neon migration must never be inferred from successful disposable tests.
