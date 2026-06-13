"use client";

import React from "react";
import { useUIStore } from "../stores/uiStore";
import { Sparkles, Sliders, CheckSquare, Square, RefreshCw, AlertCircle } from "lucide-react";

export default function FilterPanel() {
  const {
    rawFilterString,
    setRawFilterString,
    filterError,
    columnVisibility,
    setColumnVisibility,
    resetFilters
  } = useUIStore();

  const presets = [
    {
      name: "Undervalued Tech",
      query: "sector == \"Technology\" AND peRatio < 25 AND roe > 15"
    },
    {
      name: "Oversold Dividend Leaders",
      query: "rsi14 < 35 AND dividendYield > 3.0"
    },
    {
      name: "High-Margin Growth",
      query: "revenueGrowth > 20 AND profitMargin > 18 AND debtToEquity < 1.5"
    },
    {
      name: "Conservative Value",
      query: "peRatio < 15 AND pbRatio < 2.0 AND currentRatio > 1.5"
    }
  ];

  const handleToggleColumn = (colKey: string) => {
    setColumnVisibility({
      ...columnVisibility,
      [colKey]: !columnVisibility[colKey]
    });
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* Query Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-amber-500" />
            Custom Query Expression Compiler
          </label>
          <button
            onClick={resetFilters}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Clear Filters
          </button>
        </div>
        
        <input
          type="text"
          value={rawFilterString}
          onChange={(e) => setRawFilterString(e.target.value)}
          placeholder='e.g., peRatio < 20 AND marketCap > 50000000000 AND rsi14 < 35'
          className={`w-full bg-zinc-900 border ${
            filterError ? "border-red-500/50 focus:ring-red-500/30" : "border-zinc-800 focus:ring-amber-500/30"
          } rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition`}
        />
        
        {filterError && (
          <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 p-2 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span>{filterError}</span>
          </div>
        )}
      </div>

      {/* Presets */}
      <div>
        <span className="text-xs font-semibold text-zinc-400 block mb-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Preset Strategy Query Filters:
        </span>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setRawFilterString(preset.query)}
              className="text-xs bg-zinc-900 border border-zinc-800 hover:border-amber-500/30 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg transition"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Column Visibility Matrix */}
      <div>
        <span className="text-xs font-semibold text-zinc-400 block mb-2">
          Grid Columns Display Matrix:
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {Object.keys(columnVisibility).map((key) => {
            const isVisible = columnVisibility[key];
            const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
            return (
              <button
                key={key}
                onClick={() => handleToggleColumn(key)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition select-none"
              >
                {isVisible ? (
                  <CheckSquare className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-zinc-700" />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
