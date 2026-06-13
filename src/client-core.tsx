import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useEffect, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

// ============================================================================
// 1. DATA MODEL & TYPES DEFINITIONS
// ============================================================================

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  debtToEquity: number;
  roe: number;
  roce: number;
  eps: number;
  revenueGrowth: number;
  profitMargin: number;
  freeCashFlow: number;
  currentRatio: number;
  quickRatio: number;
  assetTurnover: number;
  high52Week: number;
  low52Week: number;
  beta: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi14: number;
  bollingerUpper: number;
  bollingerLower: number;
  volumeProfilePoc: number;
}

export interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

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

export interface StatementItem {
  year: string;
  revenue?: number;
  grossProfit?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
}

export interface Fundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  ratios: {
    peRatio: number;
    pbRatio: number;
    dividendYield: number;
    debtToEquity: number;
    roe: number;
    roce: number;
    eps: number;
    revenueGrowth: number;
    profitMargin: number;
    currentRatio: number;
    quickRatio: number;
    assetTurnover: number;
    beta: number;
  };
  incomeStatement: StatementItem[];
  balanceSheet: StatementItem[];
}

// ============================================================================
// 2. UNIFIED DOMAIN-SLICED ZUSTAND STORE
// ============================================================================

export interface ServerCacheSlice {
  stocks: Stock[];
  fundamentals: Record<string, Fundamentals>;
  isLoadingStocks: boolean;
  stocksError: string | null;
  loadStocks: () => Promise<void>;
  loadFundamentals: (symbol: string) => Promise<void>;
}

export interface UIStateSlice {
  selectedSymbol: string | null;
  rawFilterString: string;
  filterError: string | null;
  columnVisibility: Record<string, boolean>;
  sorting: { id: string; desc: boolean }[];
  activeSubFilters: Record<string, string>; // Sub-filter expressions registered by panels
  setSelectedSymbol: (symbol: string | null) => void;
  setRawFilterString: (filter: string) => void;
  setFilterError: (error: string | null) => void;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setSorting: (sorting: { id: string; desc: boolean }[]) => void;
  registerSubFilter: (id: string, expression: string) => void;
  unregisterSubFilter: (id: string) => void;
  resetFilters: () => void;
}

export interface StreamTickSlice {
  prices: Record<string, LivePrice>;
  connectionStatus: "connecting" | "connected" | "disconnected";
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
  updatePrices: (ticks: { symbol: string; price: number; change: number; changePercent: number; volume: number }[]) => void;
}

export type ScreenerStoreState = ServerCacheSlice & UIStateSlice & StreamTickSlice;

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

export const useScreenerStore = create<ScreenerStoreState>()(
  immer((set, get) => ({
    // --- Server Cache Slice ---
    stocks: [],
    fundamentals: {},
    isLoadingStocks: false,
    stocksError: null,
    loadStocks: async () => {
      set((state) => {
        state.isLoadingStocks = true;
      });
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks`);
        if (!res.ok) throw new Error("Server returned HTTP error code");
        const data = (await res.json()) as Stock[];
        set((state) => {
          state.stocks = data;
          state.isLoadingStocks = false;
          state.stocksError = null;
        });
      } catch (err: unknown) {
        set((state) => {
          state.isLoadingStocks = false;
          state.stocksError = err instanceof Error ? err.message : "Failed to load stock list";
        });
      }
    },
    loadFundamentals: async (symbol: string) => {
      if (get().fundamentals[symbol]) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks/${symbol}/fundamentals`);
        if (!res.ok) throw new Error("Fundamentals fetch failed");
        const data = (await res.json()) as Fundamentals;
        set((state) => {
          state.fundamentals[symbol] = data;
        });
      } catch (err) {
        console.error("Failed to load fundamentals for", symbol, err);
      }
    },

    // --- Client UI State Slice ---
    selectedSymbol: "AAPL",
    rawFilterString: "",
    filterError: null,
    columnVisibility: defaultColumnVisibility,
    sorting: [{ id: "marketCap", desc: true }],
    activeSubFilters: {},
    setSelectedSymbol: (symbol) => {
      set((state) => {
        state.selectedSymbol = symbol;
      });
      if (symbol) {
        get().loadFundamentals(symbol);
      }
    },
    setRawFilterString: (filter) => {
      set((state) => {
        state.rawFilterString = filter;
      });
    },
    setFilterError: (error) => {
      set((state) => {
        state.filterError = error;
      });
    },
    setColumnVisibility: (visibility) => {
      set((state) => {
        state.columnVisibility = visibility;
      });
    },
    setSorting: (sorting) => {
      set((state) => {
        state.sorting = sorting;
      });
    },
    registerSubFilter: (id, expression) => {
      set((state) => {
        state.activeSubFilters[id] = expression;
      });
    },
    unregisterSubFilter: (id) => {
      set((state) => {
        delete state.activeSubFilters[id];
      });
    },
    resetFilters: () => {
      set((state) => {
        state.rawFilterString = "";
        state.filterError = null;
        state.activeSubFilters = {};
      });
    },

    // --- Stream Tick Slice ---
    prices: {},
    connectionStatus: "disconnected",
    setConnectionStatus: (status) => {
      set((state) => {
        state.connectionStatus = status;
      });
    },
    updatePrices: (ticks) => {
      set((state) => {
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
      });
    }
  }))
);

