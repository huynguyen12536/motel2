import { apiClient } from "@/lib/api/client";
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  systemManaged: boolean;
  scope: "platform" | "tenant";
  permissionCodes: string[];
  assignedUserCount: number;
}
export interface PermissionRecord {
  code: string;
  resource: string;
  action: string;
  description: string;
}
export interface ManagedUser {
  id: string;
  email: string;
  name?: string;
  status: "ACTIVE" | "DISABLED";
  roles: { id: string; code: string; name: string }[];
}
export interface Tenant {
  id: string;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  database: null | {
    provider: string;
    databaseName: string | null;
    neonProjectId: string | null;
    neonBranchId: string | null;
    schemaVersion: string | null;
    provisionedAt: string | null;
  };
}
export interface Operation {
  id: string;
  status: string;
  progress: string;
  attemptCount: number;
  createdAt: string;
  errorCode: string | null;
  errorSummary: string | null;
}
export const accessApi = {
  get: async <T>(path: string) => (await apiClient.get<T>(path)).data,
  send: async (
    path: string,
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    data?: unknown,
  ) => (await apiClient.request({ url: path, method, data })).data,
};
