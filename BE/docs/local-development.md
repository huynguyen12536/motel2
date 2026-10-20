# Local development

Use Node 24.9+ (<25), pnpm 11.22.0 and Docker Desktop Linux containers. Work in BE/.
The project uses one shared motel stack, with PostgreSQL available only in development.
See [infrastructure](infrastructure.md) for preserved volumes and local credential setup.

    pnpm install --frozen-lockfile
    pnpm docker:up

Stop/start without removing containers:

    pnpm docker:stop
    pnpm docker:start

Rebuild after image/dependency changes:

    pnpm docker:rebuild

Swagger: http://127.0.0.1:8080/api/docs
Readiness: http://127.0.0.1:8080/api/v1/health/ready
RabbitMQ management: http://127.0.0.1:15672

The development API uses motel_master on the shared local PostgreSQL. Existing BE/.env may
retain Neon URLs because the development-only local env file overrides them. It is ignored
by Git and excluded from the image. No Neon migration is performed.

    pnpm lint
    pnpm test
    pnpm test:logger
    pnpm test:master:integration

Master integration tests reuse the development PostgreSQL container and clean only their
random run-owned databases and role. Do not restart/recreate the database during tests.
External RabbitMQ/Redis tests remain opt-in with RUN_INFRA_INTEGRATION=true and explicit
localhost broker/cache configuration. They connect and ping without publishing messages.

To run the API on the host, stop only its Docker service, retain postgres/rabbitmq/redis,
and explicitly set runtime database URLs to 127.0.0.1 instead of the Docker hostname postgres.
Set DATABASE_VERIFY=true for local readiness verification. Never overwrite existing .env files.

Production configuration is the repository-root compose.yaml alone; it has no local PostgreSQL.
