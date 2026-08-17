"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { SetAlert } from "@/components/SetAlert";
import { StyleTabs } from "@/components/StyleTabs";
import { Term } from "@/components/Term";
import { VerdictBadge } from "@/components/VerdictBadge";
import { changeColor, money, num, pct, timeAgo } from "@/lib/format";
import type { Analysis, SignalReason, TradingStyle } from "@/lib/types";
import { usePortfolio } from "@/lib/usePortfolio";

type Range = "1D" | "5D" | "3M" | "1Y";

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<TradingStyle>("long");
  const [range, setRange] = useState<Range>("1Y");
  const { positions, addPosition } = usePortfolio();
  const inPortfolio = positions.some((p) => p.symbol === symbol);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Something went wrong.");
        else setAnalysis(data as Analysis);
      } catch {
        if (!cancelled) setError("Couldn't reach the data service. Are you online?");
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [symbol]);

  const chartCandles = useMemo(() => {
    if (!analysis) return [];
    switch (range) {
      case "1D": {
        if (analysis.intraday.length === 0) return [];
        const lastDay = new Date(analysis.intraday[analysis.intraday.length - 1].time * 1000);
        return analysis.intraday.filter((c) => {
          const d = new Date(c.time * 1000);
          return (
            d.getFullYear() === lastDay.getFullYear() &&
            d.getMonth() === lastDay.getMonth() &&
            d.getDate() === lastDay.getDate()
          );
        });
      }
      case "5D":
        return analysis.intraday;
      case "3M":
        return analysis.daily.slice(-63);
      case "1Y":
        return analysis.daily;
    }
  }, [analysis, range]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm">
        <p className="font-medium text-rose-200">{error}</p>
        <Link href="/" className="mt-3 inline-block text-accent-soft underline underline-offset-2">
          ← Back to portfolio
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        Loading {symbol} and crunching the numbers…
      </div>
    );
  }

  const { quote, verdicts, indicators } = analysis;
  const verdict = verdicts.find((v) => v.style === style)!;
  const marketClosed = quote.marketState !== "REGULAR";
  const rangePos = indicators.rangePosition52w;

  return (
    <div className="space-y-8 fade-up">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-foreground">
          ← Portfolio
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{quote.symbol}</h1>
              <span className="max-w-[320px] truncate text-sm text-muted">{quote.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="tnum text-4xl font-semibold tracking-tight">
                {money(quote.price, quote.currency)}
              </span>
              <span
                className={`tnum rounded-full px-2.5 py-1 text-sm font-medium ${
                  quote.dayChange >= 0
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {quote.dayChange >= 0 ? "+" : ""}
                {money(quote.dayChange, quote.currency)} ({pct(quote.dayChangePct)})
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {quote.exchangeName} · updated {timeAgo(quote.asOf)}
              {marketClosed && (
                <>
                  {" "}
                  · <Term id="market-hours">market closed</Term>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <SetAlert symbol={quote.symbol} price={quote.price} />
            {!inPortfolio && (
              <button
                onClick={() =>
                  addPosition({ symbol: quote.symbol, name: quote.name, shares: 0, costBasis: null })
                }
                className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
              >
                + Watch
              </button>
            )}
            <a
              href={`https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}/news`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
            >
              News ↗
            </a>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">Price</h2>
          <div className="flex gap-0.5 rounded-full border border-line bg-surface-2/60 p-0.5">
            {(["1D", "5D", "3M", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                  range === r ? "bg-accent/25 text-accent-soft" : "text-muted hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <PriceChart
          candles={chartCandles}
          currency={quote.currency}
          intraday={range === "1D" || range === "5D"}
        />
        {rangePos != null && quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted">
              <span className="tnum">52-wk low {money(quote.fiftyTwoWeekLow, quote.currency)}</span>
              <span>
                <Term id="fifty-two-week-range">52-week range</Term>
              </span>
              <span className="tnum">52-wk high {money(quote.fiftyTwoWeekHigh, quote.currency)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-surface-2">
              <div
                className="absolute h-1.5 rounded-full bg-gradient-to-r from-accent/60 to-accent"
                style={{ width: `${Math.min(100, Math.max(0, rangePos * 100))}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent-soft shadow"
                style={{ left: `${Math.min(100, Math.max(0, rangePos * 100))}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold">What&apos;s happening today?</h2>
        <p className="text-sm leading-relaxed text-muted">{analysis.dayMoveExplanation}</p>
        {Math.abs(quote.dayChangePct) >= 2 && (
          <a
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}/news`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-accent-soft underline underline-offset-2"
          >
            Check the headlines for {quote.symbol} →
          </a>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Should I buy, hold, or sell?</h2>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
          Pick your style — the answer genuinely changes. A stock can be a bad day trade and a
          great long-term hold at the same time.
        </p>
        <StyleTabs value={style} onChange={setStyle} />

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <div
            className={`h-1 w-full ${
              verdict.action === "buy"
                ? "bg-emerald-400/70"
                : verdict.action === "sell"
                  ? "bg-rose-400/70"
                  : "bg-amber-400/70"
            }`}
          />
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <VerdictBadge verdict={verdict} />
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>Signal strength</span>
                <div className="relative h-1.5 w-28 rounded-full bg-surface-2">
                  <div className="absolute left-1/2 top-0 h-1.5 w-px bg-line" />
                  <div
                    className={`absolute h-1.5 rounded-full ${verdict.score >= 0 ? "bg-emerald-400/80" : "bg-rose-400/80"}`}
                    style={{
                      left: verdict.score >= 0 ? "50%" : `${50 + verdict.score * 50}%`,
                      width: `${Math.abs(verdict.score) * 50}%`,
                    }}
                  />
                </div>
                <span className="tnum">{(verdict.score * 100).toFixed(0)}</span>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium leading-relaxed">{verdict.headline}</p>

            <div className="mt-4 space-y-2.5">
              {verdict.reasons.map((r, i) => (
                <ReasonCard key={i} reason={r} />
              ))}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
              These signals are computed only from price history — they can&apos;t see news,
              earnings, or the economy, and they are wrong often. Use them to learn how traders
              think, not as instructions. Not financial advice.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">The numbers behind the signals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="200-day average" termId="moving-average" value={money(indicators.sma200, quote.currency)} />
          <Stat label="RSI (14-day)" termId="rsi" value={num(indicators.rsi14, 0)} />
          <Stat
            label="Volatility (annualized)"
            termId="volatility"
            value={indicators.volatilityAnnualPct != null ? `${num(indicators.volatilityAnnualPct, 0)}%` : "—"}
          />
          <Stat label="From 52-week high" termId="fifty-two-week-range" value={pct(indicators.pctFrom52wHigh)} />
          <Stat label="1-month return" termId="momentum" value={pct(indicators.return1mPct)} />
          <Stat label="3-month return" termId="momentum" value={pct(indicators.return3mPct)} />
          <Stat label="1-year return" termId="momentum" value={pct(indicators.return1yPct)} />
          <Stat
            label="MACD momentum"
            termId="macd"
            value={indicators.macd ? (indicators.macd.histogram > 0 ? "Positive ▲" : "Negative ▼") : "—"}
          />
        </div>
      </section>
    </div>
  );
}

function ReasonCard({ reason }: { reason: SignalReason }) {
  const [open, setOpen] = useState(false);
  const dot =
    reason.kind === "bullish"
      ? "bg-emerald-400"
      : reason.kind === "bearish"
        ? "bg-rose-400"
        : "bg-zinc-500";
  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="block w-full rounded-xl border border-line bg-surface-2/50 p-3.5 text-left transition hover:border-accent/50"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          {reason.title}
        </span>
        <span className="shrink-0 text-xs text-muted">{open ? "▲" : "learn why ▼"}</span>
      </div>
      {open && (
        <p className="mt-2 pl-4.5 text-xs leading-relaxed text-muted">
          {reason.detail}
          {reason.term && (
            <>
              {" "}
              <Term id={reason.term}>What&apos;s this term?</Term>
            </>
          )}
        </p>
      )}
    </button>
  );
}

function Stat({ label, value, termId }: { label: string; value: string; termId?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{termId ? <Term id={termId}>{label}</Term> : label}</p>
      <p className="tnum mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
