import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { User } from "@/features/users/types/user.type";
import type { UserValues } from "@/features/users/schemas/user.schema";
export async function updateUser(
  id: string,
  values: UserValues,
): Promise<User> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.updateUser(id, values);
  return (
    await apiClient.patch<User>(
      `${ENDPOINTS.users}/${encodeURIComponent(id)}`,
      values,
    )
  ).data;
}
