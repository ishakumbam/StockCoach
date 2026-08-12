// Brokerage CSV import: auto-detects columns from Schwab, Fidelity, Robinhood,
// E*TRADE, Vanguard and generic exports. Pure — takes text, returns rows.

export interface ImportedRow {
  symbol: string;
  shares: number;
  costBasis: number | null; // per-share average cost when derivable
}

/** RFC-4180-ish CSV line splitter that handles quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (cleaned === "" || cleaned === "--" || cleaned.toLowerCase() === "n/a") return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

const SYMBOL_HEADERS = ["symbol", "ticker", "ticker symbol", "security", "instrument"];
const SHARES_HEADERS = ["quantity", "qty", "shares", "share quantity", "qty (quantity)"];
const AVG_COST_HEADERS = [
  "average cost",
  "average cost basis",
  "avg cost",
  "average price",
  "cost/share",
  "cost per share",
  "price paid",
  "purchase price",
  "average price paid",
];
const TOTAL_COST_HEADERS = ["cost basis", "cost basis total", "total cost", "total cost basis", "cost"];

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().replace(/["']/g, "").trim());
  for (const cand of candidates) {
    const i = lower.findIndex((h) => h === cand);
    if (i !== -1) return i;
  }
  for (const cand of candidates) {
    const i = lower.findIndex((h) => h.includes(cand));
    if (i !== -1) return i;
  }
  return -1;
}

const SKIP_SYMBOLS = new Set([
  "CASH",
  "CASH & CASH INVESTMENTS",
  "ACCOUNT TOTAL",
  "TOTAL",
  "PENDING ACTIVITY",
  "SWVXX",
]);

export function parseBrokerageCsv(text: string): { rows: ImportedRow[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], error: "The file is empty." };

  // Schwab exports start with a title line ("Positions for account ...") —
  // find the first line that actually looks like a header row.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = splitCsvLine(lines[i]);
    if (findColumn(cells, SYMBOL_HEADERS) !== -1) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      rows: [],
      error:
        "Couldn't find a Symbol/Ticker column. Export your positions as CSV from your brokerage and try again.",
    };
  }

  const headers = splitCsvLine(lines[headerIdx]);
  const symCol = findColumn(headers, SYMBOL_HEADERS);
  const sharesCol = findColumn(headers, SHARES_HEADERS);
  const avgCol = findColumn(headers, AVG_COST_HEADERS);
  const totalCol = findColumn(headers, TOTAL_COST_HEADERS);

  const rows: ImportedRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length <= symCol) continue;
    const rawSymbol = cells[symCol]?.toUpperCase().trim() ?? "";
    const symbol = rawSymbol.replace(/[^A-Z0-9.\-^]/g, "");
    if (!symbol || symbol.length > 8) continue;
    if (SKIP_SYMBOLS.has(rawSymbol) || SKIP_SYMBOLS.has(symbol)) continue;

    const shares = sharesCol !== -1 ? (parseNumber(cells[sharesCol] ?? "") ?? 0) : 0;
    if (shares <= 0) continue;

    let costBasis: number | null = null;
    if (avgCol !== -1) costBasis = parseNumber(cells[avgCol] ?? "");
    if (costBasis == null && totalCol !== -1) {
      const total = parseNumber(cells[totalCol] ?? "");
      if (total != null && shares > 0) costBasis = total / shares;
    }

    rows.push({ symbol, shares, costBasis });
  }

  if (rows.length === 0) {
    return { rows: [], error: "Found the header row but no valid positions underneath it." };
  }
  return { rows };
}
