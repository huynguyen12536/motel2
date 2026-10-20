# Phase 7 — Neon integration and operational readiness

Observed 2026-10-19, approximately 15:11–15:20 UTC (22:11–22:20 Asia/Bangkok). This report replaces historical test counts for this verification run. **Local verification PASS; live Neon E2E NOT RUN; Neon migrations NOT APPLIED.** No production-readiness claim is made.

## A. Repository and implementation

Work stayed in the existing Motel/BE repository. Root AGENTS.md was read; no nested BE instructions were found. Both the parent repository and BE already had substantial uncommitted changes. They were preserved; no commit, push, production deployment, existing container restart/recreation or volume removal was performed.

Installed versions verified from local packages: Node 24.14.1, NestJS 12.1.3, Prisma CLI/client/adapter 7.10.0; packageManager pins pnpm 11.22.0. The lockfile was inspected and not modified by this task. Master and tenant Prisma schemas/configuration, all migration SQL, worker/broker/outbox, Redis, tenant resolution/client ownership, auth/RBAC, Compose, validation, tests and operations documents were inspected.

Changes in this task:

- `src/saas/neon.backend.ts`: added a read-only branch ACL preflight **before** database or application-role creation. Previously cross-database CONNECT was caught during final verification, after resources/migrations could already exist. The new guard returns `BRANCH_ISOLATION_POLICY_REQUIRED` when another connectable non-template database grants CONNECT to PUBLIC. It never revokes unrelated ACLs; final role/membership/CONNECT verification remains in place.
- `scripts/neon-readiness.mjs` and `scripts/lib/neon-readiness.mjs`: explicit-input read-only audit. Verified TLS, `BEGIN READ ONLY`, catalog-only SELECTs, rollback/finally close, migration checksum comparison, safe provider GETs, allowlisted response metadata, no raw errors or credential output. It never starts the application/worker or invokes migrations. Existing output files are not overwritten.
- `scripts/neon-e2e-plan.mjs` and its library: offline dry-run workflow; no network or live execution path. It reserves no resource, grants no authorization and fabricates no provider/tenant identity.
- Added 14 automated regression tests: twelve readiness/plan tests and two ACL guard tests. The guard SQL was additionally exercised against the actual local PostgreSQL catalogs in a read-only transaction.
- Added review-only API/worker configuration templates under `docs/config/`, evidence JSON, this report, and `pnpm neon:readiness`.

Existing `.env` and `.env.docker.local` timestamps remain `2026-10-18T15:03:08.854Z` and `2026-10-19T02:45:50.660Z`. `.env.worker` remains absent. No credential was generated, replaced or rotated.

## B. Actual Neon discovery

Evidence: [read-only Neon snapshot](neon-readiness-2026-10-19.json). The script explicitly selected DATABASE_URL from `.env` for **reading only**; it does not make that URL a migration target.

| Item                                              | Actual observation                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Configured hostname                               | `ep-blue-forest-b50pytem-pooler.c-7.us-east-2.aws.neon.tech`                                |
| Connected database                                | `neondb`                                                                                    |
| Connected PostgreSQL role                         | `neondb_owner`                                                                              |
| PostgreSQL                                        | 18.6; `max_connections=901` observed, not an approved application budget                    |
| Transaction                                       | `transaction_read_only=on`; verified TLS                                                    |
| Project ID / Branch ID / branch name              | **UNVERIFIED**; none configured; not inferred from hostname                                 |
| Ownership / dev-staging-production classification | **UNVERIFIED**                                                                              |
| API credentials/permissions                       | API key absent; no Management API call executed                                             |
| SQL role privileges                               | CREATEDB, CREATEROLE, BYPASSRLS, INHERIT; not a superuser; member of neon_superuser         |
| Visible non-template databases                    | `neondb` owned by neondb_owner; `postgres` owned by cloud_admin                             |
| PUBLIC CONNECT                                    | Enabled on both databases: **live isolation blocker**                                       |
| Visible PostgreSQL roles                          | 20 including system roles; not a count of tenant roles or proof of remaining API quota      |
| Existing tenant databases                         | None in the visible SQL inventory; provider inventory unverified                            |
| Long transactions at audit                        | No other transaction older than one minute; no ungranted lock observed in selected database |
| Backup/history/restore configuration              | **UNVERIFIED**                                                                              |

