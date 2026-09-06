import { create } from "zustand";
// Only ephemeral authentication UI state. Current user stays in React Query.
export const useAuthStore = create<{
  expired: boolean;
  setExpired: (value: boolean) => void;
}>((set) => ({ expired: false, setExpired: (expired) => set({ expired }) }));
