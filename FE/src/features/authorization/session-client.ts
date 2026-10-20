import { ApiError } from "@/lib/api/api-error";
export async function sessionRequest(
  action: "login" | "refresh" | "logout",
  body?: unknown,
  accessToken?: string,
): Promise<{ accessToken: string }> {
  const r = await fetch("/api/session/" + action, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(
      r.status,
      data.message ?? "Authentication failed",
      "SESSION_ERROR",
    );
  return data;
}
