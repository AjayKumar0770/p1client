"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Landmark, TrendingUp, ShieldAlert } from "lucide-react";

interface StockDetailsProps {
  symbol: string;
}

interface FinancialStatementItem {
  year: string;
  revenue?: number;
  grossProfit?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
}

interface FundamentalsResponse {
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
  incomeStatement: FinancialStatementItem[];
  balanceSheet: FinancialStatementItem[];
}

export default function StockDetails({ symbol }: StockDetailsProps) {
  const { data: details, isLoading, error } = useQuery<FundamentalsResponse>({
    queryKey: ["fundamentals", symbol],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks/${symbol}/fundamentals`);
      if (!res.ok) throw new Error("Failed to load fundamentals");
      return res.json();
    },
    enabled: !!symbol
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="mt-2 text-xs font-semibold">Retrieving corporate ledger...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-red-400">
        <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-xs">Ledger data for {symbol} is unavailable.</p>
      </div>
    );
  }

  const { ratios, incomeStatement, balanceSheet } = details;

  const formatCurrency = (val?: number) => {
    if (val === undefined) return "N/A";
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">{details.name} Financial Ratios</h2>
        </div>
        <span className="text-xs text-zinc-400">
          Sector: {details.sector} | Industry: {details.industry}
        </span>
      </div>

      {/* Ratios Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "P/E Ratio", val: ratios.peRatio.toFixed(2), desc: "Valuation Multiple" },
          { label: "P/B Ratio", val: ratios.pbRatio.toFixed(2), desc: "Price-to-Book" },
          { label: "Dividend Yield", val: `${ratios.dividendYield.toFixed(2)}%`, desc: "Annual Yield" },
          { label: "Debt to Equity", val: ratios.debtToEquity.toFixed(2), desc: "Leverage Ratio" },
          { label: "Return on Equity", val: `${ratios.roe.toFixed(2)}%`, desc: "ROE profitability" },
          { label: "ROCE", val: `${ratios.roce.toFixed(2)}%`, desc: "Capital Employed Return" },
          { label: "EPS (LTM)", val: `$${ratios.eps.toFixed(2)}`, desc: "Earnings Per Share" },
          { label: "Revenue Growth", val: `${ratios.revenueGrowth.toFixed(2)}%`, desc: "YoY growth" },
          { label: "Net Margin", val: `${ratios.profitMargin.toFixed(2)}%`, desc: "Profit Margin" },
          { label: "Current Ratio", val: ratios.currentRatio.toFixed(2), desc: "Liquidity Check" },
          { label: "Asset Turnover", val: ratios.assetTurnover.toFixed(2), desc: "Asset Efficiency" },
          { label: "Beta coefficient", val: ratios.beta.toFixed(2), desc: "Risk Metric" }
        ].map((item, idx) => (
          <div key={idx} className="bg-zinc-900 border border-zinc-800/60 p-3 rounded-xl hover:border-zinc-700/60 transition duration-150">
            <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">{item.label}</span>
            <span className="text-base font-bold text-white font-mono">{item.val}</span>
            <span className="text-[10px] text-zinc-400 block">{item.desc}</span>
          </div>
        ))}
      </div>

      {/* Financial Statement Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Income Statement */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Income Statement (YoY)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-zinc-400 text-left border-b border-zinc-800/80">
                  <th scope="col" className="py-1.5 font-semibold">Year</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Revenue</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Gross Profit</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Net Income</th>
                </tr>
              </thead>
              <tbody>
                {incomeStatement.map((stmt, idx) => (
                  <tr key={idx} className="border-b border-zinc-900/50 hover:bg-zinc-900/20">
                    <td className="py-1.5 text-zinc-300 font-bold">{stmt.year}</td>
                    <td className="py-1.5 text-right text-zinc-300">{formatCurrency(stmt.revenue)}</td>
                    <td className="py-1.5 text-right text-zinc-400">{formatCurrency(stmt.grossProfit)}</td>
                    <td className="py-1.5 text-right text-emerald-400 font-semibold">{formatCurrency(stmt.netIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <DollarSign className="h-4 w-4 text-blue-400" />
            Balance Sheet Highlights
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-zinc-400 text-left border-b border-zinc-800/80">
                  <th scope="col" className="py-1.5 font-semibold">Year</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Total Assets</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Liabilities</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Equity</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.map((stmt, idx) => (
                  <tr key={idx} className="border-b border-zinc-900/50 hover:bg-zinc-900/20">
                    <td className="py-1.5 text-zinc-300 font-bold">{stmt.year}</td>
                    <td className="py-1.5 text-right text-zinc-300">{formatCurrency(stmt.totalAssets)}</td>
                    <td className="py-1.5 text-right text-rose-500">{formatCurrency(stmt.totalLiabilities)}</td>
                    <td className="py-1.5 text-right text-blue-400 font-semibold">{formatCurrency(stmt.equity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
