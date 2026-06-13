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
  // Pre-calculated indicator snapshots
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi14: number;
  bollingerUpper: number;
  bollingerLower: number;
  volumeProfilePoc: number;
}
