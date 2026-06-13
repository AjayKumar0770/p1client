import re

file_path = "c:/Users/biggr/Downloads/p1/client/src/client-ui.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Dynamic Import and useShallow
if "import dynamic from" not in content:
    content = content.replace(
        'from "react";\nimport {',
        'from "react";\nimport dynamic from "next/dynamic";\nimport { useShallow } from "zustand/react/shallow";\nimport {'
    )

# 2. Fix useScreenerStore global non-atomic selectors
# Instance 1: FilterPanel
content = re.sub(
    r'const \{\s+rawFilterString,\s+setRawFilterString,\s+filterError,\s+columnVisibility,\s+setColumnVisibility,\s+resetFilters,\s+registerSubFilter,\s+unregisterSubFilter\s+\} = useScreenerStore\(\);',
    '''const {
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
    })));''',
    content
)

# Instance 2: ScreenerGrid
content = re.sub(
    r'const \{\s+selectedSymbol,\s+setSelectedSymbol,\s+columnVisibility,\s+sorting,\s+setSorting\s+\} = useScreenerStore\(\);',
    '''const {
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
    })));''',
    content
)

# Instance 3: Home
content = re.sub(
    r'const \{ selectedSymbol, setSelectedSymbol, rawFilterString, connectionStatus \} = useScreenerStore\(\);',
    '''const { selectedSymbol, setSelectedSymbol, rawFilterString, connectionStatus } = useScreenerStore(useShallow(state => ({
      selectedSymbol: state.selectedSymbol,
      setSelectedSymbol: state.setSelectedSymbol,
      rawFilterString: state.rawFilterString,
      connectionStatus: state.connectionStatus
    })));''',
    content
)

# 3. Fix overscan to exactly 10
content = content.replace("overscan: 12", "overscan: 10")

# 4. Remove StockChart definition
# We look for "export function StockChart({ symbol }: { symbol: string }) {" and delete until "// ============================================================================\n// 6. DETAILED STOCK LEDGER RATIOS DISPLAY"
stock_chart_start = content.find("export function StockChart({ symbol }:")
ledger_start = content.find("// ============================================================================\n// 6. DETAILED STOCK LEDGER RATIOS DISPLAY")

if stock_chart_start != -1 and ledger_start != -1:
    content = content[:stock_chart_start] + content[ledger_start:]

# 5. Add dynamic StockChart import
dynamic_import = """
const StockChart = dynamic(() => import("./components/StockChart"), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-[500px] animate-pulse bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800 shadow-2xl" aria-busy="true" aria-label="Loading chart data...">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-zinc-500">Initializing chart canvas...</p>
      </div>
    </div>
  )
});

"""

# Insert dynamic import before the stock ledger display or at the top of Home
if "const StockChart = dynamic" not in content:
    content = content.replace('export default function Home() {', dynamic_import + 'export default function Home() {')

# 6. Explicit CSS Dimensions for CLS
content = content.replace('className="h-[500px] overflow-y-auto"', 'className="h-[500px] min-h-[500px] w-full overflow-y-auto"')

# 7. A11y
content = content.replace('onClick={() => resetFilters()}', 'onClick={() => resetFilters()} aria-label="Reset all filters"')
content = content.replace('onClick={() => setSelectedSymbol("")}', 'onClick={() => setSelectedSymbol("")} aria-label="Clear selected stock"')
content = content.replace('role="grid"', 'role="grid" aria-label="Interactive stock screening grid"')
content = content.replace('type="text"\n              value={searchQuery}', 'type="text"\n              aria-label="Search for a ticker symbol"\n              value={searchQuery}')
content = content.replace('type="text"\n              value={rawFilterString}', 'type="text"\n              aria-label="Filter stocks using custom expressions"\n              value={rawFilterString}')
content = content.replace('<table className="w-full text-xs font-mono">', '<table className="w-full text-xs font-mono" aria-label="Detailed stock ratio ledger">')


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modifications to client-ui.tsx applied successfully.")
