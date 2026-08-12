// CBOE delayed-quotes CDN — keyless fallback data source that, unlike Yahoo,
// is not blocked from data-center IPs (Vercel). Quotes are ~15 min delayed.
//
// Endpoints (all public JSON, no auth):
//   quotes/{SYM}.json              current delayed quote
//   charts/historical/{SYM}.json   daily OHLCV back ~20 years
//   charts/intraday/{SYM}.json     1-minute bars for the current session

import type { Candle, Quote } from "./types";
import { KNOWN_SYMBOLS } from "./symbols";

const BASE = "https://cdn.cboe.com/api/global/delayed_quotes";

// Small TTL cache — the historical endpoint returns ~20 years of rows, so we
// avoid refetching it for every quote/spark/analysis call.
const cboeCache = new Map<string, { expires: number; data: unknown }>();

async function cboeJson<T>(path: string, ttlMs = 60 * 1000): Promise<T> {
  const hit = cboeCache.get(path);
  if (hit && Date.now() < hit.expires) return hit.data as T;
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CBOE request failed (${res.status})`);
  const data = (await res.json()) as T;
  if (cboeCache.size > 300) cboeCache.clear();
  cboeCache.set(path, { expires: Date.now() + ttlMs, data });
  return data;
}

/** Minutes to add to a naive New-York-local timestamp to get UTC. */
function nyOffsetMs(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - at.getTime();
}

/** "2026-08-12T09:31:00" (ET, no zone marker) -> unix seconds. */
function etToUnix(naive: string): number {
  const [d, t] = naive.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, s] = (t ?? "00:00:00").split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi, s ?? 0);
  return Math.round((guess - nyOffsetMs(new Date(guess))) / 1000);
}

interface CboeQuoteResponse {
  data: {
    symbol: string;
    current_price?: number;
    prev_day_close?: number;
    price_change?: number;
    price_change_percent?: number;
    last_trade_time?: string;
  };
}

export async function getCboeQuote(symbol: string): Promise<Quote> {
  const { data } = await cboeJson<CboeQuoteResponse>(
    `quotes/${encodeURIComponent(symbol.toUpperCase())}.json`
  );
  if (data.current_price == null) throw new Error(`No CBOE data for ${symbol}`);
  const price = data.current_price;
  const prev = data.prev_day_close ?? price;
  const asOf = data.last_trade_time
    ? etToUnix(data.last_trade_time)
    : Math.floor(Date.now() / 1000);
  // CBOE doesn't report market state; infer from trade recency (data is ~15m delayed).
  const marketState = Date.now() / 1000 - asOf < 30 * 60 ? "REGULAR" : "CLOSED";
  return {
    symbol: data.symbol,
    name: KNOWN_SYMBOLS[data.symbol] ?? data.symbol,
    currency: "USD",
    price,
    previousClose: prev,
    dayChange: data.price_change ?? price - prev,
    dayChangePct:
      data.price_change_percent ?? (prev > 0 ? ((price - prev) / prev) * 100 : 0),
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketState,
    exchangeName: "US (delayed)",
    asOf,
  };
}

interface CboeHistoricalResponse {
  data: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
}

/** Daily candles, most recent last. `days` limits how far back we go. */
export async function getCboeDaily(symbol: string, days: number): Promise<Candle[]> {
  const { data } = await cboeJson<CboeHistoricalResponse>(
    `charts/historical/${encodeURIComponent(symbol.toUpperCase())}.json`,
    5 * 60 * 1000
  );
  return data.slice(-days).map((row) => ({
    // Noon ET keeps the candle inside the right local calendar day.
    time: etToUnix(`${row.date}T12:00:00`),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

interface CboeIntradayResponse {
  data: {
    datetime: string;
    price: { open: number; high: number; low: number; close: number };
    volume: { stock_volume: number };
  }[];
}

/** Today's session as 15-minute candles (aggregated from CBOE's 1-minute bars). */
export async function getCboeIntraday15m(symbol: string): Promise<Candle[]> {
  const { data } = await cboeJson<CboeIntradayResponse>(
    `charts/intraday/${encodeURIComponent(symbol.toUpperCase())}.json`
  );
  const out: Candle[] = [];
  let bucket: Candle | null = null;
  let bucketKey = -1;
  for (const row of data) {
    const time = etToUnix(row.datetime);
    const key = Math.floor(time / 900); // 15-minute buckets
    if (key !== bucketKey) {
      if (bucket) out.push(bucket);
      bucketKey = key;
      bucket = {
        time: key * 900,
        open: row.price.open,
        high: row.price.high,
        low: row.price.low,
        close: row.price.close,
        volume: row.volume.stock_volume,
      };
    } else if (bucket) {
      bucket.high = Math.max(bucket.high, row.price.high);
      bucket.low = Math.min(bucket.low, row.price.low);
      bucket.close = row.price.close;
      bucket.volume += row.volume.stock_volume;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}
