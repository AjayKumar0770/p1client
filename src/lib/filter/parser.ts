import { Stock } from "../../types/index";

// AST Node definitions
export type ASTNode =
  | { type: "AND"; children: ASTNode[] }
  | { type: "OR"; children: ASTNode[] }
  | { type: "NOT"; operand: ASTNode }
  | { type: "COMPARISON"; field: string; operator: ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains"; value: string | number };

export interface Token {
  type: "IDENTIFIER" | "NUMBER" | "STRING" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN" | "OP" | "EOF";
  value: string;
}

// 30 Core financial fields validation registry
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

// 1. Lexical Analyzer (Lexer)
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
        this.nextChar(); // skip whitespace
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

      // String literals (e.g. "Technology" or 'Finance')
      if (char === '"' || char === "'") {
        const quote = this.nextChar();
        let value = "";
        while (this.peek() && this.peek() !== quote) {
          value += this.nextChar();
        }
        this.nextChar(); // consume closing quote
        tokens.push({ type: "STRING", value });
        continue;
      }

      // Comparison operators
      if (char === "=" || char === "!" || char === "<" || char === ">") {
        let op = this.nextChar();
        if (this.peek() === "=") {
          op += this.nextChar();
        }
        tokens.push({ type: "OP", value: op });
        continue;
      }

      // Numbers
      if (/\d/.test(char) || char === ".") {
        let numStr = "";
        while (/\d/.test(this.peek()) || this.peek() === ".") {
          numStr += this.nextChar();
        }
        tokens.push({ type: "NUMBER", value: numStr });
        continue;
      }

      // Identifiers / Operators (AND, OR, NOT, contains)
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

// 2. Expression Parser (Recursive Descent)
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
      this.current++; // consume OR
      list.push(this.parseAnd());
    }
    return list.length === 1 ? list[0] : { type: "OR", children: list };
  }

  private parseAnd(): ASTNode {
    const list: ASTNode[] = [this.parsePrimary()];
    while (this.peek().type === "AND") {
      this.current++; // consume AND
      list.push(this.parsePrimary());
    }
    return list.length === 1 ? list[0] : { type: "AND", children: list };
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();

    if (tok.type === "NOT") {
      this.current++; // consume NOT
      const operand = this.parsePrimary();
      return { type: "NOT", operand };
    }

    if (tok.type === "LPAREN") {
      this.current++; // consume (
      const node = this.parseOr();
      this.match("RPAREN"); // consume )
      return node;
    }

    // Otherwise, expect a comparison clause: field op value
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

    // Validate type match
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

// 3. Short-Circuiting AST Evaluator with Selectivity Optimization
// Selectivity optimization: sort AND nodes so cheaper / highly-selective numeric rules are evaluated first.
// Estimated Cost values: Numeric comparison (1), Categorical check (2), String search/contains (5).
function getEvaluationCost(node: ASTNode): number {
  switch (node.type) {
    case "COMPARISON": {
      const fieldType = VALID_FIELDS[node.field];
      if (fieldType === "number") return 1; // cheap numeric check
      if (node.operator === "contains") return 5; // expensive string matching
      return 2; // exact string check (e.g. sector == 'Technology')
    }
    case "NOT":
      return 1 + getEvaluationCost(node.operand);
    case "AND":
    case "OR":
      return node.children.reduce((acc, child) => acc + getEvaluationCost(child), 0);
  }
}

// Recursively optimize AST tree
export function optimizeAST(node: ASTNode): ASTNode {
  if (node.type === "AND") {
    // Recursively optimize children
    const children = node.children.map(optimizeAST);
    // Sort children by evaluation cost (cheaper runs first)
    children.sort((a, b) => getEvaluationCost(a) - getEvaluationCost(b));
    return { type: "AND", children };
  }
  if (node.type === "OR") {
    const children = node.children.map(optimizeAST);
    // For OR, evaluating cheaper nodes first also helps short-circuit to true faster
    children.sort((a, b) => getEvaluationCost(a) - getEvaluationCost(b));
    return { type: "OR", children };
  }
  if (node.type === "NOT") {
    return { type: "NOT", operand: optimizeAST(node.operand) };
  }
  return node;
}

// Main evaluation routine
export function evaluateAST(node: ASTNode, stock: Stock, livePrices?: Record<string, { price: number; changePercent: number; volume: number }>): boolean {
  switch (node.type) {
    case "COMPARISON": {
      // Resolve value, check live pricing store if available
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
      // Short-circuit: return false on first mismatch
      for (const child of node.children) {
        if (!evaluateAST(child, stock, livePrices)) {
          return false;
        }
      }
      return true;
    }

    case "OR": {
      // Short-circuit: return true on first match
      for (const child of node.children) {
        if (evaluateAST(child, stock, livePrices)) {
          return true;
        }
      }
      return false;
    }
  }
}

// 4. Stable Multi-Sort Algorithm
// Performs stable sort by comparing fields, preserving original order on matches.
export function stableSortStocks(
  stocks: Stock[],
  sorting: { id: string; desc: boolean }[],
  livePrices?: Record<string, { price: number; changePercent: number; volume: number }>
): Stock[] {
  if (sorting.length === 0) return stocks;

  // Enhance elements with their original index to guarantee stability
  const indexed = stocks.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    for (const sortOption of sorting) {
      const field = sortOption.id;
      const desc = sortOption.desc;

      // Get values (checking live overrides)
      let valA: number | string | undefined;
      let valB: number | string | undefined;

      if (livePrices && ["price", "changePercent", "volume"].includes(field)) {
        valA = livePrices[a.item.symbol]?.[field as "price" | "changePercent" | "volume"] ?? a.item[field as keyof Stock];
        valB = livePrices[b.item.symbol]?.[field as "price" | "changePercent" | "volume"] ?? b.item[field as keyof Stock];
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
    // Stable sort fallback: original index position
    return a.index - b.index;
  });

  return indexed.map((el) => el.item);
}
