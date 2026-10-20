BEGIN;
-- AlterTable
ALTER TABLE "TenantDatabase" ADD COLUMN     "applicationRole" VARCHAR(63),
ADD COLUMN     "credentialVersion" VARCHAR(32),
ADD COLUMN     "databaseHost" VARCHAR(255),
ADD COLUMN     "databasePort" INTEGER NOT NULL DEFAULT 5432,
ADD COLUMN     "ownershipToken" UUID;

-- AlterTable
ALTER TABLE "TenantProvisioning" ADD COLUMN     "leaseToken" UUID,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "progress" VARCHAR(32) NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "requestedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "deduplicationKey" VARCHAR(200),
ADD COLUMN     "lastErrorCode" VARCHAR(100),
ADD COLUMN     "leaseToken" UUID,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "LoginRateBucket" (
    "key" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginRateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SecurityAuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "action" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "targetId" VARCHAR(100),
    "correlationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMigrationRun" (
    "id" UUID NOT NULL,
    "rolloutId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "authorizationRef" VARCHAR(100) NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "schemaVersion" VARCHAR(100),
    "lastErrorCode" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TenantMigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAuditEvent_tenantId_createdAt_idx" ON "SecurityAuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantMigrationRun_status_leaseUntil_idx" ON "TenantMigrationRun"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMigrationRun_rolloutId_tenantId_key" ON "TenantMigrationRun"("rolloutId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_migration_one_inflight_key" ON "TenantMigrationRun"("tenantId") WHERE (status = ANY (ARRAY['PENDING'::"ProvisioningStatus", 'RUNNING'::"ProvisioningStatus"]));

-- CreateIndex
CREATE INDEX "TenantProvisioning_status_nextAttemptAt_leaseUntil_idx" ON "TenantProvisioning"("status", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_deduplicationKey_key" ON "OutboxEvent"("deduplicationKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_leaseUntil_idx" ON "OutboxEvent"("status", "nextAttemptAt", "leaseUntil");

-- AddForeignKey
ALTER TABLE "TenantMigrationRun" ADD CONSTRAINT "TenantMigrationRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TenantDatabase" ADD CONSTRAINT "tenant_database_port_valid" CHECK ("databasePort" BETWEEN 1 AND 65535);
ALTER TABLE "TenantProvisioning" ADD CONSTRAINT "provisioning_lease_pair" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL));
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "outbox_lease_pair" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL));
ALTER TABLE "TenantMigrationRun" ADD CONSTRAINT "migration_attempt_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "TenantMigrationRun" ADD CONSTRAINT "migration_lease_pair" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL));
ALTER TABLE "LoginRateBucket" ADD CONSTRAINT "login_rate_positive" CHECK ("count" > 0);
COMMIT;
