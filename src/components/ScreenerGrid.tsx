"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Stock } from "../types/index";
import { useUIStore } from "../stores/uiStore";
import { useStreamStore } from "../stores/streamStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { ArrowUp, ArrowDown } from "lucide-react";

interface ScreenerGridProps {
  stocks: Stock[];
}

// 1. Memoized Live Price Cell with 300ms micro-flash
const PriceCell = React.memo(({ symbol, initialPrice }: { symbol: string; initialPrice: number }) => {
  const livePrice = useStreamStore((state) => state.prices[symbol]?.price);
  const price = livePrice !== undefined ? livePrice : initialPrice;

  const [flashClass, setFlashClass] = useState("");
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (price === undefined) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      const isUp = price > prevPriceRef.current;
      setFlashClass(isUp ? "flash-up" : "flash-down");
      const timer = setTimeout(() => {
        setFlashClass("");
      }, 300); // Exactly 300ms animation window
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <span className={`inline-block px-1 rounded transition-colors duration-300 font-mono ${flashClass}`}>
      ${price.toFixed(2)}
    </span>
  );
});
PriceCell.displayName = "PriceCell";

// 2. Memoized Live Change Cell
const ChangeCell = React.memo(({ symbol, initialChangePercent }: { symbol: string; initialChangePercent: number }) => {
  const livePct = useStreamStore((state) => state.prices[symbol]?.changePercent);
  const pct = livePct !== undefined ? livePct : initialChangePercent;

  const [flashClass, setFlashClass] = useState("");
  const prevPctRef = useRef<number | null>(null);

  useEffect(() => {
    if (pct === undefined) return;
    if (prevPctRef.current !== null && prevPctRef.current !== pct) {
      const isUp = pct > prevPctRef.current;
      setFlashClass(isUp ? "flash-up" : "flash-down");
      const timer = setTimeout(() => {
        setFlashClass("");
      }, 300);
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

// 3. Main Virtualized Grid Component
export default function ScreenerGrid({ stocks }: ScreenerGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const {
    selectedSymbol,
    setSelectedSymbol,
    columnVisibility,
    sorting,
    setSorting
  } = useUIStore();

  // Setup Column Definitions
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

  // TanStack Table Instance
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

  // TanStack Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Fixed height per row
    overscan: 12 // Overscan cushion of 10-15 rows
  });

  // Extract visible stock symbols for subscription mapping
  const virtualItems = rowVirtualizer.getVirtualItems();
  const visibleSymbols = useMemo(() => {
    return virtualItems.map((item) => rows[item.index]?.original.symbol).filter(Boolean) as string[];
  }, [virtualItems, rows]);

  // Hook up WebSocket subscriptions to live stream prices for visible records
  useWebSocket(visibleSymbols);

  // Keyboard navigation focus coords
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);

  const flatHeaders = table.getFlatHeaders();
  const visibleHeadersCount = flatHeaders.length;

  // Arrow key grid navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  // Adjust focus when index coordinates change
  useEffect(() => {
    if (rows.length === 0) return;
    // Keep virtual scroll aligned with keyboard focus
    rowVirtualizer.scrollToIndex(focusedRow, { align: "auto" });

    // Focus the cell
    const cellId = `cell-${focusedRow}-${focusedCol}`;
    const cellElement = document.getElementById(cellId);
    if (cellElement) {
      cellElement.focus();
    }
  }, [focusedRow, focusedCol, rows.length, rowVirtualizer]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
      {/* Table grid wrapper */}
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
