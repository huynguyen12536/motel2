"use client";
import { useSession } from "@/features/auth/hooks/use-session";
import { hasPermission } from "@/lib/auth/permission";
import type { Permission } from "@/config/permissions";
export function usePermission() {
  const { data } = useSession();
  return (permission: Permission) =>
    hasPermission(data?.permissions, permission);
}