The available owner credential demonstrates SQL flags only; database/role creation was **not tested**. Master runtime credentials are not separated from this high-privilege external credential. A non-owner runtime role and a separate approved migration credential are required before live activation.

Neon documents limits of 500 databases and 500 roles per branch, but actual project restrictions, quota usage and approved cost budget still require provider/account confirmation. SQL-created application roles avoid the additional privileges attached to Console/API-created roles. See [databases](https://neon.com/docs/manage/databases) and [roles](https://neon.com/docs/manage/roles). Provider discovery uses only documented [list databases](https://api-docs.neon.tech/reference/listprojectbranchdatabases) and [list roles](https://api-docs.neon.tech/reference/listprojectbranchroles) GET operations when explicit credentials/IDs are supplied.

## C. Master migrations and safety

| Migration                      | SHA-256                                                            | Neon              | Existing local motel_master |
| ------------------------------ | ------------------------------------------------------------------ | ----------------- | --------------------------- |
| 20261014000000_initialize      | `43636b583ef766e0459613bf05ef7f83e77c0952731643b665dab7625557d57a` | Applied, matching | Applied, matching           |
| 20261018000000_tenant_registry | `6342e9af79ea8eba9170a8d2d6f3032363e4da067996478084b6fda83c7341e7` | Pending           | Applied, matching           |
| 20261019000000_saas_pipeline   | `1c0f776765ec561123432847a9da366a91aed9ff87aa7ca55966e51fa5d82815` | Pending           | Pending                     |

No failed or checksum-mismatched migration was found on either existing Master candidate. Both initial SQL copies retain the same bytes/hash. Ordering was checked against actual records. Neon public schema contains only `_prisma_migrations`; registry/outbox/security/rollout structures and their constraints are absent. Existing local Master has the five Phase 2 CHECKs and provisioning partial unique index; see [local catalog snapshot](local-master-readiness-2026-10-19.json).

Pending SQL was read: Tenant Registry adds three enums, four tables, indexes, three types of identity/attempt checks and two RESTRICT foreign keys. SaaS pipeline adds metadata/lease/scheduling columns, three tables, indexes, six CHECKs and one RESTRICT foreign key. Both migrations use BEGIN/COMMIT. There is no DROP, TRUNCATE, existing-row DELETE or destructive repair. ALTER/constraint validation still takes locks; additive SQL is not a zero-lock guarantee.

On fresh owned local databases, actual Prisma 7.10 runs passed full replay, initialization-baseline upgrade, second-deploy idempotency, fresh/upgraded/schema diffs, deliberate harmless drift detection and catalog verification of eleven CHECKs and both active-operation partial unique indexes. Concurrency and nullable/scoped Neon identity constraints passed. Tenant migrations/replay and failed halfway-SQL rollback were exercised separately by the SaaS suite.

**Neon deploy/status/diff: NOT RUN.** MASTER_DIRECT_URL is absent and the only available external URL is pooled. No direct endpoint, project ownership, classification or usable recovery point was assumed. The live catalog audit identifies the missing schema; it is not a complete Prisma drift attestation. A live Prisma status/diff and recovery check must precede any approved deployment. `migrate deploy` alone is insufficient for drift detection, and Prisma diff does not cover custom CHECK definitions.

After explicit target/direct-credential confirmation, the reviewable commands from BE are:

```text
pnpm prisma:master:migrate:status
node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/master/schema.prisma --config prisma.config.ts --script --exit-code
# Only after approval of exact target, pending hashes, locks and recovery:
pnpm prisma:master:migrate:deploy
pnpm prisma:master:migrate:status
```

Secrets must be injected by the approved secret manager; no URLs belong in command history. Review diff output; never execute it as a substitute for the committed migrations. Repeat catalogs/diff after deployment. Failure response: disable new work, preserve Prisma failure history, inspect actual transaction state, rehearse a forward repair or approved recovery on a disposable equivalent. No automatic reset, resolve, down migration or branch restore.

## D. Runtime infrastructure

All five existing `motel` services were healthy: API, PostgreSQL, RabbitMQ, Redis, tenant-provisioning-worker. [Runtime metadata](runtime-readiness-2026-10-19.json) records container IDs/start times and secret-presence booleans only. API/PG/Rabbit/Redis ports bind localhost; worker publishes none. Production base Compose has no PostgreSQL. Production and worker Compose `config --quiet` checks passed; no `up`, restart or rebuild was issued.

Worker health is explicitly **disabled**, not evidence of provisioning readiness. Its current image was not rebuilt with this source patch. API uses the existing development source mount. Provisioning, bootstrap and rollout flags remain false. API has no platform-admin secret or tenant keyring; worker has no Master/Neon credentials. These are documented blockers, not configuration silently supplied by this task.

The idle shared RabbitMQ vhost had no queues and only built-in exchanges after test cleanup. This is consistent with a disabled worker: live topology has not been declared. The isolated suite declared and verified run-owned quorum queues, retry/DLQ, mandatory confirms, ACK/redelivery, outbox and worker recovery, then removed only its own topology. Existing broker and Redis connectivity passed independently. Health live/ready, Swagger HTML/OpenAPI, JavaScript and CSS returned HTTP 200; Swagger CSP permits its assets while API CSP remains restrictive.

Master service owns a singleton client/adapter/pool with shared lazy initialization and idempotent shutdown. Tenant manager owns separate clients/pools, verifies identity, bounds admission/eviction and drains active work. No tenant client shares an adapter with Master.

## E. Security and credential review

| Boundary                      | Verification / remaining requirement                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform admin                | Constant-time digest guard and fail-closed missing config tested; runtime secret absent                                                                           |
| Master runtime vs migration   | Explicit deploy direct URL required; separate Neon runtime role not configured                                                                                    |
| Neon API vs worker PostgreSQL | Separate settings/interfaces implemented; both credentials absent                                                                                                 |
| Tenant credentials            | Distinct HMAC tenant/project/branch/version scope; no password/URI in Master or broker payloads; keyring required                                                 |
| Root-key rotation             | Version retained in mapping and client fingerprint; retain old keys and migrate to new version/role deliberately; never replace bytes under an in-use version     |
| JWT/session                   | Pinned HS256/issuer/audience, DB-backed user/session status, refresh CAS/rotation/replay/logout tested; production secret validation/rotation is operator work    |
| RBAC/routing                  | Role comes from correct tenant DB; authenticated tenant context ignores caller tenant headers; two-database tests passed                                          |
| TLS                           | Neon audit verifies server certificate; runtime/migrator require approved exact hosts and verified TLS                                                            |
| Application roles             | Local non-owner, no elevated flags/memberships; cross-database SQL CONNECT denied in tests; real Neon policy blocked                                              |
| Secrets in files/logs         | `.env*` secret files ignored and not tracked; known configured literal scan found zero matches in source/scripts/tests/docs/prisma; logger redaction tests passed |

The literal scan is scoped evidence, not a claim of exhaustive Git-history secret scanning. No real credentials were rotated. Secret-manager injection is not operationally configured; do not enable live features until API/worker share the intended versioned keyring, separately scoped credentials, access controls and recovery escrow.

## F. Actual local results

| Check                                                      | Result                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Typecheck, emitted build, both generated Prisma clients    | PASS                                                                                       |
| ESLint and Master/Tenant Prisma validate                   | PASS                                                                                       |
| Ordinary Jest                                              | PASS — **123**; 65 external tests intentionally skipped here and executed separately below |
| Master migration runner and registry/constraint/HTTP suite | PASS — **34**, plus replay/upgrade/idempotency/diff/drift/catalog checks                   |
| SaaS integration/E2E                                       | PASS — **30**, rerun after backend guard change                                            |
| Logger                                                     | PASS — **7**                                                                               |
| Existing RabbitMQ handshake + Redis PING                   | PASS — **1**                                                                               |
| Actual local PostgreSQL ACL preflight query                | PASS — expected safe refusal, READ ONLY                                                    |
| Compose production/worker validation                       | PASS                                                                                       |
| Existing health/Swagger + JS/CSS HTTP checks               | PASS                                                                                       |
| Secret literal scan / Git whitespace                       | PASS                                                                                       |
| GitHub CI execution / production image deployment          | NOT RUN                                                                                    |

**195 distinct automated tests passed (123 + 34 + 30 + 7 + 1)**; repeated executions are not added to the total. This includes 14 new tests. Test targets were random run-owned local databases/roles on the existing motel-postgres-1, a loopback Neon mock, isolated broker topology and independent test worker processes. No Neon write tests were used.

The initial sandbox attempt could not reach Docker; pnpm's dependency precheck attempted an install and aborted before removal because no TTY was available. Subsequent supported commands ran with host access and `--config.verify-deps-before-run=false`, using installed pinned dependencies. An initial new-script lint error was fixed before the final PASS. No unresolved test failure remains.

## G. Real Neon E2E — NOT RUN

| Requested step                                 | Live result / reason                                             |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| 1. Master readiness/migrations                 | READ-ONLY inspection PASS; readiness blocked; deployment NOT RUN |
| 2. Register A                                  | NOT RUN — target/authorization absent                            |
| 3. Request provisioning                        | NOT RUN — live provisioning disabled                             |
| 4. Outbox persistence/confirms                 | NOT RUN on Neon; local coverage PASS                             |
| 5. Live queue delivery/consumer                | NOT RUN; isolated local coverage PASS                            |
| 6. Neon DB/role creation                       | NOT RUN — IDs, ACL policy, secrets and budget unverified         |
| 7. Real tenant Prisma migration                | NOT RUN                                                          |
| 8. Tenant activation                           | NOT RUN                                                          |
| 9. Real admin bootstrap                        | NOT RUN — separate authorization/credentials required            |
| 10. Real login/refresh                         | NOT RUN                                                          |
| 11. Tenant B                                   | NOT RUN                                                          |
| 12. Real two-tenant isolation                  | NOT RUN — branch PUBLIC CONNECT blocker                          |
| 13. Controlled real recovery/failure scenarios | NOT RUN; test-owned local coverage PASS                          |
| 14. Final live resource/metadata consistency   | NOT RUN; baseline read-only inventory recorded                   |

[Dry-run plan](neon-e2e-dry-run-2026-10-19.json) generated distinct A/B company codes and slugs offline, with a bounded proposed budget of two databases/two application roles, no new project/branch. Tenant UUIDs must come from the authorized API; database names/role names derive from those UUIDs. No resource was reserved. An isolated API port/worker process/queue namespace is proposed to preserve the current stack. Operator-supplied test identities/passwords stay out of the plan and logs.

For the eventual authorized run, assert protected registration/provisioning responses, persisted operation/outbox IDs, broker confirmation, provider resource IDs/markers, exact Prisma checksums, technical seed, role flags and cross-database ACLs before accepting ACTIVE. Bootstrap two independently supplied passwords with the same email, verify each JWT routes to its own identity, refresh/logout/RBAC and forged-header refusal. Restart only the test worker or its connection; never stop the shared RabbitMQ/Redis containers for a failure test. Redis-outage and invalid-mapping probes must remain scoped to owned test state and must not corrupt live tenant data.

## H. Resource inventory and cleanup

Live resources created: **none** (no tenant registrations, databases, roles, branches, projects, live queues or real sessions). Existing `neondb`, `postgres`, motel databases/volumes and services were preserved. Test runners created random owned local resources only; verified cleanup completed, and no matching test database remained at final check.

If live E2E is later approved, inventory every server-generated tenant/operation/event UUID, provider database ID/name/project/branch, SQL role/ownership marker, Prisma checksums and isolated broker object. Keep that inventory after verification. Prepare a separate cleanup request identifying each exact object and dependencies; no automatic live DROP, role deletion or broad prefix cleanup is authorized.

## I. Production readiness

| Classification              | Assessment                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Code complete               | Authorized local readiness tooling/guard work complete; existing foundation preserved |
| Local verified              | YES — 195 automated tests and checks above                                            |
| Neon development verified   | NO — connectivity/catalogs only; live E2E NOT RUN                                     |
| Operationally configured    | NO                                                                                    |
| Production deployment ready | NO — not assessed as ready; no deployment performed                                   |

Implemented: durable outbox/confirmed RabbitMQ handoff, bounded retries and DLQ, lease/fencing/reconciliation, graceful shutdown, bounded client pools, safe auth/roles, guarded migration rollout and protected metrics. Actual HA/failover of the single-node broker was not tested.

Operator configuration still required: designated owners/on-call; external metrics/log retention and alert delivery; queue-age/DLQ/outbox/lease/failure/pool alerts; approved connection budget per replica; workload/performance tests; secret-manager integration and rotation drill; gateway TLS and trusted proxy policy; request-throttling validation at ingress; CI migration environment approvals; immutable image rollback and expand/contract SQL rollout practice.

Backups require an approved Master/tenant/keyring strategy, retention/access policy and measured restore rehearsal. **RPO/RTO are UNSET and unmeasured.** Neon instant restore is currently root-branch scoped and affects all databases on that branch, so shared-branch PITR cannot be assumed to restore only one tenant. Verify actual supported topology/history window and consider approved per-database logical recovery; no backup or restore operation was performed. See [Neon instant restore](https://neon.com/docs/postgres/backup-restore/branch-restore).

## J. Blockers

| Missing requirement                            | Why it blocks / resolution                                                                 | Operator involvement                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Authoritative project/branch and dev ownership | Cannot authorize host-derived guesses; supply IDs and read-scoped provider metadata/access | Required confirmation                                                                                       |
| Master designation/direct migration credential | Current URL is pooled, privileged and not explicitly selected as Master                    | Required confirmation + secret injection                                                                    |
| PUBLIC CONNECT isolation policy                | New roles could CONNECT to Master/postgres; guard refuses before creation                  | Separate ACL approval; provider support/alternative design if cloud-admin database ACL cannot be controlled |
| Pending Master schema and live drift check     | Registry/outbox/security/rollout absent on Neon                                            | Exact migration approval after target/recovery verification                                                 |
| API/worker/platform/keyring configuration      | Runtime cannot safely provision/bootstrap/authenticate tenants                             | Secret-manager preparation and scoped enablement approval                                                   |
| Quota/budget and recovery                      | Account headroom, cost, history topology, RPO/RTO unknown                                  | Operator/provider verification; backup/restore actions separately authorized                                |
| Live E2E authorization                         | Current spec explicitly withholds live writes                                              | Approve bounded operations only after above facts are verified                                              |

## K. Exact next action and approval package

The immediate request is **information**, not blanket write approval: confirm the Neon Project ID, Branch ID, development ownership and whether `neondb` is the intended Master. Supply credentials through an approved secret store/file, never chat. Re-run the read-only discovery with explicit input:

```text
pnpm neon:readiness --env-file <operator-approved-config-file> --output <new-audit.json>
node scripts/neon-e2e-plan.mjs --readiness <new-audit.json> --output <new-plan.json>
```

No live approval request can yet be fully populated: Project ID/Branch ID are unknown. Once verified, use this bounded change package:

| Field               | Exact review scope to fill before asking approval                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target              | Verified Project ID + Branch ID + direct endpoint + selected Master database; no other target                                                                                              |
| Migration           | Pending registry/pipeline migrations with the hashes in section C; status/diff/catalog review first                                                                                        |
| ACL                 | Exact database/role grants needed to preserve legitimate access before any specifically approved PUBLIC CONNECT change; no unrelated automatic revocation                                  |
| E2E                 | Only planned A/B registrations; two UUID-derived tenant databases and two SQL application roles; owned technical/auth data and explicit bootstrap                                          |
| Impact              | Additive Master objects/columns/constraints and possible locks; two retained tenant databases/roles; approved isolated queue objects; no new project/branch                                |
| Risk                | Wrong target, lock waits, privilege disruption, shared-branch recovery scope, storage/compute cost; each must be reviewed for that target                                                  |
| Recovery            | Verified backup/restore point and owner, preserved migration history/markers, stop new intents, reviewed forward repair or separately approved recovery; no automatic destructive rollback |
| Cost/resource limit | Two tenant databases/two application roles plus separately inventoried control roles if needed; finite provider/connection budget; cleanup remains separate                                |

The explicit boundary comes from section 0 and sections 6/12/17 of the user's Phase 7 specification: existing Neon migrations, resource creation/deletion, real-data changes and live enablement require exact-operation approval. All independent safe work above was completed before stopping at that boundary.
