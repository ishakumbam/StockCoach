// Shared types for StockCoach.

export type TradingStyle = "day" | "swing" | "long";

export const TRADING_STYLES: { id: TradingStyle; label: string; horizon: string; blurb: string }[] = [
  {
    id: "day",
    label: "Day trading",
    horizon: "Hours",
    blurb: "Buying and selling within the same day. Fast, exciting, and by far the riskiest — most beginners lose money day trading.",
  },
  {
    id: "swing",
    label: "Swing trading",
    horizon: "Weeks–months",
    blurb: "Holding for weeks to a few months to ride medium-term trends. A middle ground between day trading and investing.",
  },
  {
    id: "long",
    label: "Long-term investing",
    horizon: "Years",
    blurb: "Buying and holding for years. Historically the most reliable way regular people build wealth in stocks.",
  },
];

export interface Quote {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  dayChange: number; // absolute
  dayChangePct: number; // percent, e.g. -1.23
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketState: string; // e.g. REGULAR, CLOSED, PRE, POST
  exchangeName: string;
  asOf: number; // unix seconds
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalKind = "bullish" | "bearish" | "neutral";

export interface SignalReason {
  title: string; // short, plain-English headline
  detail: string; // beginner-friendly explanation of what we saw and why it matters
  kind: SignalKind;
  term?: string; // glossary key this reason teaches
  weight: number; // contribution to the score, for transparency
}

export type VerdictAction = "buy" | "hold" | "sell";

export interface StyleVerdict {
  style: TradingStyle;
  action: VerdictAction;
  score: number; // -1..1
  confidence: "low" | "medium" | "high";
  headline: string; // one-sentence plain-English summary
  reasons: SignalReason[];
}

export interface Analysis {
  quote: Quote;
  daily: Candle[]; // ~1y of daily candles
  intraday: Candle[]; // ~5d of 15m candles
  verdicts: StyleVerdict[];
  dayMoveExplanation: string;
  indicators: IndicatorSnapshot;
}

export interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: { line: number; signal: number; histogram: number } | null;
  volatilityAnnualPct: number | null; // annualized daily volatility, %
  return1mPct: number | null;
  return3mPct: number | null;
  return1yPct: number | null;
  pctFrom52wHigh: number | null; // negative = below high
  rangePosition52w: number | null; // 0 = at 52w low, 1 = at 52w high
}

export interface Position {
  symbol: string;
  name: string;
  shares: number; // 0 for watchlist-only ("want to own")
  costBasis: number | null; // average price paid per share
  addedAt: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}