// ============================================================================
// 3. RAW TECHNICAL INDICATOR CALCULATION ENGINE
// ============================================================================

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

export function calculateEMA(data: Candle[], period: number): ChartPoint[] {
  const result: ChartPoint[] = [];
  if (data.length < period) return result;

  const k = 2 / (period + 1);
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

export function calculateBollingerBands(data: Candle[], period: number = 20, multiplier: number = 2): BollingerBandPoint[] {
  const result: BollingerBandPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const middle = sum / period;

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

export function calculateRSI(data: Candle[], period: number = 14): ChartPoint[] {
  const result: ChartPoint[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

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

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi = 100;
    } else if (avgGain === 0) {
      rsi = 0;
    } else {
      rsi = 100 - 100 / (1 + avgGain / avgLoss);
    }
    result.push({ time: data[i].time, value: rsi });
  }
  return result;
}

export function calculateVolumeProfile(data: Candle[], numBins: number = 24): { bins: VolumeProfileBin[]; pocPrice: number } {
  if (data.length === 0) return { bins: [], pocPrice: 0 };

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  data.forEach((c) => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  const range = maxPrice - minPrice;
  const binSize = range > 0 ? range / numBins : 1;

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

  data.forEach((c) => {
    // Determine which bins this candle overlaps
    const startBinIdx = Math.max(0, Math.floor((c.low - minPrice) / binSize));
    const endBinIdx = Math.min(numBins - 1, Math.floor((c.high - minPrice) / binSize));

    if (startBinIdx === endBinIdx) {
      if (startBinIdx >= 0 && startBinIdx < numBins) {
        bins[startBinIdx].volume += c.volume;
      }
    } else {
      const totalSpan = c.high - c.low;
      if (totalSpan > 0) {
        for (let i = startBinIdx; i <= endBinIdx; i++) {
          if (i >= 0 && i < numBins) {
            const binMin = bins[i].priceMin;
            const binMax = bins[i].priceMax;
            const overlapMin = Math.max(c.low, binMin);
            const overlapMax = Math.min(c.high, binMax);
            const overlapRatio = (overlapMax - overlapMin) / totalSpan;
            if (overlapRatio > 0) {
              bins[i].volume += c.volume * overlapRatio;
            }
          }
        }
      } else {
        if (startBinIdx >= 0 && startBinIdx < numBins) {
          bins[startBinIdx].volume += c.volume;
        }
      }
    }
  });

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

// ============================================================================
// 4. AST COMPILER PIPELINE & LOGICAL PARSER
// ============================================================================

export type ASTNode =
  | { type: "AND"; children: ASTNode[] }
  | { type: "OR"; children: ASTNode[] }
  | { type: "NOT"; operand: ASTNode }
  | { type: "COMPARISON"; field: string; operator: ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains"; value: string | number };

export interface Token {
  type: "IDENTIFIER" | "NUMBER" | "STRING" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN" | "OP" | "EOF";
  value: string;
}

export const VALID_FIELDS: Record<string, "number" | "string"> = {
  price: "number",
  volume: "number",
  changePercent: "number",
  marketCap: "number",
  peRatio: "number",
  pbRatio: "number",
  dividendYield: "number",
  debtToEquity: "number",
  roe: "number",
  roce: "number",
  eps: "number",
  revenueGrowth: "number",
  profitMargin: "number",
  freeCashFlow: "number",
  currentRatio: "number",
  quickRatio: "number",
  assetTurnover: "number",
  high52Week: "number",
  low52Week: "number",
  beta: "number",
  sector: "string",
  industry: "string",
  symbol: "string",
  name: "string",
  sma50: "number",
  sma200: "number",
  ema12: "number",
  ema26: "number",
  rsi14: "number",
  bollingerUpper: "number",
  bollingerLower: "number",
  volumeProfilePoc: "number"
};

export class Lexer {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.pos < this.input.length ? this.input[this.pos] : "";
  }

  private nextChar(): string {
    return this.pos < this.input.length ? this.input[this.pos++] : "";
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.nextChar();
        continue;
      }

      if (char === "(") {
        tokens.push({ type: "LPAREN", value: this.nextChar() });
        continue;
      }

      if (char === ")") {
        tokens.push({ type: "RPAREN", value: this.nextChar() });
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = this.nextChar();
        let value = "";
        while (this.peek() && this.peek() !== quote) {
          value += this.nextChar();
        }
        this.nextChar();
        tokens.push({ type: "STRING", value });
        continue;
      }

      if (char === "=" || char === "!" || char === "<" || char === ">") {
        let op = this.nextChar();
        if (this.peek() === "=") {
          op += this.nextChar();
        }
        tokens.push({ type: "OP", value: op });
        continue;
      }

      if (/\d/.test(char) || (char === "." && /\d/.test(this.input[this.pos + 1] || ""))) {
        let numStr = "";
        while (/\d/.test(this.peek()) || this.peek() === ".") {
          numStr += this.nextChar();
        }
        tokens.push({ type: "NUMBER", value: numStr });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let ident = "";
        while (/[a-zA-Z0-9_]/.test(this.peek())) {
          ident += this.nextChar();
        }

        const upperIdent = ident.toUpperCase();
        if (upperIdent === "AND" || ident === "&&") {
          tokens.push({ type: "AND", value: "AND" });
        } else if (upperIdent === "OR" || ident === "||") {
          tokens.push({ type: "OR", value: "OR" });
        } else if (upperIdent === "NOT" || ident === "!") {
          tokens.push({ type: "NOT", value: "NOT" });
        } else if (ident === "contains") {
          tokens.push({ type: "OP", value: "contains" });
        } else {
          tokens.push({ type: "IDENTIFIER", value: ident });
        }
        continue;
      }

      throw new Error(`Unexpected character: ${char} at position ${this.pos}`);
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private match(type: Token["type"]): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new Error(`Expected token type ${type}, got ${tok.type} (${tok.value})`);
    }
    this.current++;
    return tok;
  }

  public parse(): ASTNode {
    const node = this.parseOr();
    if (this.peek().type !== "EOF") {
      throw new Error(`Unexpected trailing tokens starting at ${this.peek().value}`);
    }
    return node;
  }

  private parseOr(): ASTNode {
    const list: ASTNode[] = [this.parseAnd()];
    while (this.peek().type === "OR") {
      this.current++;
      list.push(this.parseAnd());
    }
    return list.length === 1 ? list[0] : { type: "OR", children: list };
  }

  private parseAnd(): ASTNode {
    const list: ASTNode[] = [this.parsePrimary()];
    while (this.peek().type === "AND") {
      this.current++;
      list.push(this.parsePrimary());
    }
    return list.length === 1 ? list[0] : { type: "AND", children: list };
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();

    if (tok.type === "NOT") {
      this.current++;
      const operand = this.parsePrimary();
      return { type: "NOT", operand };
    }

    if (tok.type === "LPAREN") {
      this.current++;
      const node = this.parseOr();
      this.match("RPAREN");
      return node;
    }

    const fieldTok = this.match("IDENTIFIER");
    const field = fieldTok.value;

    if (!(field in VALID_FIELDS)) {
      throw new Error(`Unknown financial field: ${field}`);
    }

    const opTok = this.match("OP");
    const op = opTok.value as ASTNode extends { type: "COMPARISON"; operator: infer O } ? O : string;

    const valTok = this.peek();
    let value: string | number;

    if (valTok.type === "NUMBER") {
      value = parseFloat(valTok.value);
      this.current++;
    } else if (valTok.type === "STRING") {
      value = valTok.value;
      this.current++;
    } else {
      throw new Error(`Expected number or string value, got ${valTok.type}`);
    }

    const expectedType = VALID_FIELDS[field];
    if (expectedType === "number" && typeof value !== "number") {
      throw new Error(`Field '${field}' is numeric, but was compared to string '${value}'`);
    }
    if (expectedType === "string" && typeof value !== "string") {
      throw new Error(`Field '${field}' is string, but was compared to number '${value}'`);
    }

    const validOps = expectedType === "number" 
      ? [">", "<", ">=", "<=", "==", "!="] 
      : ["==", "!=", "contains"];
    if (!validOps.includes(op)) {
      throw new Error(`Operator '${op}' is not supported for field '${field}' (${expectedType})`);
    }

    return {
      type: "COMPARISON",
      field,
      operator: op as ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains",
      value
    };
  }
}

// Selectivity Optimization Heuristics
// Estimates: Numeric comparison (1), Categorical check (2), String contains (5)
function getEvaluationCost(node: ASTNode): number {
  switch (node.type) {
    case "COMPARISON": {
      const fieldType = VALID_FIELDS[node.field];
      if (fieldType === "number") return 1;
      if (node.operator === "contains") return 5;
      return 2;
    }
    case "NOT":
      return 1 + getEvaluationCost(node.operand);
    case "AND":
    case "OR":
      return node.children.reduce((acc, child) => acc + getEvaluationCost(child), 0);
  }
}

export function optimizeAST(node: ASTNode): ASTNode {
  if (node.type === "AND") {
    const children = node.children.map(optimizeAST);
    children.sort((a, b) => getEvaluationCost(a) - getEvaluationCost(b));
    return { type: "AND", children };
  }
  if (node.type === "OR") {
    const children = node.children.map(optimizeAST);
    children.sort((a, b) => getEvaluationCost(a) - getEvaluationCost(b));
    return { type: "OR", children };
  }
  if (node.type === "NOT") {
    return { type: "NOT", operand: optimizeAST(node.operand) };
  }
  return node;
}

export function evaluateAST(node: ASTNode, stock: Stock, livePrices?: Record<string, LivePrice>): boolean {
  switch (node.type) {
    case "COMPARISON": {
      let stockValue: number | string | undefined;
      if (livePrices && livePrices[stock.symbol] && ["price", "changePercent", "volume"].includes(node.field)) {
        const live = livePrices[stock.symbol];
        if (node.field === "price") stockValue = live.price;
        else if (node.field === "changePercent") stockValue = live.changePercent;
        else if (node.field === "volume") stockValue = live.volume;
      } else {
        stockValue = stock[node.field as keyof Stock];
      }

      if (stockValue === undefined) return false;
      const compValue = node.value;

      switch (node.operator) {
        case ">":
          return (stockValue as number) > (compValue as number);
        case "<":
          return (stockValue as number) < (compValue as number);
        case ">=":
          return (stockValue as number) >= (compValue as number);
        case "<=":
          return (stockValue as number) <= (compValue as number);
        case "==":
          if (typeof stockValue === "string") {
            return stockValue.toLowerCase() === (compValue as string).toLowerCase();
          }
          return stockValue === compValue;
        case "!=":
          if (typeof stockValue === "string") {
            return stockValue.toLowerCase() !== (compValue as string).toLowerCase();
          }
          return stockValue !== compValue;
        case "contains":
          return (stockValue as string)
            .toLowerCase()
            .includes((compValue as string).toLowerCase());
        default:
          return false;
      }
    }
    case "NOT":
      return !evaluateAST(node.operand, stock, livePrices);
    case "AND": {
      for (const child of node.children) {
        if (!evaluateAST(child, stock, livePrices)) {
          return false;
        }
      }
      return true;
    }
    case "OR": {
      for (const child of node.children) {
        if (evaluateAST(child, stock, livePrices)) {
          return true;
        }
      }
      return false;
    }
  }
}

export function stableSortStocks(
  stocks: Stock[],
  sorting: { id: string; desc: boolean }[],
  livePrices?: Record<string, LivePrice>
): Stock[] {
  if (sorting.length === 0) return stocks;

  const indexed = stocks.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    for (const sortOption of sorting) {
      const field = sortOption.id;
      const desc = sortOption.desc;

      let valA: number | string | undefined;
      let valB: number | string | undefined;

      if (livePrices && ["price", "changePercent", "volume"].includes(field)) {
        valA = livePrices[a.item.symbol]?.[field as keyof LivePrice] ?? a.item[field as keyof Stock];
        valB = livePrices[b.item.symbol]?.[field as keyof LivePrice] ?? b.item[field as keyof Stock];
      } else {
        valA = a.item[field as keyof Stock];
        valB = b.item[field as keyof Stock];
      }

      if (valA === undefined || valB === undefined) continue;

      if (valA !== valB) {
        if (typeof valA === "string" && typeof valB === "string") {
          const comparison = valA.localeCompare(valB);
          return desc ? -comparison : comparison;
        } else {
          return desc ? (Number(valB) - Number(valA)) : (Number(valA) - Number(valB));
        }
      }
    }
    return a.index - b.index;
  });

  return indexed.map((el) => el.item);
}

