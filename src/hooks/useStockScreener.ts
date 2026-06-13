import { useQuery } from "@tanstack/react-query";
import { useUIStore } from "../stores/uiStore";
import { useStreamStore } from "../stores/streamStore";
import { Lexer, Parser, optimizeAST, evaluateAST, stableSortStocks, ASTNode } from "../lib/filter/parser";
import { useEffect, useMemo } from "react";
import { Stock } from "../types/index";

export function useStockScreener() {
  const { rawFilterString, filterError, setFilterError, sorting } = useUIStore();
  const livePrices = useStreamStore((state) => state.prices);

  // Fetch the full list of 5,000 stocks from the REST endpoint
  const { data: allStocks = [], isLoading, error } = useQuery<Stock[]>({
    queryKey: ["stocks"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/stocks`);
      if (!res.ok) throw new Error("Failed to fetch stocks from server");
      return res.json();
    }
  });

  // Compile AST from filter string with error boundary capturing
  const parsedAST = useMemo<ASTNode | null>(() => {
    if (!rawFilterString.trim()) {
      setFilterError(null);
      return null;
    }

    try {
      const lexer = new Lexer(rawFilterString);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const optimized = optimizeAST(ast);
      
      setFilterError(null); // Clear error on successful compile
      return optimized;
    } catch (err: any) {
      setFilterError(err.message || "Query compilation error");
      return null;
    }
  }, [rawFilterString, setFilterError]);

  // Filter and sort stocks
  // We include livePrices in dependency list if we want live filtering/sorting, 
  // but to prevent layout jumping we only re-filter and re-sort when:
  // - The main stock list changes
  // - The AST structure changes (user typed/updated filter)
  // - The user clicks to change sorting
  const filteredAndSortedStocks = useMemo(() => {
    if (allStocks.length === 0) return [];

    let result = allStocks;

    // Apply AST filter if compilation succeeded
    if (parsedAST) {
      result = allStocks.filter((stock) => {
        try {
          return evaluateAST(parsedAST, stock, livePrices);
        } catch {
          return false;
        }
      });
    } else if (rawFilterString.trim() && filterError) {
      // If there is an active query that has an error, return empty or full list
      // returning empty list is safer as it signals query failure
      return [];
    }

    // Apply stable multi-sort
    return stableSortStocks(result, sorting, livePrices);
  }, [allStocks, parsedAST, rawFilterString, filterError, sorting]);

  return {
    stocks: filteredAndSortedStocks,
    totalCount: allStocks.length,
    filteredCount: filteredAndSortedStocks.length,
    isLoading,
    error
  };
}
