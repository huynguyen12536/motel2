import { create } from "zustand";
export const useUiStore = create<{
  compact: boolean;
  setCompact: (value: boolean) => void;
}>((set) => ({ compact: false, setCompact: (compact) => set({ compact }) }));
