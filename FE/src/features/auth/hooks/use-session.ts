"use client";
import { useQuery } from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@/features/auth/constants";
import { getCurrentUser } from "@/features/auth/api/get-current-user";
export function useSession() {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
