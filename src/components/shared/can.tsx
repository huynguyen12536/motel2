"use client";
import { usePermission } from "@/hooks/use-permission";
import type { Permission } from "@/config/permissions";
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const can = usePermission();
  return can(permission) ? children : fallback;
}
