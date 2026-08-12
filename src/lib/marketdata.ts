// The data layer the API routes talk to. Tries Yahoo Finance first (rich
// data, works from residential networks), and falls back to CBOE's delayed
// CDN (works from data-center IPs, where Yahoo rate-limits aggressively).

import { getCboeDaily, getCboeIntraday15m, getCboeQuote } from "./cboe";
import { KNOWN_SYMBOLS } from "./symbols";
import type { Candle, Quote, SearchResult } from "./types";
import * as yahoo from "./yahoo";
import type { ChartData } from "./yahoo";

const RANGE_DAYS: Record<string, number> = {
  "5d": 7,
  "1mo": 23,
  "3mo": 65,
  "6mo": 128,
  "1y": 253,
  "2y": 506,
};

function fiftyTwoWeek(candles: Candle[]): { high: number | null; low: number | null } {
  const year = candles.slice(-253);
  if (year.length === 0) return { high: null, low: null };
  return {
    high: Math.max(...year.map((c) => c.high)),
    low: Math.min(...year.map((c) => c.low)),
  };
}

export async function getChart(
  symbol: string,
  range: string,
  interval: string
): Promise<ChartData> {
  try {
    return await yahoo.getChart(symbol, range, interval);
  } catch {
    // CBOE fallback.
    if (interval === "15m" || interval === "1m" || interval === "5m") {
      const [candles, quote] = await Promise.all([
        getCboeIntraday15m(symbol),
        getCboeQuote(symbol),
      ]);
      return { quote, candles };
    }
    const days = RANGE_DAYS[range] ?? 253;
    const [allDaily, quote] = await Promise.all([
      getCboeDaily(symbol, Math.max(days, 253)),
      getCboeQuote(symbol),
    ]);
    const { high, low } = fiftyTwoWeek(allDaily);
    return {
      quote: { ...quote, fiftyTwoWeekHigh: high, fiftyTwoWeekLow: low },
      candles: allDaily.slice(-days),
    };
  }
}

export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  let quotes: Record<string, Quote> = {};
  try {
    quotes = await yahoo.getQuotes(symbols);
  } catch {
    // fall through — CBOE picks up everything below
  }
  const missing = symbols.filter((s) => !quotes[s]);
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.map(async (s) => {
        quotes[s] = await getCboeQuote(s);
      })
    );
  }
  return quotes;
}

const TICKER_RE = /^[A-Za-z][A-Za-z.\-]{0,7}$/;

async function offlineSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  for (const [symbol, name] of Object.entries(KNOWN_SYMBOLS)) {
    if (symbol.toLowerCase().startsWith(q) || name.toLowerCase().includes(q)) {
      results.push({ symbol, name, exchange: "US", type: "Equity/ETF" });
    }
    if (results.length >= 8) break;
  }

  // If it looks like a ticker we don't know, validate it against CBOE so the
  // user can still add anything (e.g. "RIVN").
  const upper = query.trim().toUpperCase();
  if (TICKER_RE.test(upper) && !results.some((r) => r.symbol === upper)) {
    try {
      const quote = await getCboeQuote(upper);
      results.unshift({ symbol: quote.symbol, name: quote.name, exchange: "US", type: "Equity" });
    } catch {
      // not a real ticker — ignore
    }
  }
  return results.slice(0, 8);
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  try {
    const results = await yahoo.searchSymbols(query);
    if (results.length > 0) return results;
    return await offlineSearch(query);
  } catch {
    return offlineSearch(query);
  }
}
