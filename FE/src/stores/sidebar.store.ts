import { create } from "zustand";

const COLLAPSED_KEY = "wms-sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export const useSidebarStore = create<{
  open: boolean;
  collapsed: boolean;
  toggle: () => void;
  close: () => void;
  openDrawer: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  hydrateCollapsed: () => void;
}>((set, get) => ({
  open: false,
  collapsed: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
  openDrawer: () => set({ open: true }),
  toggleCollapsed: () => {
    const next = !get().collapsed;
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ collapsed: next });
  },
  setCollapsed: (value) => set({ collapsed: value }),
  hydrateCollapsed: () => set({ collapsed: readCollapsed() }),
}));
