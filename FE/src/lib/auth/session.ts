import type { QueryClient } from "@tanstack/react-query";
import { token } from "@/lib/auth/token";
import { env } from "@/config/env";

export async function clearSession(client: QueryClient) {
  token.clear();
  if (env.demoMode && typeof window !== "undefined") {
    window.sessionStorage.removeItem("wms-demo-signed-in");
    try {
      const { mockAdapter } = await import("@/mocks/adapter");
      await mockAdapter.logout();
    } catch {
      /* ignore */
    }
  }
  await client.cancelQueries();
  client.clear();
}
