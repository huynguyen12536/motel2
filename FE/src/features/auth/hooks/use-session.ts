"use client";
import { useQuery } from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
import { getCurrentUser } from "@/features/auth/api/get-current-user";
import { env } from "@/config/env";
export function useSession() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => getCurrentUser(),
    retry: false,
    staleTime: env.demoMode ? 5 * 60 * 1000 : 0,
    refetchInterval: env.demoMode ? false : 5000,
    refetchOnWindowFocus: true,
  });
}
