import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { User } from "@/features/users/types/user.type";
import type { UserValues } from "@/features/users/schemas/user.schema";
export async function createUser(values: UserValues): Promise<User> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.createUser(values);
  return (await apiClient.post<User>(ENDPOINTS.users, values)).data;
}
