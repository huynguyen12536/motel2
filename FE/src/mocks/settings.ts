import type { WorkspaceSettings } from "@/features/settings/types/settings.type";
let settings: WorkspaceSettings = { workspaceName: "Demo workspace" };
export const mockSettings = {
  get: async () => ({ ...settings }),
  update: async (values: WorkspaceSettings) => {
    settings = { ...values };
    return { ...settings };
  },
};
