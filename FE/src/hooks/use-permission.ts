"use client";
import { useSession } from "@/features/auth/hooks/use-session";
import { hasPermission } from "@/lib/auth/permission";
import type { Permission } from "@/config/permissions";
import { env } from "@/config/env";
export function usePermission() {
  const { data, isError } = useSession();
  return (permission: Permission) => {
    if (isError) return false;
    if (!env.demoMode && permission === "settings.read")
      return (data?.permissions ?? []).some((p) =>
        /^(platform|tenant)\./.test(p),
      );
    return hasPermission(data?.permissions, permission);
  };
}