// ============================================================================
// 5. WEBSOCKET CONTROLLER & RENDER FRAME BUFFER
// ============================================================================

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
let globalWs: WebSocket | null = null;
let globalWsPromise: Promise<WebSocket> | null = null;
const globalSubscriptions = new Set<string>();
const subscriptionRefs = new Map<string, number>();

let reconnectAttempt = 0;
let reconnectTimeoutId: NodeJS.Timeout | null = null;
const MAX_RECONNECT_DELAY = 30000;

let tickBuffer: {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}[] = [];



function processTickBuffer() {
  if (tickBuffer.length > 0) {
    const ticks = [...tickBuffer];
    tickBuffer = [];
    useScreenerStore.getState().updatePrices(ticks);
  }
  requestAnimationFrame(processTickBuffer);
}

if (typeof window !== "undefined") {
  requestAnimationFrame(processTickBuffer);
}

function getWebSocket(): Promise<WebSocket> {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    return Promise.resolve(globalWs);
  }
  if (globalWsPromise) {
    return globalWsPromise;
  }

  globalWsPromise = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        globalWs = ws;
        globalWsPromise = null;
        reconnectAttempt = 0;
        useScreenerStore.getState().setConnectionStatus("connected");
        globalSubscriptions.forEach((sym) => {
          ws.send(JSON.stringify({ type: "subscribe", channel: `subscribe:price:${sym}` }));
        });
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "ticks" && Array.isArray(payload.data)) {
            tickBuffer.push(...payload.data);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        globalWs = null;
        globalWsPromise = null;
        useScreenerStore.getState().setConnectionStatus("disconnected");
        
        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
        
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
        reconnectAttempt++;
        
        reconnectTimeoutId = setTimeout(() => {
          getWebSocket().catch((err) => console.error("WS reconnect failed:", err));
        }, delay);
      };

      ws.onerror = (err) => {
        useScreenerStore.getState().setConnectionStatus("disconnected");
        reject(err);
      };
    } catch (error) {
      reject(error);
    }
  });

  return globalWsPromise;
}

