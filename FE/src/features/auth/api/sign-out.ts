import { env } from "@/config/env";
import { sessionRequest } from "@/features/authorization/session-client";
import { token } from "@/lib/auth/token";
export async function signOut() {
  if (env.demoMode)
    return (await import("@/mocks/adapter")).mockAdapter.logout();
  await sessionRequest("logout", undefined, token.get() ?? undefined);
}
