# Casbin RBAC, Settings and designated administrator — implementation report

Verification date: 2026-10-20. Scope: existing Motel/BE and Motel/FE. This report distinguishes completed implementation and owned local verification from persistent deployment. No commit, push, production deploy, Neon write or shared database migration was performed.

## A. Audit findings

The incumbent backend uses NestJS 12.1.3, TypeScript ESM, Prisma 7.10.0 with independent Master/Tenant clients and owned PostgreSQL pools, RabbitMQ provisioning/outbox, Redis caching, lifecycle validation and domain-scoped tenant authentication. The frontend uses Next16.3.4/React19, React Query, Axios, React Hook Form, next-intl and existing shadcn/Radix components.

Existing tenant JWT/session checks and server-authoritative tenant resolution were preserved. Previous role decisions used tenant enum roles and a platform administrative key, with no relational permission catalog. New administrative authorization now goes through Casbin. The existing key is an explicit persisted-identity compatibility path, not an implicit super admin.

The shared development PostgreSQL belongs to the existing motel Compose project and external volume. Its motel_master database still contains only 20261014000000_initialize and 20261018000000_tenant_registry; PlatformUser is absent. Tests use separate run-owned databases/roles on that verified container. Real Neon ownership was not inferred or modified. Historical Phase7 discovery is not treated as authorization for a live migration.

Next installed documentation was read before implementation. React Compiler/RHF compatibility required a narrow `use no memo` boundary on SignInForm/useSignIn: regression reproduced typed values being ignored, and validation/login/logout passed after the fix. Demo defaults now initialize once per mount. Existing demo behavior, including session persistence across reload, is retained. Regression tests explicitly clear fields/storage and use current accessible selectors rather than expecting an empty prefilled demo or an obsolete account label.

## B. Casbin architecture

Official casbin5.51.1 is pinned. Domain RBAC model uses exact `(subject, domain, object, action)` and scoped role links; no wildcard or role-name bypass. Prisma relational models are the source of truth, projected into an immutable Casbin adapter. Platform policies live only in Master; tenant policies live only in their resolved tenant database. Role inheritance is supported by the engine; management exposes flat roles and no inheritance mutation.

Every decision reads authoritative AuthzState/domain/catalog/revision and uses a bounded revision-keyed enforcer snapshot. A committed policy change affects the next decision on both tested instances, without Redis pub/sub. In-flight decisions retain their transaction snapshot. Mutation transactions lock state, re-evaluate actor grants, enforce limited delegation, audit and bump revision. Missing state/configuration or wrong domain/catalog denies access; sensitive unannotated routes deny by default.

## C. Permissions catalog

