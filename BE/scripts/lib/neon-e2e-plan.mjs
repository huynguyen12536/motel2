import { randomBytes } from "node:crypto";

export function liveTestPlan(readiness) {
  const tag = randomBytes(6).toString("hex");
  const provider = readiness.provider;
  return {
    mode: "DRY_RUN_ONLY",
    createdAt: new Date().toISOString(),
    runTag: tag,
    authorization: "NOT GRANTED",
    executed: false,
    resourcesCreated: [],
    target: {
      projectId: provider?.status === "PASS" ? provider.projectId : null,
      branchId: provider?.status === "PASS" ? provider.branchId : null,
      masterDatabase: readiness.target?.database ?? null,
      classification: "UNVERIFIED",
    },
    requestedBudget: { tenantDatabases: 2, tenantApplicationRoles: 2, projects: 0, branches: 0 },
    tenants: ["A", "B"].map((label) => ({
      label,
      name: "Neon E2E " + tag + " " + label,
      code: "E2E_" + tag.toUpperCase() + "_" + label,
      slug: "e2e-" + tag + "-" + label.toLowerCase(),
      tenantId: "RETURNED_BY_AUTHORIZED_REGISTRATION_API",
      databaseName: "tenant_<registered-tenant-uuid-without-hyphens>",
      applicationRole: "app_<registered-tenant-uuid-without-hyphens>_v1",
      adminEmail: "OPERATOR_SUPPLIED_TEST_EMAIL_SAME_FOR_BOTH_TENANTS",
      adminPassword: "OPERATOR_SUPPLIED_UNIQUE_SECRET_PER_TENANT_NOT_IN_PLAN",
    })),
    isolatedRuntime: {
      apiPort: 18080,
      queuePrefix: "motel.neon.e2e." + tag,
      worker: "separate operator-started test process; existing disabled worker preserved",
    },
    requiredGates: [
      "Provider-verified project/branch/endpoint and confirmed development ownership",
      "Explicit Master selection, non-owner runtime role, separate direct migration credential",
      "Reviewed pending migration checksums, clean baseline diff/catalogs, usable recovery point",
      "Branch PUBLIC CONNECT isolation policy approved and verified on every database",
      "Verified provider quotas and connection budget; bounded two-tenant resource approval",
      "Secret-manager injection, versioned credential keyring and operator bootstrap credentials",
      "Target-specific migration, ACL, provisioning and bootstrap authorizations",
    ],
    workflow: [
      "Inspect Master history/catalogs; apply only explicitly approved pending Prisma migrations",
      "POST /api/v1/admin/tenants for each planned code/slug; record server UUIDs",
      "POST /api/v1/admin/tenants/:id/provision; require 202 and durable operation ID",
      "Observe outbox confirmation, isolated queue delivery, worker progress and provider inventory",
      "Require SUCCEEDED/ACTIVE, exact ownership markers, roles, schema and migration checksums",
      "POST /api/v1/admin/tenants/:id/users/bootstrap with separately supplied credentials",
      "POST /api/v1/auth/login; check tenant/me and tenant/admin/identity with each token",
      "Check forged tenant headers cannot switch context and app credentials cannot CONNECT to other tenant/Master",
      "Verify refresh rotation, logout, duplicate delivery, test-worker restart and expired lease recovery",
      "Recheck metadata, inventories, privileges, health and isolated queue backlog; retain resources for review",
    ],
    cleanup:
      "NOT AUTHORIZED; prepare separate exact database IDs/names, role names, markers and queue inventory for approval; never auto-delete live resources",
  };
}
