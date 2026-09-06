"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUsers } from "@/features/users/api/get-users";
import { USER_QUERY_KEYS } from "@/features/users/constants";
import type { PaginationParams } from "@/types/pagination";
export function useUsers(params: PaginationParams) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: ({ signal }) => getUsers(params, signal),
    placeholderData: keepPreviousData,
  });
}
