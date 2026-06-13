"use client";

import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  createContext,
  useContext
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  createChart,
  UTCTimestamp,
  CandlestickSeries,
  LineSeries
} from "lightweight-charts";
import {
  Activity,
  Sliders,
  CheckSquare,
  Square,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Database,
  ShieldCheck,
  Search,
  Landmark,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  Eye,
  EyeOff,
  LineChart,
  BarChart3,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import {
  Stock,
  LivePrice,
  Candle,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateVolumeProfile,
  useScreenerStore,
  useWebSocket,
  useStockScreener
} from "./client-core";

// ============================================================================
// 1. INJECT CUSTOM DYNAMIC FLASHING STYLES
// ============================================================================

function FlashStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes flashGreen {
        0% { background-color: rgba(16, 185, 129, 0.35); color: #10b981; }
        100% { background-color: transparent; }
      }
      @keyframes flashRed {
        0% { background-color: rgba(239, 68, 68, 0.35); color: #ef4444; }
        100% { background-color: transparent; }
      }
      .flash-up {
        animation: flashGreen 300ms ease-out forwards;
      }
      .flash-down {
        animation: flashRed 300ms ease-out forwards;
      }
      /* Custom Scrollbar for premium dark theme */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #09090b;
      }
      ::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #3f3f46;
      }
    `}} />
  );
}

// ============================================================================
// 2. MEMOIZED LIVE PRICE & CHANGE CELL RENDERERS (300ms micro-flash)
// ============================================================================

const PriceCell = React.memo(({ symbol, initialPrice }: { symbol: string; initialPrice: number }) => {
  const livePrice = useScreenerStore((state) => state.prices[symbol]?.price);
  const price = livePrice !== undefined ? livePrice : initialPrice;

  const [flashClass, setFlashClass] = useState("");
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (price === undefined) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      const isUp = price > prevPriceRef.current;
      setFlashClass(isUp ? "flash-up" : "flash-down");
      const timer = setTimeout(() => setFlashClass(""), 300);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <span className={`inline-block px-1 rounded transition-colors duration-300 font-mono text-white ${flashClass}`}>
      ${price.toFixed(2)}
    </span>
  );
});
PriceCell.displayName = "PriceCell";

const ChangeCell = React.memo(({ symbol, initialChangePercent }: { symbol: string; initialChangePercent: number }) => {
  const livePct = useScreenerStore((state) => state.prices[symbol]?.changePercent);
  const pct = livePct !== undefined ? livePct : initialChangePercent;

  const [flashClass, setFlashClass] = useState("");
  const prevPctRef = useRef<number | null>(null);

  useEffect(() => {
    if (pct === undefined) return;
    if (prevPctRef.current !== null && prevPctRef.current !== pct) {
      const isUp = pct > prevPctRef.current;
      setFlashClass(isUp ? "flash-up" : "flash-down");
      const timer = setTimeout(() => setFlashClass(""), 300);
      return () => clearTimeout(timer);
    }
    prevPctRef.current = pct;
  }, [pct]);

  const isPositive = pct >= 0;

  return (
    <span
      className={`inline-block px-1 rounded transition-colors duration-300 font-mono font-semibold ${
        isPositive ? "text-emerald-500" : "text-rose-500"
      } ${flashClass}`}
    >
      {isPositive ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
});
ChangeCell.displayName = "ChangeCell";

// ============================================================================
// 3. COMPOUND FILTER PANEL COMPONENTS
// ============================================================================

interface FilterPanelContextProps {
  register: (id: string, expression: string) => void;
  unregister: (id: string) => void;
}

const FilterPanelContext = createContext<FilterPanelContextProps | null>(null);

export function FilterPanel({ children }: { children: React.ReactNode }) {
  const {
    rawFilterString,
    setRawFilterString,
    filterError,
    columnVisibility,
    setColumnVisibility,
    resetFilters,
    registerSubFilter,
    unregisterSubFilter
  } = useScreenerStore();

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

  const contextValue = useMemo(() => ({
    register: (id: string, expression: string) => registerSubFilter(id, expression),
    unregister: (id: string) => unregisterSubFilter(id)
  }), [registerSubFilter, unregisterSubFilter]);

  return (
    <FilterPanelContext.Provider value={contextValue}>
      <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-4">
        {/* Row 1: Raw Query Inputs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-amber-500" />
              Advanced Query Compiler Expression
            </label>
            <button
              onClick={resetFilters}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Reset All Filters
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

        {/* Row 2: Sub-module components Injection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-900 pt-4">
          {children}
        </div>

        {/* Row 3: Presets */}
        <div className="border-t border-zinc-900 pt-3">
          <span className="text-xs font-semibold text-zinc-400 block mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Preset Strategies:
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

        {/* Row 4: Column Visibility Grid */}
        <div className="border-t border-zinc-900 pt-3">
          <span className="text-xs font-semibold text-zinc-400 block mb-2">
            Visible Columns Display:
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
    </FilterPanelContext.Provider>
  );
}

// Sub-module 1: NumericRange (Dual Sliders)
FilterPanel.NumericRange = function NumericRange({
  id,
  field,
  label,
  min,
  max,
  step = 1
}: {
  id: string;
  field: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}) {
  const ctx = useContext(FilterPanelContext);
  const [valMin, setValMin] = useState(min);
  const [valMax, setValMax] = useState(max);

  useEffect(() => {
    if (!ctx) return;
    const expression = `${field} >= ${valMin} AND ${field} <= ${valMax}`;
    ctx.register(id, expression);
    return () => ctx.unregister(id);
  }, [ctx, id, field, valMin, valMax]);

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 p-3 rounded-lg flex flex-col justify-between">
      <span className="text-xs font-semibold text-zinc-300 block mb-2">{label}</span>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>Min: <span className="font-mono text-white">{valMin}</span></span>
          <span>Max: <span className="font-mono text-white">{valMax}</span></span>
        </div>
        <div className="flex gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={valMin}
            onChange={(e) => setValMin(Math.min(parseFloat(e.target.value), valMax))}
            className="w-1/2 accent-amber-500 cursor-pointer h-1 bg-zinc-800 rounded-lg appearance-none"
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={valMax}
            onChange={(e) => setValMax(Math.max(parseFloat(e.target.value), valMin))}
            className="w-1/2 accent-amber-500 cursor-pointer h-1 bg-zinc-800 rounded-lg appearance-none"
          />
        </div>
      </div>
    </div>
  );
};

// Sub-module 2: Dropdown (Multi-Select)
FilterPanel.Dropdown = function Dropdown({
  id,
  field,
  label,
  options
}: {
  id: string;
  field: string;
  label: string;
  options: string[];
}) {
  const ctx = useContext(FilterPanelContext);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx) return;
    if (selected.length === 0) {
      ctx.unregister(id);
      return;
    }
    const expression = selected.map((opt) => `${field} == "${opt}"`).join(" OR ");
    ctx.register(id, expression);
    return () => ctx.unregister(id);
  }, [ctx, id, field, selected]);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      setSelected(selected.filter((s) => s !== opt));
    } else {
      setSelected([...selected, opt]);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 p-3 rounded-lg flex flex-col justify-between relative" ref={dropdownRef}>
      <span className="text-xs font-semibold text-zinc-300 block mb-2">{label}</span>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left text-xs text-white px-2.5 py-1.5 rounded-lg flex items-center justify-between transition"
      >
        <span className="truncate">
          {selected.length === 0 ? "Select options..." : `${selected.length} selected`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg max-h-40 overflow-y-auto z-40 p-1 shadow-2xl">
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggleOption(opt)}
                className="w-full text-left text-xs hover:bg-zinc-850 px-2 py-1.5 rounded flex items-center justify-between text-zinc-300 hover:text-white transition"
              >
                <span>{opt}</span>
                {isSel && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Sub-module 3: BooleanToggle
FilterPanel.BooleanToggle = function BooleanToggle({
  id,
  label,
  expression
}: {
  id: string;
  label: string;
  expression: string;
}) {
  const ctx = useContext(FilterPanelContext);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    if (active) {
      ctx.register(id, expression);
    } else {
      ctx.unregister(id);
    }
    return () => ctx.unregister(id);
  }, [ctx, id, expression, active]);

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 p-3 rounded-lg flex items-center justify-between">
      <div>
        <span className="text-xs font-semibold text-zinc-300 block">{label}</span>
        <span className="text-[10px] text-zinc-500 block font-mono mt-0.5 truncate max-w-[150px]" title={expression}>
          {expression}
        </span>
      </div>
      <button
        onClick={() => setActive(!active)}
        className="text-zinc-400 hover:text-white transition focus:outline-none"
      >
        {active ? (
          <ToggleRight className="h-7 w-7 text-amber-500" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-zinc-600" />
        )}
      </button>
    </div>
  );
};

// ============================================================================
// 4. VIRTUALIZED DATA GRID COMPONENT
// ============================================================================

interface ScreenerGridProps {
  stocks: Stock[];
}

export function ScreenerGrid({ stocks }: ScreenerGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const {
    selectedSymbol,
    setSelectedSymbol,
    columnVisibility,
    sorting,
    setSorting
  } = useScreenerStore();

  const columns = useMemo<ColumnDef<Stock>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: "Symbol",
        size: 90,
        cell: (info) => (
          <span className="font-mono font-bold text-white bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/50">
            {info.getValue() as string}
          </span>
        )
      },
      {
        accessorKey: "name",
        header: "Company Name",
        size: 160,
        cell: (info) => (
          <span className="truncate block max-w-[150px]" title={info.getValue() as string}>
            {info.getValue() as string}
          </span>
        )
      },
      {
        accessorKey: "sector",
        header: "Sector",
        size: 120,
        cell: (info) => <span className="text-zinc-400">{info.getValue() as string}</span>
      },
      {
        accessorKey: "price",
        header: "Price",
        size: 90,
        cell: (info) => (
          <PriceCell symbol={info.row.original.symbol} initialPrice={info.getValue() as number} />
        )
      },
      {
        accessorKey: "changePercent",
        header: "Change %",
        size: 90,
        cell: (info) => (
          <ChangeCell symbol={info.row.original.symbol} initialChangePercent={info.getValue() as number} />
        )
      },
      {
        accessorKey: "marketCap",
        header: "Market Cap",
        size: 120,
        cell: (info) => {
          const val = info.getValue() as number;
          if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
          if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
          return `$${(val / 1e6).toFixed(2)}M`;
        }
      },
      {
        accessorKey: "peRatio",
        header: "P/E",
        size: 70,
        cell: (info) => <span className="font-mono text-zinc-300">{(info.getValue() as number).toFixed(1)}</span>
      },
      {
        accessorKey: "pbRatio",
        header: "P/B",
        size: 70,
        cell: (info) => <span className="font-mono text-zinc-300">{(info.getValue() as number).toFixed(1)}</span>
      },
      {
        accessorKey: "dividendYield",
        header: "Yield %",
        size: 80,
        cell: (info) => <span className="font-mono text-zinc-300">{(info.getValue() as number).toFixed(2)}%</span>
      },
      {
        accessorKey: "debtToEquity",
        header: "D/E",
        size: 70,
        cell: (info) => <span className="font-mono text-zinc-300">{(info.getValue() as number).toFixed(2)}</span>
      },
      {
        accessorKey: "roe",
        header: "ROE %",
        size: 80,
        cell: (info) => <span className="font-mono text-zinc-300">{(info.getValue() as number).toFixed(1)}%</span>
      },
      {
        accessorKey: "rsi14",
        header: "RSI 14",
        size: 80,
        cell: (info) => {
          const val = info.getValue() as number;
          return (
            <span
              className={`font-mono font-semibold ${
                val < 30 ? "text-emerald-400" : val > 70 ? "text-rose-400" : "text-zinc-400"
              }`}
            >
              {val.toFixed(1)}
            </span>
          );
        }
      }
    ],
    []
  );

  const table = useReactTable({
    data: stocks,
    columns,
    state: {
      columnVisibility,
      sorting
    },
    onSortingChange: (updater) => {
      if (typeof updater === "function") {
        setSorting(updater(sorting));
      } else {
        setSorting(updater);
      }
    },
    getCoreRowModel: getCoreRowModel()
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const visibleSymbols = useMemo(() => {
    return virtualItems.map((item) => rows[item.index]?.original.symbol).filter(Boolean) as string[];
  }, [virtualItems, rows]);

  useWebSocket(visibleSymbols);

  // Keyboard navigation state coords
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);

  const flatHeaders = table.getFlatHeaders();
  const visibleHeadersCount = flatHeaders.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setFocusedRow((prev) => Math.max(0, prev - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedRow((prev) => Math.min(rows.length - 1, prev + 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        setFocusedCol((prev) => Math.max(0, prev - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setFocusedCol((prev) => Math.min(visibleHeadersCount - 1, prev + 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (rows[focusedRow]) {
          const sym = rows[focusedRow].original.symbol;
          setSelectedSymbol(sym);
        }
        break;
    }
  };

  useEffect(() => {
    if (rows.length === 0) return;
    rowVirtualizer.scrollToIndex(focusedRow, { align: "auto" });

    const timer = setTimeout(() => {
      const cellId = `cell-${focusedRow}-${focusedCol}`;
      const cellElement = document.getElementById(cellId);
      if (cellElement) {
        cellElement.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [focusedRow, focusedCol, rows.length]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
      <div
        ref={parentRef}
        className="flex-1 overflow-auto focus:outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="grid"
        aria-rowcount={rows.length}
        aria-colcount={visibleHeadersCount}
        aria-label="Stock Screener Data Grid"
      >
        {/* Table Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-20 flex" role="row">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex w-full">
              {headerGroup.headers.map((header) => {
                const isSorted = header.column.getIsSorted();
                return (
                  <div
                    key={header.id}
                    className="p-2 text-left font-bold text-xs text-zinc-400 select-none cursor-pointer hover:bg-zinc-800 hover:text-white flex items-center gap-1.5 transition-colors uppercase tracking-wider"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                    role="columnheader"
                    aria-sort={isSorted ? (isSorted === "desc" ? "descending" : "ascending") : "none"}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {isSorted === "asc" && <ArrowUp className="h-3.5 w-3.5 text-amber-500" />}
                    {isSorted === "desc" && <ArrowDown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Table Body */}
        <div
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isSelected = row.original.symbol === selectedSymbol;

            return (
              <div
                key={row.id}
                className={`absolute left-0 w-full flex items-center border-b border-zinc-900/50 hover:bg-zinc-900/40 text-xs transition-colors cursor-pointer ${
                  isSelected ? "bg-amber-500/10 hover:bg-amber-500/15" : ""
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                role="row"
                aria-rowindex={virtualRow.index + 1}
                aria-selected={isSelected}
                onClick={() => setSelectedSymbol(row.original.symbol)}
              >
                {row.getVisibleCells().map((cell, colIndex) => {
                  const isCellFocused = focusedRow === virtualRow.index && focusedCol === colIndex;
                  return (
                    <div
                      key={cell.id}
                      id={`cell-${virtualRow.index}-${colIndex}`}
                      tabIndex={isCellFocused ? 0 : -1}
                      className={`p-2 font-medium truncate flex items-center text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-zinc-900/90`}
                      style={{ width: cell.column.getSize() }}
                      role="gridcell"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. TRADINGVIEW LIGHTWEIGHT CHARTS CANVAS CONTAINER
// ============================================================================

export function StockChart({ symbol }: { symbol: string }) {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showVolProfile, setShowVolProfile] = useState(true);
  const [showTabularData, setShowTabularData] = useState(false);

  const [history, setHistory] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch candlestick history
  useEffect(() => {
    if (!symbol) return;
    setIsLoading(true);
    setError(null);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks/${symbol}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Candles request failed");
        return res.json() as Promise<Candle[]>;
      })
      .then((data) => {
        setHistory(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load candles history");
        setIsLoading(false);
      });
  }, [symbol]);

  // Live WebSocket Tick Binding for Chart
  const livePrice = useScreenerStore((state) => state.prices[symbol]);

  // Combine history with latest live price delta tick
  const historyWithLiveTick = useMemo(() => {
    if (history.length === 0) return [];
    if (!livePrice) return history;

    const last = history[history.length - 1];
    const liveTime = new Date().toISOString().split("T")[0];

    const currentLiveCandle: Candle = {
      time: liveTime,
      open: last.time === liveTime ? last.open : last.close,
      high: last.time === liveTime ? Math.max(last.high, livePrice.price) : Math.max(last.close, livePrice.price),
      low: last.time === liveTime ? Math.min(last.low, livePrice.price) : Math.min(last.close, livePrice.price),
      close: livePrice.price,
      volume: last.time === liveTime ? last.volume : livePrice.volume
    };

    if (last.time === liveTime) {
      return [...history.slice(0, -1), currentLiveCandle];
    } else {
      return [...history, currentLiveCandle];
    }
  }, [history, livePrice]);

  const indicators = useMemo(() => {
    if (historyWithLiveTick.length === 0) return null;

    const sma50 = calculateSMA(historyWithLiveTick, 50);
    const ema12 = calculateEMA(historyWithLiveTick, 12);
    const ema26 = calculateEMA(historyWithLiveTick, 26);
    const bb = calculateBollingerBands(historyWithLiveTick, 20, 2);
    const rsi = calculateRSI(historyWithLiveTick, 14);
    const volProfile = calculateVolumeProfile(historyWithLiveTick, 24);

    return { sma50, ema12, ema26, bb, rsi, volProfile };
  }, [historyWithLiveTick]);

  useEffect(() => {
    if (isLoading || historyWithLiveTick.length === 0 || !mainChartRef.current || !rsiChartRef.current) return;

    mainChartRef.current.innerHTML = "";
    rsiChartRef.current.innerHTML = "";

    const themeColors = {
      background: "#18181b",
      grid: "#27272a",
      text: "#a1a1aa",
      upColor: "#10b981",
      downColor: "#ef4444",
      smaColor: "#f59e0b",
      ema12Color: "#3b82f6",
      ema26Color: "#ec4899",
      bbMiddle: "#8b5cf6",
      bbLines: "rgba(139, 92, 246, 0.4)",
      rsiLine: "#06b6d4",
      rsiGuide: "#4b5563"
    };

    const mainChart = createChart(mainChartRef.current, {
      width: mainChartRef.current.clientWidth || 600,
      height: 320,
      layout: {
        background: { color: themeColors.background },
        textColor: themeColors.text
      },
      grid: {
        vertLines: { color: themeColors.grid },
        horzLines: { color: themeColors.grid }
      },
      timeScale: {
        borderColor: themeColors.grid,
        timeVisible: true
      }
    });

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: themeColors.upColor,
      downColor: themeColors.downColor,
      borderDownColor: themeColors.downColor,
      borderUpColor: themeColors.upColor,
      wickDownColor: themeColors.downColor,
      wickUpColor: themeColors.upColor
    });

    candleSeries.setData(
      historyWithLiveTick.map((c) => ({
        time: c.time as unknown as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }))
    );

    if (showSMA && indicators?.sma50) {
      const smaSeries = mainChart.addSeries(LineSeries, {
        color: themeColors.smaColor,
        lineWidth: 2,
        title: "SMA 50"
      });
      smaSeries.setData(indicators.sma50.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    if (showEMA && indicators) {
      const ema12Series = mainChart.addSeries(LineSeries, {
        color: themeColors.ema12Color,
        lineWidth: 1,
        title: "EMA 12"
      });
      ema12Series.setData(indicators.ema12.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));

      const ema26Series = mainChart.addSeries(LineSeries, {
        color: themeColors.ema26Color,
        lineWidth: 1,
        title: "EMA 26"
      });
      ema26Series.setData(indicators.ema26.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    if (showBB && indicators?.bb) {
      const bbUpperSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbLines, lineWidth: 1, lineStyle: 1, title: "BB Upper" });
      const bbMiddleSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbMiddle, lineWidth: 1, title: "BB Middle" });
      const bbLowerSeries = mainChart.addSeries(LineSeries, { color: themeColors.bbLines, lineWidth: 1, lineStyle: 1, title: "BB Lower" });

      bbUpperSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.upper })));
      bbMiddleSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.middle })));
      bbLowerSeries.setData(indicators.bb.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.lower })));
    }

    const rsiChart = createChart(rsiChartRef.current, {
      width: rsiChartRef.current.clientWidth || 600,
      height: 120,
      layout: {
        background: { color: themeColors.background },
        textColor: themeColors.text
      },
      grid: {
        vertLines: { color: themeColors.grid },
        horzLines: { color: themeColors.grid }
      },
      timeScale: {
        borderColor: themeColors.grid
      }
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: themeColors.rsiLine,
      lineWidth: 2,
      title: "RSI 14"
    });

    if (indicators?.rsi) {
      rsiSeries.setData(indicators.rsi.map(p => ({ time: p.time as unknown as UTCTimestamp, value: p.value })));
    }

    const rsi30Series = rsiChart.addSeries(LineSeries, { color: themeColors.rsiGuide, lineWidth: 1, lineStyle: 3 });
    rsi30Series.setData(historyWithLiveTick.map(c => ({ time: c.time as unknown as UTCTimestamp, value: 30 })));

    const rsi70Series = rsiChart.addSeries(LineSeries, { color: themeColors.rsiGuide, lineWidth: 1, lineStyle: 3 });
    rsi70Series.setData(historyWithLiveTick.map(c => ({ time: c.time as unknown as UTCTimestamp, value: 70 })));

    mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        rsiChart.timeScale().setVisibleLogicalRange(range);
        drawVolumeProfile();
      }
    });

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) mainChart.timeScale().setVisibleLogicalRange(range);
    });

    const drawVolumeProfile = () => {
      const canvas = overlayCanvasRef.current;
      if (!canvas || !mainChartRef.current || !showVolProfile) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = mainChartRef.current.clientWidth;
      canvas.height = 320;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const range = mainChart.timeScale().getVisibleLogicalRange();
      let visibleData = historyWithLiveTick;
      if (range) {
        const startIdx = Math.max(0, Math.floor(range.from));
        const endIdx = Math.min(historyWithLiveTick.length - 1, Math.ceil(range.to));
        if (startIdx <= endIdx) {
          visibleData = historyWithLiveTick.slice(startIdx, endIdx + 1);
        }
      }

      if (visibleData.length === 0) return;
      const volProfile = calculateVolumeProfile(visibleData, 24);
      const { bins } = volProfile;

      const maxVol = Math.max(...bins.map(b => b.volume));
      const profileWidth = canvas.width * 0.25;

      bins.forEach((bin) => {
        const yMin = candleSeries.priceToCoordinate(bin.priceMin);
        const yMax = candleSeries.priceToCoordinate(bin.priceMax);

        if (yMin === null || yMax === null) return;

        const height = Math.abs(yMax - yMin);
        const y = Math.min(yMin, yMax);
        const width = (bin.volume / maxVol) * profileWidth;

        ctx.fillStyle = bin.isPoc ? "rgba(245, 158, 11, 0.4)" : "rgba(161, 161, 170, 0.15)";
        ctx.strokeStyle = bin.isPoc ? "rgba(245, 158, 11, 0.8)" : "rgba(161, 161, 170, 0.3)";
        ctx.lineWidth = 1;

        ctx.fillRect(10, y, width, height);
        ctx.strokeRect(10, y, width, height);

        if (bin.isPoc) {
          ctx.fillStyle = "#f59e0b";
          ctx.font = "10px sans-serif";
          ctx.fillText(`POC: $${((bin.priceMin + bin.priceMax)/2).toFixed(2)}`, width + 15, y + height/2 + 3);
        }
      });
    };

    const handleResize = () => {
      if (!mainChartRef.current || !rsiChartRef.current) return;
      mainChart.resize(mainChartRef.current.clientWidth, 320);
      rsiChart.resize(rsiChartRef.current.clientWidth, 120);
      drawVolumeProfile();
    };

    window.addEventListener("resize", handleResize);
    const timer = setTimeout(drawVolumeProfile, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
      mainChart.remove();
      rsiChart.remove();
    };
  }, [isLoading, historyWithLiveTick, showSMA, showEMA, showBB, showVolProfile, indicators]);

  if (isLoading) {
    return (
      <div className="flex h-[450px] w-full flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="mt-4 text-sm font-medium">Recompiling Indicator Channels...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[450px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-sm font-mono border border-amber-500/20">{symbol}</span>
            Technical Indicator synchronizer
          </h2>
          <p className="text-xs text-zinc-400">Continuous canvas charting overlays & raw momentum evaluation</p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setShowSMA(!showSMA)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showSMA
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showSMA ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            SMA 50
          </button>
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showEMA
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showEMA ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            EMA 12/26
          </button>
          <button
            onClick={() => setShowBB(!showBB)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showBB
                ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showBB ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Bollinger Bands
          </button>
          <button
            onClick={() => setShowVolProfile(!showVolProfile)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition ${
              showVolProfile
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {showVolProfile ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Volume Profile
          </button>
          <button
            onClick={() => setShowTabularData(!showTabularData)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition ${
              showTabularData
                ? "bg-white/10 border-white/20 text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
            aria-label="Toggle screen reader accessible historical table"
          >
            {showTabularData ? <LineChart className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
            Tabular View (Accessible)
          </button>
        </div>
      </div>

      <div className="relative">
        <div className={`space-y-2 ${showTabularData ? "sr-only" : ""}`}>
          <div className="relative h-[320px] w-full" ref={mainChartRef} />
          {showVolProfile && (
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 pointer-events-none z-10"
              style={{ height: 320 }}
            />
          )}
          <div className="h-[120px] w-full" ref={rsiChartRef} />
        </div>

        {showTabularData && (
          <div className="h-[448px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2 font-mono text-xs text-zinc-300">
            <caption className="text-left py-1 text-zinc-400 font-bold block">Historical metrics log (latest 30 days)</caption>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="p-2">Date</th>
                  <th className="p-2">Open</th>
                  <th className="p-2">High</th>
                  <th className="p-2">Low</th>
                  <th className="p-2">Close</th>
                  <th className="p-2">Volume</th>
                  <th className="p-2">RSI (14)</th>
                </tr>
              </thead>
              <tbody>
                {historyWithLiveTick
                  .slice(-30)
                  .reverse()
                  .map((candle, idx) => {
                    const rsiVal = indicators?.rsi?.find(r => r.time === candle.time)?.value;
                    return (
                      <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-950/40">
                        <td className="p-2 text-zinc-400">{candle.time}</td>
                        <td className="p-2">${candle.open.toFixed(2)}</td>
                        <td className="p-2 text-emerald-500">${candle.high.toFixed(2)}</td>
                        <td className="p-2 text-rose-500">${candle.low.toFixed(2)}</td>
                        <td className="p-2 font-semibold">${candle.close.toFixed(2)}</td>
                        <td className="p-2 text-zinc-400">{candle.volume.toLocaleString()}</td>
                        <td className="p-2 text-cyan-400">
                          {rsiVal !== undefined ? rsiVal.toFixed(2) : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 6. DETAILED STOCK LEDGER RATIOS DISPLAY
// ============================================================================

export function StockDetails({ symbol }: { symbol: string }) {
  const details = useScreenerStore((state) => state.fundamentals[symbol]);

  if (!details) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-2 text-xs font-semibold">Retrieving corporate ledger...</p>
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
      <div>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-white tracking-tight">{details.name} Financial Ratios</h2>
        </div>
        <span className="text-xs text-zinc-400">
          Sector: {details.sector} | Industry: {details.industry}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "P/E Ratio", val: ratios.peRatio.toFixed(2), desc: "Valuation Multiple" },
          { label: "P/B Ratio", val: ratios.pbRatio.toFixed(2), desc: "Price-to-Book" },
          { label: "Dividend Yield", val: `${ratios.dividendYield.toFixed(2)}%`, desc: "Annual Yield" },
          { label: "Debt to Equity", val: ratios.debtToEquity.toFixed(2), desc: "Leverage Ratio" },
          { label: "Return on Equity", val: `${ratios.roe.toFixed(2)}%`, desc: "ROE Profitability" },
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
            <span className="text-[10px] text-zinc-500 block">{item.desc}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Income Statement (YoY)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-800/80">
                  <th className="py-1.5 font-semibold">Year</th>
                  <th className="py-1.5 text-right font-semibold">Revenue</th>
                  <th className="py-1.5 text-right font-semibold">Gross Profit</th>
                  <th className="py-1.5 text-right font-semibold">Net Income</th>
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

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <DollarSign className="h-4 w-4 text-blue-400" />
            Balance Sheet Highlights
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-800/80">
                  <th className="py-1.5 font-semibold">Year</th>
                  <th className="py-1.5 text-right font-semibold">Total Assets</th>
                  <th className="py-1.5 text-right font-semibold">Liabilities</th>
                  <th className="py-1.5 text-right font-semibold">Equity</th>
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

// ============================================================================
// 7. MAIN DASHBOARD RENDER ENTRYPOINT
// ============================================================================

export default function Home() {
  const { stocks, totalCount, filteredCount, isLoading, error } = useStockScreener();
  const { selectedSymbol, setSelectedSymbol, rawFilterString, connectionStatus } = useScreenerStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const filteredSearchStocks = useMemo(() => {
    if (!searchQuery.trim()) return stocks;
    const q = searchQuery.toLowerCase();
    return stocks.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [stocks, searchQuery]);

  useEffect(() => {
    if (isLoading) return;
    if (rawFilterString) {
      setAnnouncement(`Filtered results updated: ${filteredCount} rows matching criteria`);
    } else {
      setAnnouncement("All custom filter filters cleared");
    }
  }, [filteredCount, rawFilterString, isLoading]);

  const connectionActive = connectionStatus === "connected";

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 font-sans text-zinc-200">
      <FlashStyles />

      {/* ARIA Live region */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Header */}
      <header className="sticky top-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Activity className="h-5 w-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
              AEGIS
              <span className="text-zinc-500 font-medium text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Terminal
              </span>
            </h1>
            <p className="text-[10px] text-zinc-400">High-Performance Real-Time Stock Screener</p>
          </div>
        </div>

        {/* Pulse badge */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {connectionActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connectionActive ? "bg-emerald-500" : "bg-red-500"}`} />
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            connectionActive 
              ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" 
              : "text-red-400 bg-red-500/5 border-red-500/20"
          }`}>
            {connectionActive ? "Live Ticks Connection Active" : "Live Stream Disconnected"}
          </span>
        </div>
      </header>

      {/* Dashboard Matrix */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Top Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">Core Asset Universe</span>
              <span className="text-lg font-bold text-white font-mono">{totalCount.toLocaleString()} stocks</span>
            </div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">Filtered Query Results</span>
              <span className="text-lg font-bold text-white font-mono">{filteredCount.toLocaleString()} stocks</span>
            </div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl flex items-center justify-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search ticker or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Compound Filter Panel */}
        <FilterPanel>
          <FilterPanel.NumericRange id="peRange" field="peRatio" label="P/E Valuation Ratio" min={5.0} max={120.0} step={1} />
          <FilterPanel.Dropdown id="sectorSel" field="sector" label="Economic Sector Group" options={[
            "Technology", "Financials", "Healthcare", "Energy", "Industrials", "Consumer Cyclical", "Consumer Defensive", "Utilities", "Real Estate", "Basic Materials"
          ]} />
          <FilterPanel.BooleanToggle id="lowDebt" label="Conservative Low Debt" expression="debtToEquity < 1.0" />
        </FilterPanel>

        {isLoading ? (
          <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-zinc-400">Loading asset ledger records...</p>
          </div>
        ) : error ? (
          <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/20 text-red-400">
            <p className="text-sm">Server Offline. Check backend simulation status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[500px]">
              <ScreenerGrid stocks={filteredSearchStocks} />
            </div>

            <div className="h-[500px] overflow-y-auto">
              {selectedSymbol ? (
                <StockDetails symbol={selectedSymbol} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 p-8 text-center text-xs">
                  <Landmark className="h-8 w-8 mb-2 opacity-50" />
                  Select a ticker symbol in the data grid to audit corporate ledger ratios.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Charting Section */}
        {selectedSymbol && (
          <div className="w-full">
            <StockChart symbol={selectedSymbol} />
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950/40 py-6 text-center text-xs text-zinc-600">
        <p>© 2026 Aegis Terminal. Designed for ultra-low latency canvas visualization.</p>
      </footer>
    </div>
  );
}
