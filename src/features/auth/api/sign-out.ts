import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
export async function signOut() {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.logout();
  await apiClient.post(ENDPOINTS.auth.logout);
}
