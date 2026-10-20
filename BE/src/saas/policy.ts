import { env } from "../config/env.js";
import type { SaasPolicy } from "./contracts.js";
import { PipelineError } from "./contracts.js";
export function configuredPolicy(): SaasPolicy {
  return {
    provisioningEnabled: env.TENANT_PROVISIONING_ENABLED,
    bootstrapEnabled: env.TENANT_ADMIN_BOOTSTRAP_ENABLED,
    rolloutEnabled: env.TENANT_MIGRATION_ROLLOUT_ENABLED,
    projectId: env.NEON_PROJECT_ID ?? "",
    branchId: env.NEON_BRANCH_ID ?? "",
    maxDatabases: env.NEON_MAX_TENANT_DATABASES,
    prefix: env.TENANT_DB_NAME_PREFIX,
    credentialVersion: env.TENANT_CREDENTIAL_VERSION,
  };
}
export function assertLiveAuthorization(): void {
  if (
    !env.TENANT_PROVISIONING_ENABLED ||
    !env.MASTER_PROVISIONING_AUTHORIZED ||
    !env.NEON_PROJECT_ID ||
    !env.NEON_BRANCH_ID ||
    env.NEON_PROJECT_ID !== env.NEON_AUTHORIZED_PROJECT_ID ||
    env.NEON_BRANCH_ID !== env.NEON_AUTHORIZED_BRANCH_ID ||
    !/^[a-z0-9-]{1,60}$/.test(env.NEON_PROJECT_ID) ||
    !/^br-[a-z0-9-]{1,57}$/.test(env.NEON_BRANCH_ID)
  )
    throw new PipelineError("LIVE_RESOURCE_AUTHORIZATION_REQUIRED");
}
