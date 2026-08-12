// Server-side fetchers for Yahoo Finance's public endpoints.
// Only used from API routes (Node runtime). Unofficial API, so we're careful:
// - establish a cookie + crumb session (much higher rate limits)
// - batch quotes into a single request
// - cache responses in memory with a short TTL
// - retry once on 429 after refreshing the session

import type { Candle, Quote, SearchResult } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Session (cookie + crumb)
// ---------------------------------------------------------------------------

interface YahooSession {
  cookie: string;
  crumb: string;
  createdAt: number;
}

let session: YahooSession | null = null;
let sessionPromise: Promise<YahooSession> | null = null;

async function createSession(): Promise<YahooSession> {
  // fc.yahoo.com returns a 404 but sets the cookie we need.
  const cookieRes = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": UA },
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);
  const setCookie = cookieRes?.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  let crumb = "";
  if (cookie) {
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie },
      cache: "no-store",
    }).catch(() => null);
    if (crumbRes?.ok) crumb = (await crumbRes.text()).trim();
  }
  return { cookie, crumb, createdAt: Date.now() };
}

async function getSession(force = false): Promise<YahooSession> {
  const stale = !session || Date.now() - session.createdAt > 30 * 60 * 1000;
  if (!force && session && !stale) return session;
  if (!sessionPromise) {
    sessionPromise = createSession()
      .then((s) => {
        session = s;
        return s;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

// ---------------------------------------------------------------------------
// Tiny in-memory TTL cache — dev/server instance local, resets on redeploy.
// ---------------------------------------------------------------------------

const cache = new Map<string, { expires: number; data: unknown }>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs: number) {
  if (cache.size > 500) cache.clear(); // crude but sufficient bound
  cache.set(key, { expires: Date.now() + ttlMs, data });
}

// ---------------------------------------------------------------------------
// Fetch helper with session + one retry on rate limit
// ---------------------------------------------------------------------------

async function yahooFetch(url: string, attempt = 0): Promise<Response> {
  const s = await getSession();
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = s.crumb ? `${url}${sep}crumb=${encodeURIComponent(s.crumb)}` : url;
  const res = await fetch(fullUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...(s.cookie ? { Cookie: s.cookie } : {}),
    },
    cache: "no-store",
  });
  if ((res.status === 429 || res.status === 401 || res.status === 403) && attempt === 0) {
    await getSession(true);
    await new Promise((r) => setTimeout(r, 800));
    return yahooFetch(url, 1);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Charts (price history) — v8, one request per symbol
// ---------------------------------------------------------------------------

interface YahooChartResponse {
  chart: {
    result?: {
      meta: {
        currency?: string;
        symbol: string;
        exchangeName?: string;
        fullExchangeName?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketTime?: number;
        marketState?: string;
      };
      timestamp?: number[];
      indicators: {
        quote: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { code: string; description: string } | null;
  };
}

function toCandles(
  result: NonNullable<YahooChartResponse["chart"]["result"]>[number]
): Candle[] {
  const ts = result.timestamp ?? [];
  const q = result.indicators.quote[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close?.[i];
    if (close == null) continue; // skip gaps (halts, partial bars)
    candles.push({
      time: ts[i],
      open: q.open?.[i] ?? close,
      high: q.high?.[i] ?? close,
      low: q.low?.[i] ?? close,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return candles;
}

export interface ChartData {
  quote: Quote;
  candles: Candle[];
}

export async function getChart(
  symbol: string,
  range: string,
  interval: string
): Promise<ChartData> {
  const key = `chart:${symbol}:${range}:${interval}`;
  const cached = cacheGet<ChartData>(key);
  if (cached) return cached;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await yahooFetch(url);
  if (!res.ok) throw new Error(`Yahoo chart request failed (${res.status})`);
  const data = (await res.json()) as YahooChartResponse;
  if (data.chart.error) throw new Error(data.chart.error.description);

  const first = data.chart.result?.[0];
  if (!first) throw new Error(`No data for symbol ${symbol}`);
  const meta = first.meta;
  const candles = toCandles(first);

  const price = meta.regularMarketPrice ?? candles[candles.length - 1]?.close ?? 0;
  const previousClose =
    meta.previousClose ??
    meta.chartPreviousClose ??
    candles[candles.length - 2]?.close ??
    price;
  const dayChange = price - previousClose;

  const chartData: ChartData = {
    quote: {
      symbol: meta.symbol,
      name: meta.longName ?? meta.shortName ?? meta.symbol,
      currency: meta.currency ?? "USD",
      price,
      previousClose,
      dayChange,
      dayChangePct: previousClose > 0 ? (dayChange / previousClose) * 100 : 0,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      marketState: meta.marketState ?? "UNKNOWN",
      exchangeName: meta.fullExchangeName ?? meta.exchangeName ?? "",
      asOf: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
    },
    candles,
  };
  cacheSet(key, chartData, 60 * 1000);
  return chartData;
}

// ---------------------------------------------------------------------------
// Batch quotes — v7, ONE request for all symbols (needs cookie + crumb)
// ---------------------------------------------------------------------------

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: {
      symbol: string;
      longName?: string;
      shortName?: string;
      currency?: string;
      regularMarketPrice?: number;
      regularMarketPreviousClose?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      fiftyTwoWeekHigh?: number;
      fiftyTwoWeekLow?: number;
      marketState?: string;
      fullExchangeName?: string;
      regularMarketTime?: number;
    }[];
    error?: unknown;
  };
}

export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const quotes: Record<string, Quote> = {};
  const missing: string[] = [];

  for (const s of symbols) {
    const cached = cacheGet<Quote>(`quote:${s}`);
    if (cached) quotes[s] = cached;
    else missing.push(s);
  }
  if (missing.length === 0) return quotes;

  // Try the batch endpoint first (one request for everything).
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      missing.join(",")
    )}`;
    const res = await yahooFetch(url);
    if (res.ok) {
      const data = (await res.json()) as YahooQuoteResponse;
      for (const r of data.quoteResponse?.result ?? []) {
        if (r.regularMarketPrice == null) continue;
        const prev = r.regularMarketPreviousClose ?? r.regularMarketPrice;
        const quote: Quote = {
          symbol: r.symbol,
          name: r.longName ?? r.shortName ?? r.symbol,
          currency: r.currency ?? "USD",
          price: r.regularMarketPrice,
          previousClose: prev,
          dayChange: r.regularMarketChange ?? r.regularMarketPrice - prev,
          dayChangePct:
            r.regularMarketChangePercent ??
            (prev > 0 ? ((r.regularMarketPrice - prev) / prev) * 100 : 0),
          fiftyTwoWeekHigh: r.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: r.fiftyTwoWeekLow ?? null,
          marketState: r.marketState ?? "UNKNOWN",
          exchangeName: r.fullExchangeName ?? "",
          asOf: r.regularMarketTime ?? Math.floor(Date.now() / 1000),
        };
        quotes[quote.symbol] = quote;
        cacheSet(`quote:${quote.symbol}`, quote, 60 * 1000);
      }
    }
  } catch {
    // fall through to per-symbol charts below
  }

  // Fallback for anything the batch call didn't return.
  const stillMissing = missing.filter((s) => !quotes[s]);
  await Promise.allSettled(
    stillMissing.map(async (s) => {
      const { quote } = await getChart(s, "5d", "1d");
      quotes[s] = quote;
      cacheSet(`quote:${s}`, quote, 60 * 1000);
    })
  );

  return quotes;
}

// ---------------------------------------------------------------------------
// Symbol search
// ---------------------------------------------------------------------------

interface YahooSearchResponse {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    typeDisp?: string;
    quoteType?: string;
  }[];
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const key = `search:${query.toLowerCase()}`;
  const cached = cacheGet<SearchResult[]>(key);
  if (cached) return cached;

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=8&newsCount=0&listsCount=0`;
  const res = await yahooFetch(url);
  if (!res.ok) throw new Error(`Yahoo search failed (${res.status})`);
  const data = (await res.json()) as YahooSearchResponse;
  const results = (data.quotes ?? [])
    .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
    .map((q) => ({
      symbol: q.symbol!,
      name: q.longname ?? q.shortname ?? q.symbol!,
      exchange: q.exchDisp ?? "",
      type: q.typeDisp ?? "",
    }));
  cacheSet(key, results, 60 * 60 * 1000);
  return results;
}
