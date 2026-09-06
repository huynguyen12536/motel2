import { create } from "zustand";
export const useAppStore = create<{
  workspaceId: string | null;
  setWorkspace: (id: string | null) => void;
}>((set) => ({
  workspaceId: null,
  setWorkspace: (workspaceId) => set({ workspaceId }),
}));
