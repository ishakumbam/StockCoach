// Pure technical-indicator math. No I/O.
import type { Candle, IndicatorSnapshot } from "./types";

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

/** Wilder's RSI. Returns null when there isn't enough data. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { line: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signalPeriod) return null;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdSeries = emaFast.map((v, i) => v - emaSlow[i]).slice(slow - 1);
  const signalSeries = ema(macdSeries, signalPeriod);
  const line = macdSeries[macdSeries.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { line, signal, histogram: line - signal };
}

/** Annualized volatility (%) from daily closes. */
export function annualizedVolatilityPct(closes: number[]): number | null {
  if (closes.length < 21) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) returns.push(closes[i] / closes[i - 1] - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function pctReturn(closes: number[], tradingDays: number): number | null {
  if (closes.length <= tradingDays) return null;
  const then = closes[closes.length - 1 - tradingDays];
  const now = closes[closes.length - 1];
  if (then <= 0) return null;
  return (now / then - 1) * 100;
}

export function computeIndicators(daily: Candle[]): IndicatorSnapshot {
  const closes = daily.map((c) => c.close);
  const highs = daily.map((c) => c.high);
  const lows = daily.map((c) => c.low);
  const last = closes[closes.length - 1] ?? null;

  const high52 = highs.length ? Math.max(...highs) : null;
  const low52 = lows.length ? Math.min(...lows) : null;

  let pctFrom52wHigh: number | null = null;
  let rangePosition52w: number | null = null;
  if (last != null && high52 != null && low52 != null && high52 > 0) {
    pctFrom52wHigh = (last / high52 - 1) * 100;
    rangePosition52w = high52 === low52 ? 1 : (last - low52) / (high52 - low52);
  }

  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    volatilityAnnualPct: annualizedVolatilityPct(closes),
    return1mPct: pctReturn(closes, 21),
    return3mPct: pctReturn(closes, 63),
    return1yPct: pctReturn(closes, Math.min(251, closes.length - 1)),
    pctFrom52wHigh,
    rangePosition52w,
  };
}
