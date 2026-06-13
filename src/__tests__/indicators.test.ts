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
    const candles = createMockCandles([10, 20, 30, 40, 50]);
    const sma3 = calculateSMA(candles, 3);

    expect(sma3.length).toBe(3); // Elements: [10,20,30], [20,30,40], [30,40,50]
    expect(sma3[0].value).toBe(20); // (10+20+30)/3
    expect(sma3[1].value).toBe(30); // (20+30+40)/3
    expect(sma3[2].value).toBe(40); // (30+40+50)/3
  });

  test("Exponential Moving Average (EMA)", () => {
    const candles = createMockCandles([10, 20, 30, 40, 50]);
    const ema3 = calculateEMA(candles, 3);
    
    // First EMA = SMA (10+20+30)/3 = 20
    expect(ema3[0].value).toBe(20);
    
    // Period = 3, k = 2 / (3 + 1) = 0.5
    // Next EMA = 40 * 0.5 + 20 * 0.5 = 30
    expect(ema3[1].value).toBe(30);
    // Next EMA = 50 * 0.5 + 30 * 0.5 = 40
    expect(ema3[2].value).toBe(40);
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

    expect(rsi.length).toBe(6); // 20 - 14 = 6
    expect(rsi[0].value).toBeGreaterThan(0);
    expect(rsi[0].value).toBeLessThan(100);
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
