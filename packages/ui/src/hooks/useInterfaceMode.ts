import { useWCodeStoreWithDefault } from "@/store/StoreProvider.js";

export function useIsOfficeMode(): boolean {
  return useWCodeStoreWithDefault((state) => state.interfaceMode === "office", false);
}
