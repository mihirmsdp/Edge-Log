import { create } from "zustand";

interface AnalyticsFilterState {
  from: string;
  to: string;
  assetClass: string[];
  direction: string;
  symbol: string;
  setField: (field: "from" | "to" | "direction" | "symbol", value: string) => void;
  toggleAssetClass: (value: string) => void;
  reset: () => void;
}

const initialState = {
  from: "",
  to: "",
  assetClass: [] as string[],
  direction: "",
  symbol: ""
};

export const useAnalyticsFiltersStore = create<AnalyticsFilterState>((set) => ({
  ...initialState,
  setField: (field, value) => set((state) => ({ ...state, [field]: value })),
  toggleAssetClass: (value) =>
    set((state) => ({
      assetClass: state.assetClass.includes(value) ? state.assetClass.filter((item) => item !== value) : [...state.assetClass, value]
    })),
  reset: () => set(initialState)
}));
