export const USER_QUERY_KEYS = {
  all: ["users"] as const,
  list: (params: object) => ["users", "list", params] as const,
  detail: (id: string) => ["users", "detail", id] as const,
};
