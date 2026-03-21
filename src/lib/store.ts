import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveRuntime {
  id: string;
  name: string;
  gatewayUrl: string;
  status: string;
}

interface RuntimeStore {
  activeRuntime: ActiveRuntime | null;
  setActiveRuntime: (runtime: ActiveRuntime | null) => void;
}

export const useRuntimeStore = create<RuntimeStore>()(
  persist(
    (set) => ({
      activeRuntime: null,
      setActiveRuntime: (runtime) => set({ activeRuntime: runtime }),
    }),
    { name: "clawdesk-runtime" }
  )
);
