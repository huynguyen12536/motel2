BEGIN;
-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "passwordHash" VARCHAR(256) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "bootstrapOwner" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshHash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthzState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "domain" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "catalogVersion" VARCHAR(64) NOT NULL,
    "initializedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthzState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthzPermission" (
    "code" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "description" VARCHAR(200) NOT NULL,

    CONSTRAINT "AuthzPermission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AuthzRole" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "systemManaged" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthzRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthzRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionCode" VARCHAR(100) NOT NULL,

    CONSTRAINT "AuthzRolePermission_pkey" PRIMARY KEY ("roleId","permissionCode")
);

-- CreateTable
CREATE TABLE "AuthzUserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthzUserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "AuthzAudit" (
    "id" UUID NOT NULL,
    "actorId" VARCHAR(100) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(100) NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthzAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_bootstrapOwner_key" ON "PlatformUser"("bootstrapOwner");

-- CreateIndex
CREATE INDEX "PlatformSession_userId_revokedAt_idx" ON "PlatformSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthzState_domain_key" ON "AuthzState"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "AuthzPermission_resource_action_key" ON "AuthzPermission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "AuthzRole_code_key" ON "AuthzRole"("code");

-- CreateIndex
CREATE INDEX "AuthzUserRole_roleId_idx" ON "AuthzUserRole"("roleId");

-- CreateIndex
CREATE INDEX "AuthzAudit_createdAt_idx" ON "AuthzAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuthzRolePermission" ADD CONSTRAINT "AuthzRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthzRole"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuthzRolePermission" ADD CONSTRAINT "AuthzRolePermission_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "AuthzPermission"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuthzUserRole" ADD CONSTRAINT "AuthzUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuthzUserRole" ADD CONSTRAINT "AuthzUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthzRole"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE "PlatformUser" ADD CONSTRAINT platform_user_status CHECK (status IN ('ACTIVE','DISABLED'));
ALTER TABLE "PlatformUser" ADD CONSTRAINT platform_email_canonical CHECK (email=lower(btrim(email)) AND email<>'');
ALTER TABLE "PlatformSession" ADD CONSTRAINT platform_session_version_positive CHECK(version>0);
ALTER TABLE "AuthzState" ADD CONSTRAINT authz_state_singleton CHECK(id=1 AND revision>0);
ALTER TABLE "AuthzAudit" ADD CONSTRAINT authz_audit_revision_positive CHECK(revision>0);
COMMIT;
