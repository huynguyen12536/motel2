import type { QueryClient } from "@tanstack/react-query";
import { token } from "@/lib/auth/token";
export async function clearSession(client: QueryClient) {
  token.clear();
  await client.cancelQueries();
  client.clear();
}
