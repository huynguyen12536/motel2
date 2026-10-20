# Environment variables

No real credentials are committed. dotenv loads BE/.env without replacing existing process variables.
Validation errors report variable names and omit supplied values.
Never copy .env.example over an existing .env.

| Variables                                        | Requirement / behavior                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| RABBITMQ_USER, RABBITMQ_PASSWORD, REDIS_PASSWORD | Required, nonempty, independent credentials                                                             |
| NODE_ENV                                         | development (default), production, test                                                                 |
| APP_PORT / PORT                                  | APP_PORT wins; PORT defaults to 8080; valid TCP ports                                                   |
| APP_NAME, API_PREFIX                             | wms-apa-nano-be and api/v1 defaults                                                                     |
| RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_VHOST     | 127.0.0.1, 5672, / defaults                                                                             |
| REDIS_HOST, REDIS_PORT                           | 127.0.0.1, 6379 defaults                                                                                |
| REDIS_URL                                        | Optional redis:// or rediss:// connection; Compose clears host-local overrides                          |
| MASTER_DATABASE_URL                              | Optional pooled PostgreSQL runtime URL; Neon requires sslmode=require or verify-full                    |
| DATABASE_URL                                     | Legacy runtime alias, lower precedence than MASTER_DATABASE_URL                                         |
| MASTER_DIRECT_URL                                | Explicit unpooled master migration URL; never falls back to runtime URL                                 |
| TENANT_DATABASE_URL, TENANT_DIRECT_URL           | Legacy template / explicit tenant CLI migration URL; dynamic routing uses verified per-tenant mappings  |
| DATABASE_VERIFY                                  | false default; true requires a master runtime URL; enables read-only readiness and legacy health checks |
| POSTGRES_POOL_MAX                                | 10 default; 1–100 connections; tenant pools have their own separately bounded budgets                   |
| POSTGRES_SSL                                     | false default; Neon always uses verified TLS regardless                                                 |
| NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID    | Worker Management API identity; live writes require explicit authorized enablement                      |
| LOG_LEVEL, LOG_DIR, LOG_MAX_SIZE_MB              | info, logs, 10 defaults; 1–1024 MB rotation threshold                                                   |
| SWAGGER_ENABLED                                  | true default; only literal true or false                                                                |
| CORS_ORIGINS, BODY_LIMIT                         | http://localhost:3000, 1mb defaults; existing HTTP behavior                                             |
| JWT_ACCESS_SECRET, JWT_REFRESH_SECRET            | Optional for startup; random access key required for tenant authentication; refresh tokens are opaque   |
| JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN    | Legacy settings retained; implemented session contract is fixed at 15m access / 7d refresh              |
| API_HOST_PORT                                    | Compose-only published API port, default 8080                                                           |
| RUN_INFRA_INTEGRATION                            | Test-only true explicitly enables external RabbitMQ/Redis checks                                        |

Legacy POSTGRES_HOST/PORT/DB/USER/PASSWORD keys remain parsed for compatibility, but runtime no
longer constructs a local database URL from them. Set MASTER_DATABASE_URL or DATABASE_URL explicitly.
DIRECT_URL remains a legacy .env key only; new migration commands require MASTER_DIRECT_URL.

For host development use 127.0.0.1. Inside Compose use service DNS names rabbitmq and redis.
Production uses verified Neon TLS; the development override selects local motel_master. Existing database credentials alone
do not opt into readiness queries. Provisioning credentials must never be passed to FE or
used as application database roles. Log events never include full connection strings.

## Phase 2 administration

PLATFORM_ADMIN_SECRET is optional for startup but required for administration. There is no default.
Supply 32+ cryptographically random bytes encoded as base64url or hex (43–128 characters).
Format checks cannot guarantee entropy. Send it only through X-Platform-Admin-Key.
Missing configuration returns 503; missing/wrong credentials return 401 once configured.
The implementation does not edit .env.

MASTER_TEST_OWNERSHIP and MASTER_TEST_DATABASE_URL are private inputs from the integration runner,
not production configuration. Never point them at Neon or a shared database.

## SaaS configuration

The new switches, pool/cache limits, broker topology and credential settings are listed in .env.example.
All resource/bootstrap/rollout switches default to false. See [SaaS operations](saas-operations.md) for
the API/worker credential separation, keyring rotation and explicit authorization requirements.
SAAS_TEST_CONTEXT is a private local runner/worker-fixture input, never a production setting.
