import { env } from "@/config/env";
import type { SignInValues } from "@/features/auth/schemas/auth.schema";
import type { AuthResponse } from "@/features/auth/types/auth.type";
import { sessionRequest } from "@/features/authorization/session-client";
import { token } from "@/lib/auth/token";
import { getCurrentUser } from "./get-current-user";
export async function signIn(values: SignInValues): Promise<AuthResponse> {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.login(
      values.email,
      values.password,
    );
  token.clear();
  const pair = await sessionRequest("login", {
    scope: "tenant",
    email: values.email,
    password: values.password,
    companyCode: values.companyCode,
  });
  token.set(pair.accessToken);
  return { ...pair, user: await getCurrentUser() };
}
