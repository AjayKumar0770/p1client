export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPoint {
  time: string;
  value: number;
}

export interface BollingerBandPoint {
  time: string;
  upper: number;
  middle: number;
  lower: number;
}

export interface VolumeProfileBin {
  priceMin: number;
  priceMax: number;
  volume: number;
  isPoc: boolean;
}

// 1. Simple Moving Average (SMA)
export function calculateSMA(data: Candle[], period: number): ChartPoint[] {
  const result: ChartPoint[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: sum / period });

  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period].close + data[i].close;
    result.push({ time: data[i].time, value: sum / period });
  }

  return result;
}

// 2. Exponential Moving Average (EMA)
export function calculateEMA(data: Candle[], period: number): ChartPoint[] {
  const result: ChartPoint[] = [];
  if (data.length < period) return result;

  const k = 2 / (period + 1);

  // Initialize first EMA as SMA of first period elements
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }

  return result;
}

// 3. Bollinger Bands (BB)
export function calculateBollingerBands(data: Candle[], period: number = 20, multiplier: number = 2): BollingerBandPoint[] {
  const result: BollingerBandPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const middle = sum / period;

    // Calculate Variance & StdDev
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(data[j].close - middle, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    result.push({
      time: data[i].time,
      middle,
      upper: middle + multiplier * stdDev,
      lower: middle - multiplier * stdDev
    });
  }

  return result;
}

// 4. Relative Strength Index (RSI)
export function calculateRSI(data: Candle[], period: number = 14): ChartPoint[] {
  const result: ChartPoint[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

  // First change calculations
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: data[period].time, value: rsi });

  // Wilder's smoothing calculation
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

// 5. Volume Profile
export function calculateVolumeProfile(data: Candle[], numBins: number = 24): { bins: VolumeProfileBin[]; pocPrice: number } {
  if (data.length === 0) return { bins: [], pocPrice: 0 };

  // 1. Find min and max price
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  data.forEach((c) => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  const range = maxPrice - minPrice;
  const binSize = range / numBins;

  // Initialize bins
  const bins: VolumeProfileBin[] = Array.from({ length: numBins }, (_, index) => {
    const pMin = minPrice + index * binSize;
    const pMax = pMin + binSize;
    return {
      priceMin: pMin,
      priceMax: pMax,
      volume: 0,
      isPoc: false
    };
  });

  // Assign volume to bins
  data.forEach((c) => {
    // Distribute volume into bins overlapping between low and high, or just Close price bin
    // A standard approach is to allocate the candle's volume to the bin of its close price
    const binIdx = Math.min(Math.floor((c.close - minPrice) / binSize), numBins - 1);
    if (binIdx >= 0 && binIdx < numBins) {
      bins[binIdx].volume += c.volume;
    }
  });

  // Find POC (Point of Control) - bin with maximum volume
  let maxVol = -1;
  let pocIdx = 0;
  bins.forEach((b, idx) => {
    if (b.volume > maxVol) {
      maxVol = b.volume;
      pocIdx = idx;
    }
  });

  if (bins.length > 0) {
    bins[pocIdx].isPoc = true;
  }

  const pocPrice = bins.length > 0 ? (bins[pocIdx].priceMin + bins[pocIdx].priceMax) / 2 : 0;

  return { bins, pocPrice };
}
