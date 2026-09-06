import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
export async function recoverAccount(values: { email: string }) {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.requestPasswordReset();
  await apiClient.post(ENDPOINTS.auth.forgotPassword, values);
}
export async function registerAccount(values: {
  name: string;
  email: string;
  password: string;
}) {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.register();
  await apiClient.post(ENDPOINTS.auth.register, values);
}
