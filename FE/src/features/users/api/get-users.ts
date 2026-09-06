import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { User } from "@/features/users/types/user.type";
import type { PaginationParams, PaginatedResponse } from "@/types/pagination";
export async function getUsers(
  params: PaginationParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<User>> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.listUsers(params);
  return (
    await apiClient.get<PaginatedResponse<User>>(ENDPOINTS.users, {
      params,
      signal,
    })
  ).data;
}
