import { describe, test, expect } from "vitest";
import {
  Candle,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateVolumeProfile
} from "../lib/indicators/math";

// Generate mock candle array
function createMockCandles(prices: number[], volumes?: number[]): Candle[] {
  return prices.map((p, idx) => ({
    time: `2026-06-${String(idx + 1).padStart(2, "0")}`,
    open: p - 1,
    high: p + 2,
    low: p - 2,
    close: p,
    volume: volumes ? volumes[idx] : 1000 + idx
  }));
}

describe("Technical Indicator Math Utilities", () => {
  test("Simple Moving Average (SMA)", () => {
    const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
    const candles = createMockCandles(prices);
    const sma5 = calculateSMA(candles, 5);

    expect(sma5.length).toBe(6);
    expect(sma5.map((p) => p.value)).toEqual([
      102.8, 104.2, 105.0, 105.8, 107.2, 108.0
    ]);
  });

  test("Exponential Moving Average (EMA)", () => {
    const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
    const candles = createMockCandles(prices);
    const ema5 = calculateEMA(candles, 5);
    
    // First EMA = SMA = 102.8 at index 4
    expect(ema5[0].value).toBe(102.8);
    
    // Period = 5, k = 2 / (5 + 1) = 0.3333333333333333
    // Next EMA = 107 * k + 102.8 * (1 - k) = 104.20
    expect(ema5[1].value).toBeCloseTo(104.20, 2);
  });

  test("Bollinger Bands (BB)", () => {
    // Standard inputs (period 20)
    const prices = Array.from({ length: 25 }, (_, idx) => 100 + idx);
    const candles = createMockCandles(prices);
    const bb = calculateBollingerBands(candles, 20, 2);

    expect(bb.length).toBe(6); // 25 - 20 + 1 = 6
    expect(bb[0].middle).toBe(109.5); // SMA of 100 to 119
    expect(bb[0].upper).toBeGreaterThan(bb[0].middle);
    expect(bb[0].lower).toBeLessThan(bb[0].middle);
  });

  test("Relative Strength Index (RSI)", () => {
    const prices = [
      44.33, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 47.83
    ];
    const candles = createMockCandles(prices);
    const rsi = calculateRSI(candles, 14);

    expect(rsi.length).toBe(6);
    expect(rsi[0].value).toBeGreaterThan(0);
    expect(rsi[0].value).toBeLessThan(100);
    
    // Explicit 0/100 checks
    const zeroLossCandles = createMockCandles(Array.from({ length: 15 }, (_, i) => 10 + i));
    const zeroLossRsi = calculateRSI(zeroLossCandles, 14);
    expect(zeroLossRsi[0].value).toBe(100);

    const zeroGainCandles = createMockCandles(Array.from({ length: 15 }, (_, i) => 100 - i));
    const zeroGainRsi = calculateRSI(zeroGainCandles, 14);
    expect(zeroGainRsi[0].value).toBe(0);
  });

  test("Volume Profile & POC", () => {
    const prices = [10, 11, 12, 10, 11, 12, 15, 16];
    const volumes = [100, 100, 500, 100, 100, 500, 200, 100];
    const candles = createMockCandles(prices, volumes);
    
    const { bins, pocPrice } = calculateVolumeProfile(candles, 3);
    
    expect(bins.length).toBe(3);
    // The bin containing $12 should have the highest volume since 12 has 500+500=1000 volume.
    // The POC price should correspond to that bin.
    expect(pocPrice).toBeGreaterThan(10);
    expect(pocPrice).toBeLessThan(17);
    
    const pocBin = bins.find(b => b.isPoc);
    expect(pocBin).toBeDefined();
  });
});
