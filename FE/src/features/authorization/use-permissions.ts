"use client";
import { useSession } from "@/features/auth/hooks/use-session";
export function usePermissions() {
  const session = useSession();
  const permissions = !session.isError ? (session.data?.permissions ?? []) : [];
  return {
    scope: session.data?.scope,
    tenantId: session.data?.tenantId,
    policyVersion: session.data?.policyVersion,
    status: session.isPending
      ? "loading"
      : session.isError
        ? "unavailable"
        : "authenticated",
    hasPermission: (p: string) => permissions.includes(p),
    hasAnyPermission: (ps: readonly string[]) =>
      ps.some((p) => permissions.includes(p)),
    hasAllPermissions: (ps: readonly string[]) =>
      ps.every((p) => permissions.includes(p)),
    refresh: () => session.refetch(),
    permissions,
  };
}
