import { create } from "zustand";
export const useSidebarStore = create<{
  open: boolean;
  toggle: () => void;
  close: () => void;
}>((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
}));
