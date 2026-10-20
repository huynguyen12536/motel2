import { ConflictException } from "@nestjs/common";
import { TenantStatus } from "../../generated/master-authorized/enums.js";
const transitions: Record<TenantStatus, readonly TenantStatus[]> = {
  PENDING_PROVISIONING: ["PROVISIONING"],
  PROVISIONING: ["PROVISIONING_FAILED", "ACTIVE"],
  ACTIVE: ["SUSPENDED"],
  SUSPENDED: [],
  PROVISIONING_FAILED: [],
};
export function assertTenantTransition(
  from: TenantStatus,
  to: TenantStatus,
  verifiedDatabase = false,
  explicitRetry = false,
): void {
  if (from === "PROVISIONING_FAILED" && to === "PROVISIONING" && explicitRetry) return;
  if (!transitions[from].includes(to) || (to === "ACTIVE" && !verifiedDatabase))
    throw new ConflictException("Unsupported tenant lifecycle transition");
}
// Provisioning owns these transitions. Tenant PATCH still permits name changes only.
