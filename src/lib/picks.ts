// Daily picks: scan a universe of popular, liquid US stocks at market open,
// run the signal engine on each, and rank the strongest buy/sell leanings
// per trading style. Educational only — the UI must keep saying so.

import { computeIndicators } from "./indicators";
import { getChart } from "./marketdata";
import { buildVerdicts } from "./signals";
import type { StyleVerdict, TradingStyle } from "./types";

// Liquid, well-known names beginners will recognize. Kept modest so a full
// scan stays fast and gentle on the free data sources.
const SCAN_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "AMD", "NFLX",
  "JPM", "V", "MA", "BAC", "GS", "UNH", "LLY", "JNJ", "PFE", "MRK",
  "WMT", "COST", "HD", "MCD", "KO", "PEP", "NKE", "SBUX", "DIS", "UBER",
  "CRM", "ORCL", "ADBE", "INTC", "QCOM", "PLTR", "COIN", "XOM", "CVX", "CAT",
];

export interface Pick {
  symbol: string;
  name: string;
  price: number;
  dayChangePct: number;
  score: number;
  confidence: StyleVerdict["confidence"];
  headline: string;
  topReasons: string[]; // short titles of the strongest agreeing reasons
}

export interface DailyPicks {
  date: string; // YYYY-MM-DD (America/New_York)
  generatedAt: number; // unix seconds
  scanned: number;
  failed: number;
  byStyle: Record<TradingStyle, { buys: Pick[]; sells: Pick[] }>;
}

function nyDateString(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

let cached: DailyPicks | null = null;
let building: Promise<DailyPicks> | null = null;

async function scanSymbol(
  symbol: string,
  attempt = 0
): Promise<{ symbol: string; verdicts: StyleVerdict[]; name: string; price: number; dayChangePct: number } | null> {
  try {
    // Daily data only: half the requests of a full analysis. Day-style
    // verdicts fall back to the day-change signal, which is fine for a scan —
    // the stock detail page still runs the full intraday analysis.
    const dailyData = await getChart(symbol, "1y", "1d");
    const indicators = computeIndicators(dailyData.candles);
    const verdicts = buildVerdicts(indicators, dailyData.quote, []);
    return {
      symbol,
      verdicts,
      name: dailyData.quote.name,
      price: dailyData.quote.price,
      dayChangePct: dailyData.quote.dayChangePct,
    };
  } catch {
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
      return scanSymbol(symbol, 1);
    }
    return null;
  }
}

/** Run fn over items with a bounded number of parallel workers. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toPick(
  row: { symbol: string; name: string; price: number; dayChangePct: number },
  verdict: StyleVerdict
): Pick {
  const agreeing = verdict.reasons
    .filter((r) => (verdict.score >= 0 ? r.kind === "bullish" : r.kind === "bearish"))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3)
    .map((r) => r.title);
  return {
    symbol: row.symbol,
    name: row.name,
    price: row.price,
    dayChangePct: row.dayChangePct,
    score: verdict.score,
    confidence: verdict.confidence,
    headline: verdict.headline,
    topReasons: agreeing,
  };
}

async function buildPicks(): Promise<DailyPicks> {
  const rows = await mapLimit(SCAN_UNIVERSE, 4, (s) => scanSymbol(s));
  const ok = rows.filter((r): r is NonNullable<typeof r> => r != null);

  const byStyle = {} as DailyPicks["byStyle"];
  for (const style of ["day", "swing", "long"] as TradingStyle[]) {
    const scored = ok
      .map((row) => ({ row, verdict: row.verdicts.find((v) => v.style === style)! }))
      .filter((x) => x.verdict.confidence !== "low"); // only conviction picks — "best only"

    const buys = scored
      .filter((x) => x.verdict.action === "buy")
      .sort((a, b) => b.verdict.score - a.verdict.score)
      .slice(0, 5)
      .map((x) => toPick(x.row, x.verdict));
    const sells = scored
      .filter((x) => x.verdict.action === "sell")
      .sort((a, b) => a.verdict.score - b.verdict.score)
      .slice(0, 5)
      .map((x) => toPick(x.row, x.verdict));
    byStyle[style] = { buys, sells };
  }

  return {
    date: nyDateString(),
    generatedAt: Math.floor(Date.now() / 1000),
    scanned: ok.length,
    failed: SCAN_UNIVERSE.length - ok.length,
    byStyle,
  };
}

/**
 * Picks for the current market day, cached in memory. Recomputed when the
 * NY calendar day changes (i.e. first request at/after each market open) or
 * if the cached scan mostly failed.
 */
export async function getDailyPicks(): Promise<DailyPicks> {
  const today = nyDateString();
  if (cached && cached.date === today && cached.scanned >= SCAN_UNIVERSE.length / 2) {
    return cached;
  }
  if (!building) {
    building = buildPicks()
      .then((p) => {
        cached = p;
        return p;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}
