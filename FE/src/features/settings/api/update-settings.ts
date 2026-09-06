import { env } from "@/config/env";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { WorkspaceSettings } from "@/features/settings/types/settings.type";
export async function updateSettings(
  values: WorkspaceSettings,
): Promise<WorkspaceSettings> {
  if (env.demoMode)
    return (await import("@/mocks/settings")).mockSettings.update(values);
  return (await apiClient.patch<WorkspaceSettings>(ENDPOINTS.settings, values))
    .data;
}
