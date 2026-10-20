BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('TENANT_ADMIN', 'TENANT_USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "TenantBootstrap" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tenantId" UUID NOT NULL,
    "schemaVersion" VARCHAR(100) NOT NULL,
    "initializedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminBootstrappedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TenantBootstrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(256) NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'TENANT_USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshHash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBootstrap_tenantId_key" ON "TenantBootstrap"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TenantBootstrap" ADD CONSTRAINT "tenant_bootstrap_singleton" CHECK (id = 1);
ALTER TABLE "User" ADD CONSTRAINT "user_email_canonical" CHECK (email = lower(btrim(email)) AND email <> '');
ALTER TABLE "AuthSession" ADD CONSTRAINT "session_version_positive" CHECK (version > 0);
COMMIT;
