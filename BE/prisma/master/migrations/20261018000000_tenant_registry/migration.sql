BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING_PROVISIONING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'PROVISIONING_FAILED');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_PROVISIONING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "activatedAt" TIMESTAMPTZ(3),
    "suspendedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDatabase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'neon',
    "databaseName" VARCHAR(63),
    "neonProjectId" VARCHAR(255),
    "neonBranchId" VARCHAR(255),
    "neonDatabaseId" VARCHAR(255),
    "schemaVersion" VARCHAR(100),
    "provisionedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProvisioning" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" VARCHAR(500),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TenantProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_id_idx" ON "Tenant"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Tenant_status_createdAt_id_idx" ON "Tenant"("status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantDatabase_tenantId_key" ON "TenantDatabase"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_database_resource_identity_key" ON "TenantDatabase"("provider", "neonProjectId", "neonBranchId", "databaseName");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_database_resource_id_key" ON "TenantDatabase"("provider", "neonProjectId", "neonBranchId", "neonDatabaseId");

-- CreateIndex
CREATE INDEX "TenantProvisioning_tenantId_createdAt_id_idx" ON "TenantProvisioning"("tenantId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_provisioning_one_inflight_key" ON "TenantProvisioning"("tenantId") WHERE (status = ANY (ARRAY['PENDING'::"ProvisioningStatus", 'RUNNING'::"ProvisioningStatus"]));

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_id_idx" ON "OutboxEvent"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateId_createdAt_idx" ON "OutboxEvent"("aggregateId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "TenantDatabase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TenantProvisioning" ADD CONSTRAINT "TenantProvisioning_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Integrity not expressible as Prisma PSL CHECK constraints.
ALTER TABLE "TenantProvisioning" ADD CONSTRAINT "provisioning_attempt_count_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "outbox_attempt_count_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "tenant_database_provider_value"
 CHECK ("provider" <> '' AND "provider" = btrim("provider") AND "provider" !~ '^[[:space:]]|[[:space:]]$');
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "tenant_database_identity_values" CHECK (
 ("databaseName" IS NULL OR ("databaseName" <> '' AND "databaseName" = btrim("databaseName") AND "databaseName" !~ '^[[:space:]]|[[:space:]]$' AND octet_length("databaseName") <= 63)) AND
 ("neonProjectId" IS NULL OR ("neonProjectId" <> '' AND "neonProjectId" = btrim("neonProjectId") AND "neonProjectId" !~ '^[[:space:]]|[[:space:]]$')) AND
 ("neonBranchId" IS NULL OR ("neonBranchId" <> '' AND "neonBranchId" = btrim("neonBranchId") AND "neonBranchId" !~ '^[[:space:]]|[[:space:]]$')) AND
 ("neonDatabaseId" IS NULL OR ("neonDatabaseId" <> '' AND "neonDatabaseId" = btrim("neonDatabaseId") AND "neonDatabaseId" !~ '^[[:space:]]|[[:space:]]$'))
);
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "tenant_database_provisioned_identity" CHECK (
 "provisionedAt" IS NULL OR (
 "provider" = 'neon' AND "neonProjectId" IS NOT NULL AND "neonBranchId" IS NOT NULL AND "databaseName" IS NOT NULL
 )
);
COMMIT;
