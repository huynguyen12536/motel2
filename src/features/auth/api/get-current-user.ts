import { env } from "@/config/env";
import { apiClient, refreshAccessToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { token } from "@/lib/auth/token";
import type { CurrentUser } from "@/features/auth/types/auth.type";
export async function getCurrentUser(): Promise<CurrentUser> {
  if (env.demoMode) return (await import("@/mocks/adapter")).mockAdapter.me();
  if (!token.get()) await refreshAccessToken();
  return (await apiClient.get<CurrentUser>(ENDPOINTS.auth.me)).data;
}
