import { create } from "zustand";
import { produce } from "immer";

export interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface StreamState {
  prices: Record<string, LivePrice>;
  updatePrices: (
    ticks: {
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      volume: number;
    }[]
  ) => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  prices: {},
  updatePrices: (ticks) =>
    set(
      produce((state: StreamState) => {
        const now = Date.now();
        ticks.forEach((tick) => {
          state.prices[tick.symbol] = {
            price: tick.price,
            change: tick.change,
            changePercent: tick.changePercent,
            volume: tick.volume,
            timestamp: now
          };
        });
      })
    )
}));