export function useWebSocket(symbols: string[]) {
  const prevSymbolsRef = useRef<string[]>([]);
  const latestSymbolsRef = useRef<string[]>(symbols);
  useEffect(() => {
    latestSymbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    const prevSymbols = prevSymbolsRef.current;
    const currentSet = new Set(symbols);
    const prevSet = new Set(prevSymbols);

    const toSubscribe = symbols.filter((s) => !prevSet.has(s));
    const toUnsubscribe = prevSymbols.filter((s) => !currentSet.has(s));

    getWebSocket()
      .then((ws) => {
        toSubscribe.forEach((sym) => {
          const refs = subscriptionRefs.get(sym) || 0;
          subscriptionRefs.set(sym, refs + 1);

          if (refs === 0) {
            globalSubscriptions.add(sym);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "subscribe", channel: `subscribe:price:${sym}` }));
            }
          }
        });

        toUnsubscribe.forEach((sym) => {
          const refs = subscriptionRefs.get(sym) || 0;
          if (refs <= 1) {
            subscriptionRefs.delete(sym);
            globalSubscriptions.delete(sym);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "unsubscribe", channel: `unsubscribe:price:${sym}` }));
            }
          } else {
            subscriptionRefs.set(sym, refs - 1);
          }
        });
      })
      .catch((err) => console.error("Failed to connect WS in hook:", err));

    prevSymbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    return () => {
      const active = latestSymbolsRef.current;
      getWebSocket()
        .then((ws) => {
          active.forEach((sym) => {
            const refs = subscriptionRefs.get(sym) || 0;
            if (refs <= 1) {
              subscriptionRefs.delete(sym);
              globalSubscriptions.delete(sym);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "unsubscribe", channel: `unsubscribe:price:${sym}` }));
              }
            } else {
              subscriptionRefs.set(sym, refs - 1);
            }
          });
        })
        .catch((err) => console.error("Failed to cleanup WS in hook:", err))
        .finally(() => {
          if (globalSubscriptions.size === 0 && reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
          }
        });
    };
  }, []);
}