All 26 codes, their APIs and Settings surfaces are enumerated in [operations documentation](casbin-authorization.md#catalog-and-api-inventory). [Route inventory](authorization-route-inventory.json) was captured from actual owned API Swagger. There are 48 routes, including41 explicitly scoped routes and7 public/health/legacy-auth contracts; inventory records each permission/scope. Global guards enforce metadata before controllers. Integration exercises anonymous401 and insufficient-grant403 across the permission route matrix, not just UI hiding.

## D. Backend changes

New files:

- src/modules/authorization/catalog.ts, casbin.factory.ts, seed.ts.
- src/modules/authorization/platform-auth.service.ts, authorization.service.ts, permissions.guard.ts, authorization.controller.ts, authorization.module.ts.
- src/operations/authorization-init.main.ts.
- prisma/master/migrations/20261020000000_casbin_authorization/migration.sql.
- prisma/tenant/migrations/20261020000000_tenant_authorization/migration.sql.
- scripts/test-authorization-integration.mjs, tests/integration/authorization.integration.test.mjs, tests/unit/casbin-authorization.test.mjs, tests/support/bootstrap-platform.mjs.
- authorization-init service in repository-root compose.yaml; authorization operations/report/inventory documentation.

Integration changes include Master/Tenant schemas and generated client imports; existing tenant/provisioning/metrics/migration controller decorators and Swagger Bearer contracts; TenantsModule/SaasModule registration; tenant migration technical seed; one-time tenant-admin bootstrap assignment; non-owner tenant role grants; environment validation and logger redaction; package/lockfile; CI runner; registry/SaaS test fixtures and Swagger regression assertions; README and Prisma path documentation. Existing working code and unrelated changes were preserved.

Master adds PlatformUser and PlatformSession. Both schemas add AuthzState, AuthzPermission, AuthzRole, AuthzRolePermission, AuthzUserRole and AuthzAudit. RESTRICT identity/role/permission FKs prevent orphan grants. Singleton/positive revision, canonical platform email/status and positive session version CHECK constraints supplement Prisma. New SQL was generated by Prisma diff from pre-change schemas, inspected as additive and replayed transactionally. Earlier migration SQL/checksums are preserved.

## E. Full-access account

PLATFORM_SUPER_ADMIN is protected and receives the complete platform catalog; TENANT_ADMIN receives only tenant catalog permissions and TENANT_USER receives basic own-tenant access. The explicit initializer verifies direct target, expected owner and complete migration checksums before writing. Bootstrap requires operator-supplied enabled/email/password; there are no shared defaults or generated persistent credentials. Passwords use existing scrypt hashing.

Concurrent/repeated seed PASS: one designated synthetic account, stable accountID/hash, no duplicate assignments and no password reset. Existing ordinary accounts cannot be adopted. Missing credentials, wrong identity/owner/target and disabled designation fail. Tenant repeated seed preserves existing data and revoked assignments.

Disposable local designated account: CREATED AND VERIFIED, then removed with its test database. Designated persistent account: NOT CREATED. No operator email/password and approved persistent target have been supplied. The initializer/container exists for the reviewed, separately authorized post-migration step.

## F. Frontend

New real-API surfaces: `/auth/platform-sign-in`, fixed `/api/session/[action]` BFF, `/settings`, `/settings/[section]` and `/settings/tenants/[id]`. The new src/features/authorization directory contains typed API/session client, permissions hook, scoped Settings navigation, roles/matrix, users/assignment, tenants/details/history, operations and rollout components/styles. Existing shell, DataTable, dialogs, buttons, tokens and translations are reused. Four locales include the new namespace; EN/VI are complete, FR/DE retain English fallback for some administrative strings.

No privileged query/component renders before permission checks. Actions are scoped to effective grants; direct URLs deny. Role editing supports protected/read-only states, grouped matrix selection and unsaved-change protection; user role changes require review/confirmation. Registration shows PENDING and real persisted provisioning history;202 is acceptance only, ACTIVE must come from the backend. Errors/loading/empty/duplicate/conflict/pending states are surfaced. No production mock data was introduced.

Real access tokens are memory-only; rotating refresh is HttpOnly/SameSite=Strict via same-origin BFF. Context switch/logout clears cached permissions,401 refresh coalesces,403 invalidates permissions, focus and5s polling update visible actions. Backend revocation is enforced on the next decision; UI refresh is eventual while active. Mobile Settings uses x24/342px at390px viewport with local table overflow. Independent finish review resolved all four findings and returned ship. DESIGN.md and its sidecar now match actual operations-blue/SourceSans3/breakpoints.

## G. Actual verification

All results below are local, not CI or production claims.

- PASS — Backend ordinary Jest:128 passed,85 skipped external opt-in cases across4 suites. The skipped database suites were executed separately below.
- PASS — Master database/HTTP:34 tests; fresh replay, baseline upgrade, second deploy idempotency, clean schema diff, deliberate drift detection, partial predicates, CHECK/FK catalogs and concurrent constraints.
- PASS — SaaS Phase3–7 local regression:30 tests with real PostgreSQL/RabbitMQ and mocked Neon, workers, retries/recovery, auth and tenant isolation.
- PASS — Authorization database/API/seed:20 tests with connected UI enabled (19 core plus UI wrapper). Includes full permission matrix, limited delegation, protected roles, last-admin concurrent safety, two-instance revocation, restart/failure, scope separation, seed and explicit initializer refusal/success.
- PASS — Connected Settings UI:9 Chromium tests covering platform login/HttpOnly+CSRF, role matrix, user assignment, registration/provisioning lifecycle, readonly UI, direct denied route/no flash, revocation, responsive width and identity switch/logout.
- PASS — Logger:7 tests including new platform JWT/bootstrap/init-URL redaction.
- PASS — RabbitMQ handshake and Redis PING:1 test, no message publishing or queue declaration.
- PASS — BE build/typecheck/lint, both Prisma schema validations. FE production build/typecheck/lint.
- PASS — Local development API image rebuild/restart, liveness/readiness/Swagger HTTP200; anonymous admin401;41 guarded Swagger operations. All5 existing services healthy.
- PASS — Opt-in authorization initializer Compose parses with `--no-env-resolution`; no secret file or initializer execution on persistent targets.
- NOT RUN — GitHub-hosted CI, actual Neon management/provisioning, persistent initializer, production deployment. Frontend unit-style geometry/scroll/auth-client tests use the existing Playwright runner; there is no new Jest frontend test framework.

Full frontend regression result and final artifact locations are recorded in the closing verification addendum below. Initial regression failures were resolved through current selector/session expectations and the real RHF compiler boundary fix; the initial default-port attempt timed out because port3000 belongs to another existing application, so tests use18883.

## H. Operations

See [controlled migration and initialization sequence](casbin-authorization.md#migrations-and-controlled-initialization). Runtime never seeds/migrates automatically. Initializer runs explicitly after approved Prisma migrations; Docker profile is opt-in and has no new service database/volume. Production base Compose has no PostgreSQL service; development retains the one shared project database container. Only the local API was rebuilt/restarted for source/dependency consistency; existing database/cache/broker/worker services and volumes were retained.

Secrets needed from operator: separate platform signing key, designated bootstrap identity/password and explicit direct approved target/owner/reference. Frontend requires exact AUTH_PUBLIC_ORIGIN plus matching existing API CORS. `.env` and `.env.docker.local` were not edited. Failed/missing initialization denies protected routes; health availability does not mean a designated account exists.

## I. Security and concurrency review

No newly identified unresolved issue in the tested authorization paths. Coverage verifies no cross-domain grants, no unverified token/header role trust, no key-only implicit superadmin, no grant beyond delegation authority, no raw credential/hash exposure, no mutable protected role and no removal of the last eligible superadmin. Master and Tenant identity FKs and state locks protect consistency. Refresh rotation is single-use; disabled accounts are rejected. Platform and tenant JWT keys/issuers/audiences remain distinct. Logger and response tests check sensitive-field absence.

This is implementation-specific evidence, not an exhaustive security audit. Operators must restrict database write access: direct privileged SQL can change policies outside audited APIs. Migrate/seed use privileged credentials only in explicit operations, never frontend or API policy payloads. Network/cache failures deny protected access instead of reusing stale authorization.

## J. Remaining boundaries

Code: implemented. Owned local behavior: verified. Local disposable full-access test account: created/verified/cleaned. Persistent designated account: NOT CREATED. New Casbin migrations on shared development DB: NOT APPLIED. Neon migrations/provisioning: NOT APPLIED/NOT RUN. Production deployment/readiness: pending approved target/ownership, migrations, secret injection, controlled initializer, live E2E and operational sign-off.

Do not use a healthy local API as evidence that persistent Settings login is ready: current shared schema deliberately remains unchanged. Review the two new migration SQL files and initializer target parameters before authorizing that next environment step.

## Closing verification addendum

Final frontend regression: PASS37, SKIP9 connected-only cases; those9 ran separately and PASS9 against the owned real API. This includes5 existing demo flows,5 auth-client tests and27 geometry/scroll/model cases. The final connected authorization run again PASS20 (including the9 UI cases). Frontend production build, typecheck and lint PASS after the form fix. Official guidance for the narrow compiler boundary: [React compiler directives](https://react.dev/reference/react-compiler/directives); installed Next reactCompiler guide documents the same opt-out.

Reviewed screenshots: `../../FE/docs/screenshots/authorization-settings-desktop.png` and `../../FE/docs/screenshots/authorization-settings-mobile.png`, synthetic disposable accounts only. Independent finish reviewer disposition: ship. Known persistent secret literal scan of new authorization code/tests/docs found no matches. Persistent dev schema remained unchanged and no run-owned test databases or roles remained after cleanup.
