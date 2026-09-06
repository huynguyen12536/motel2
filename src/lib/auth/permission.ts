import type { Permission } from "@/config/permissions";
export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: Permission,
) {
  return permissions?.includes(permission) ?? false;
}
