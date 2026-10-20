import { createHash } from "node:crypto";
export const catalog = [
  ["platform.settings:read", "View platform settings"],
  ["platform.tenants:read", "View tenant registry and provisioning history"],
  ["platform.tenants:create", "Register tenant"],
  ["platform.tenants:update", "Update tenant name"],
  ["platform.tenants:provision", "Request tenant provisioning"],
  ["platform.tenants:retry", "Retry failed provisioning"],
  ["platform.roles:read", "View platform roles"],
  ["platform.roles:manage", "Manage platform roles"],
  ["platform.permissions:read", "View platform permission catalog"],
  ["platform.permissions:manage", "Assign platform permissions"],
  ["platform.users:read", "View platform users"],
  ["platform.users:manage", "Manage platform accounts and role assignments"],
  ["platform.metrics:read", "View operational metrics"],
  ["platform.migrations:read", "View migration rollout results"],
  ["platform.migrations:manage", "Create migration rollout plans"],
  ["tenant.settings:read", "View tenant settings"],
  ["tenant.settings:update", "Update tenant configuration"],
  ["tenant.info:read", "View own tenant identity"],
  ["tenant.users:read", "View tenant users"],
  ["tenant.users:create", "Create tenant users"],
  ["tenant.users:update", "Update tenant accounts"],
  ["tenant.users:assign", "Assign tenant user roles"],
  ["tenant.roles:read", "View tenant roles"],
  ["tenant.roles:manage", "Manage tenant roles"],
  ["tenant.permissions:read", "View tenant permission catalog"],
  ["tenant.permissions:assign", "Assign tenant permissions"],
] as const;
export type Permission = (typeof catalog)[number][0];
export type Scope = "platform" | "tenant";
export const scopeCatalog = (scope: Scope) => catalog.filter(([p]) => p.startsWith(scope + "."));
export const catalogVersion = (scope: Scope) =>
  createHash("sha256")
    .update(JSON.stringify(scopeCatalog(scope)))
    .digest("hex");
export const systemRole = (scope: Scope) =>
  scope === "platform" ? "PLATFORM_SUPER_ADMIN" : "TENANT_ADMIN";
