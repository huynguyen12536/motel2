import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
export async function deleteUser(id: string): Promise<void> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.deleteUser(id);
  await apiClient.delete(`${ENDPOINTS.users}/${encodeURIComponent(id)}`);
}
