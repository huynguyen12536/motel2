import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { User } from "@/features/users/types/user.type";
export async function getUser(id: string, signal?: AbortSignal): Promise<User> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.getUser(id);
  return (
    await apiClient.get<User>(`${ENDPOINTS.users}/${encodeURIComponent(id)}`, {
      signal,
    })
  ).data;
}
