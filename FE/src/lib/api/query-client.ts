import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/api-error";
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        refetchOnWindowFocus: false,
        retry: (count, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
