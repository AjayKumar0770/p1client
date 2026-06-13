import { create } from "zustand";

interface UIState {
  selectedSymbol: string | null;
  rawFilterString: string;
  filterError: string | null;
  columnVisibility: Record<string, boolean>;
  sorting: { id: string; desc: boolean }[];
  setSelectedSymbol: (symbol: string | null) => void;
  setRawFilterString: (filter: string) => void;
  setFilterError: (error: string | null) => void;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setSorting: (sorting: { id: string; desc: boolean }[]) => void;
  resetFilters: () => void;
}

const defaultColumnVisibility: Record<string, boolean> = {
  symbol: true,
  name: true,
  sector: true,
  price: true,
  changePercent: true,
  marketCap: true,
  peRatio: true,
  pbRatio: true,
  dividendYield: true,
  debtToEquity: true,
  roe: true,
  rsi14: true
};

export const useUIStore = create<UIState>((set) => ({
  selectedSymbol: "AAPL", // default selected symbol for chart
  rawFilterString: "",
  filterError: null,
  columnVisibility: defaultColumnVisibility,
  sorting: [{ id: "marketCap", desc: true }],
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setRawFilterString: (filter) => set({ rawFilterString: filter }),
  setFilterError: (error) => set({ filterError: error }),
  setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
  setSorting: (sorting) => set({ sorting }),
  resetFilters: () => set({ rawFilterString: "", filterError: null })
}));
