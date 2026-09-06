import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { SignInValues } from "@/features/auth/schemas/auth.schema";
import type { AuthResponse } from "@/features/auth/types/auth.type";
export async function signIn(values: SignInValues): Promise<AuthResponse> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.login(
      values.email,
      values.password,
    );
  return (await apiClient.post<AuthResponse>(ENDPOINTS.auth.login, values))
    .data;
}
