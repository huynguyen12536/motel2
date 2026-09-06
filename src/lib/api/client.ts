import axios from "axios";
import { env } from "@/config/env";
import { token } from "@/lib/auth/token";
import { ApiError, normalizeApiError } from "@/lib/api/api-error";
import { ENDPOINTS } from "@/lib/api/endpoints";

const options = {
  baseURL: env.apiUrl,
  timeout: 15000,
  withCredentials: env.credentials,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
};
export const apiClient = axios.create(options);
const refreshClient = axios.create(options);
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    const generation = token.generation();
    refreshPromise = refreshClient
      .post<{ accessToken: string }>(ENDPOINTS.auth.refresh)
      .then(({ data }) => {
        if (generation !== token.generation())
          throw new ApiError(
            0,
            "Session changed during refresh.",
            "SESSION_CHANGED",
          );
        if (!data.accessToken)
          throw new ApiError(
            401,
            "Invalid refresh response.",
            "INVALID_SESSION",
          );
        token.set(data.accessToken);
        return data.accessToken;
      })
      .catch((error) => {
        throw normalizeApiError(error);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function expireSession() {
  token.clear();
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("session-expired"));
}

apiClient.interceptors.request.use((config) => {
  const value = token.get();
  if (value) config.headers.Authorization = `Bearer ${value}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config
    ) {
      const config = error.config;
      const canRefresh =
        !config.url?.startsWith("/auth/") || config.url === ENDPOINTS.auth.me;
      if (canRefresh) {
        if (config.headers.get("X-Auth-Retry")) {
          expireSession();
        } else {
          try {
            // A late 401 can arrive after another request already refreshed the token.
            const current = token.get();
            const accessToken =
              current &&
              config.headers.get("Authorization") !== `Bearer ${current}`
                ? current
                : await refreshAccessToken();
            config.headers.set("X-Auth-Retry", "1");
            config.headers.set("Authorization", `Bearer ${accessToken}`);
            return await apiClient(config);
          } catch (refreshError) {
            const normalized = normalizeApiError(refreshError);
            if ([401, 403].includes(normalized.status)) expireSession();
            return Promise.reject(normalized);
          }
        }
      }
    }
    return Promise.reject(normalizeApiError(error));
  },
);
