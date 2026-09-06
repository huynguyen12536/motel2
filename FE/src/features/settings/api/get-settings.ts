import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { WorkspaceSettings } from "@/features/settings/types/settings.type";
export async function getSettings(): Promise<WorkspaceSettings> {
  if (env.demoMode)
    return (await import("@/mocks/settings")).mockSettings.get();
  return (await apiClient.get<WorkspaceSettings>(ENDPOINTS.settings)).data;
}