// ============================================================================
// 6. DYNAMIC SCREENER EVALUATION HOOK
// ============================================================================

export function useStockScreener() {
  const { 
    stocks, 
    isLoadingStocks, 
    stocksError, 
    loadStocks, 
    rawFilterString, 
    activeSubFilters,
    filterError, 
    setFilterError, 
    sorting, 
    prices 
  } = useScreenerStore(useShallow((state) => ({
    stocks: state.stocks,
    isLoadingStocks: state.isLoadingStocks,
    stocksError: state.stocksError,
    loadStocks: state.loadStocks,
    rawFilterString: state.rawFilterString,
    activeSubFilters: state.activeSubFilters,
    filterError: state.filterError,
    setFilterError: state.setFilterError,
    sorting: state.sorting,
    prices: state.prices
  })));

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // Combine raw filter string and registered panel criteria
  const combinedFilterString = useMemo(() => {
    const parts: string[] = [];
    if (rawFilterString.trim()) {
      parts.push(`(${rawFilterString.trim()})`);
    }
    Object.values(activeSubFilters).forEach((expr) => {
      if (expr.trim()) {
        parts.push(`(${expr.trim()})`);
      }
    });
    return parts.join(" AND ");
  }, [rawFilterString, activeSubFilters]);

  const parsedAST = useMemo<ASTNode | null>(() => {
    if (!combinedFilterString.trim()) {
      setFilterError(null);
      return null;
    }

    try {
      const lexer = new Lexer(combinedFilterString);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const optimized = optimizeAST(ast);
      
      setFilterError(null);
      return optimized;
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFilterError(err.message || "Query compilation error");
      } else {
        setFilterError("Query compilation error");
      }
      return null;
    }
  }, [combinedFilterString, setFilterError]);

  const filteredAndSortedStocks = useMemo(() => {
    if (stocks.length === 0) return [];
    let result = stocks;

    if (parsedAST) {
      result = stocks.filter((stock) => {
        try {
          return evaluateAST(parsedAST, stock, prices);
        } catch {
          return false;
        }
      });
    } else if (combinedFilterString.trim() && filterError) {
      return []; // Return empty if active query fails compilation
    }

    return stableSortStocks(result, sorting, prices);
  }, [stocks, parsedAST, combinedFilterString, filterError, sorting, prices]);

  return {
    stocks: filteredAndSortedStocks,
    totalCount: stocks.length,
    filteredCount: filteredAndSortedStocks.length,
    isLoading: isLoadingStocks,
    error: stocksError
  };
}
