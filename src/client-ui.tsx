"use client";

import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  createContext,
  useContext
} from "react";
import dynamic from "next/dynamic";
import { useShallow } from "zustand/react/shallow";
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatCurrency } from "./utils/formatters";
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

  ArrowUp,
  ArrowDown,
  ChevronDown,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import {
  Stock,
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
      {formatCurrency(price)}
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
    } = useScreenerStore(useShallow(state => ({
      rawFilterString: state.rawFilterString,
      setRawFilterString: state.setRawFilterString,
      filterError: state.filterError,
      columnVisibility: state.columnVisibility,
      setColumnVisibility: state.setColumnVisibility,
      resetFilters: state.resetFilters,
      registerSubFilter: state.registerSubFilter,
      unregisterSubFilter: state.unregisterSubFilter
    })));

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
            aria-label="Filter stocks using custom expressions"
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
                  aria-pressed={isVisible}
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
            aria-label={`Minimum ${label}`}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={valMax}
            onChange={(e) => setValMax(Math.max(parseFloat(e.target.value), valMin))}
            className="w-1/2 accent-amber-500 cursor-pointer h-1 bg-zinc-800 rounded-lg appearance-none"
            aria-label={`Maximum ${label}`}
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
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {selected.length === 0 ? "Select options..." : `${selected.length} selected`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg max-h-40 overflow-y-auto z-40 p-1 shadow-2xl" role="listbox">
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <button
                key={opt}
                role="option"
                aria-selected={isSel}
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
        <span className="text-[10px] text-zinc-400 block font-mono mt-0.5 truncate max-w-[150px]" title={expression}>
          {expression}
        </span>
      </div>
      <button
        onClick={() => setActive(!active)}
        className="text-zinc-400 hover:text-white transition focus:outline-none"
        aria-pressed={active}
        aria-label={`Toggle ${label}`}
      >
        {active ? (
          <ToggleRight className="h-7 w-7 text-amber-500" aria-hidden="true" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-zinc-400" aria-hidden="true" />
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
    } = useScreenerStore(useShallow(state => ({
      selectedSymbol: state.selectedSymbol,
      setSelectedSymbol: state.setSelectedSymbol,
      columnVisibility: state.columnVisibility,
      sorting: state.sorting,
      setSorting: state.setSorting
    })));

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
          return formatCurrency(val);
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

  // eslint-disable-next-line react-hooks/incompatible-library
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
    overscan: 10
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
  }, [focusedRow, focusedCol, rows.length, rowVirtualizer]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
      <div
        ref={parentRef}
        className="flex-1 overflow-auto focus:outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="grid" aria-label="Interactive stock screening grid"
        aria-rowcount={rows.length}
        aria-colcount={visibleHeadersCount}
      >
        {/* Table Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-20 flex" role="row">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex w-full" role="presentation">
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
            <span className="text-[10px] text-zinc-400 block">{item.desc}</span>
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
            <table className="w-full text-xs font-mono" aria-label="Detailed stock ratio ledger">
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

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
            <DollarSign className="h-4 w-4 text-blue-400" />
            Balance Sheet Highlights
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono" aria-label="Detailed stock ratio ledger">
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

// ============================================================================
// 7. MAIN DASHBOARD RENDER ENTRYPOINT
// ============================================================================


const StockChart = dynamic(() => import("./components/StockChart"), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-[500px] animate-pulse bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800 shadow-2xl" aria-busy="true" aria-label="Loading chart data...">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-zinc-400">Initializing chart canvas...</p>
      </div>
    </div>
  )
});

export default function Home() {
  const { stocks, totalCount, filteredCount, isLoading, error } = useStockScreener();
  const { selectedSymbol, rawFilterString, connectionStatus } = useScreenerStore(useShallow(state => ({
    selectedSymbol: state.selectedSymbol,
    rawFilterString: state.rawFilterString,
    connectionStatus: state.connectionStatus
  })));
  
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
    const timer = setTimeout(() => {
      if (rawFilterString) {
        setAnnouncement(`Filtered results updated: ${filteredCount} rows matching criteria`);
      } else {
        setAnnouncement("All custom filter filters cleared");
      }
    }, 0);
    return () => clearTimeout(timer);
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
              <span className="text-zinc-400 font-medium text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
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
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                aria-label="Search for a ticker symbol"
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

            <div className="h-[500px] min-h-[500px] w-full overflow-y-auto">
              {selectedSymbol ? (
                <StockDetails symbol={selectedSymbol} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 p-8 text-center text-xs">
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

      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950/40 py-6 text-center text-xs text-zinc-400">
        <p>© 2026 Aegis Terminal. Designed for ultra-low latency canvas visualization.</p>
      </footer>
    </div>
  );
}
