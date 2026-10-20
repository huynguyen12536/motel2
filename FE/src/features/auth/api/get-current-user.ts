import { env } from "@/config/env";
import { apiClient, refreshAccessToken } from "@/lib/api/client";
import { token } from "@/lib/auth/token";
import type { CurrentUser } from "@/features/auth/types/auth.type";
export async function getCurrentUser(forceReal = false): Promise<CurrentUser> {
  if (env.demoMode && !forceReal)
    return (await import("@/mocks/adapter")).mockAdapter.me();
  if (!token.get()) await refreshAccessToken();
  const { data } = await apiClient.get<{
    userId: string;
    email: string;
    scope: "platform" | "tenant";
    tenantId: string | null;
    roles: string[];
    permissions: string[];
    policyVersion: number;
  }>("/auth/me/permissions");
  return {
    id: data.userId,
    name: data.email,
    email: data.email,
    role: data.roles[0] ?? "",
    permissions: data.permissions,
    scope: data.scope,
    tenantId: data.tenantId,
    policyVersion: data.policyVersion,
  };
}
