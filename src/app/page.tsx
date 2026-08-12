"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImportCsv } from "@/components/ImportCsv";
import { SearchBox } from "@/components/SearchBox";
import { Term } from "@/components/Term";
import { changeColor, money, moneyCompact, pct, num } from "@/lib/format";
import type { Position, Quote } from "@/lib/types";
import { usePortfolio } from "@/lib/usePortfolio";

const STARTER_WATCHLIST: Omit<Position, "addedAt">[] = [
  { symbol: "AAPL", name: "Apple Inc.", shares: 0, costBasis: null },
  { symbol: "MSFT", name: "Microsoft Corporation", shares: 0, costBasis: null },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 0, costBasis: null },
  { symbol: "NVDA", name: "NVIDIA Corporation", shares: 0, costBasis: null },
];

export default function Dashboard() {
  const { positions, hydrated, addPosition, removePosition, importPositions } = usePortfolio();
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [dataIssue, setDataIssue] = useState(false);

  const symbols = useMemo(() => positions.map((p) => p.symbol).sort().join(","), [positions]);

  const refresh = useCallback(async () => {
    if (!symbols) return;
    setLoadingQuotes(true);
    try {
      const res = await fetch(`/api/quote?symbols=${symbols}`);
      const data = (await res.json()) as { quotes: Record<string, Quote>; failed?: string[] };
      setQuotes((prev) => ({ ...prev, ...data.quotes }));
      setDataIssue((data.failed?.length ?? 0) > 0 && Object.keys(data.quotes).length === 0);
    } catch {
      setDataIssue(true);
    } finally {
      setLoadingQuotes(false);
    }
  }, [symbols]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const owned = positions.filter((p) => p.shares > 0);
  const watching = positions.filter((p) => p.shares === 0);

  const totals = useMemo(() => {
    let value = 0;
    let dayChange = 0;
    let cost = 0;
    let costKnown = true;
    for (const p of owned) {
      const q = quotes[p.symbol];
      if (!q) continue;
      value += q.price * p.shares;
      dayChange += q.dayChange * p.shares;
      if (p.costBasis != null) cost += p.costBasis * p.shares;
      else costKnown = false;
    }
    const prevValue = value - dayChange;
    return {
      value,
      dayChange,
      dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : 0,
      gain: costKnown && cost > 0 ? value - cost : null,
      gainPct: costKnown && cost > 0 ? ((value - cost) / cost) * 100 : null,
    };
  }, [owned, quotes]);

  const concentration = useMemo(() => {
    if (totals.value <= 0) return null;
    let worst: { symbol: string; pct: number } | null = null;
    for (const p of owned) {
      const q = quotes[p.symbol];
      if (!q) continue;
      const share = ((q.price * p.shares) / totals.value) * 100;
      if (share > 20 && (!worst || share > worst.pct)) worst = { symbol: p.symbol, pct: share };
    }
    return worst;
  }, [owned, quotes, totals.value]);

  if (!hydrated) return null;

  return (
    <div className="space-y-8">
      {positions.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-8 text-center fade-up">
          <h1 className="text-2xl font-semibold">Welcome to StockCoach 👋</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Track the stocks you own (or wish you owned), get plain-English buy/hold/sell signals
            for day trading, swing trading, and long-term investing — and learn what it all means
            along the way. New to stocks?{" "}
            <Link href="/learn" className="text-accent-soft underline underline-offset-2">
              Start with the 5-minute basics
            </Link>
            .
          </p>
          <div className="mx-auto mt-6 max-w-xl text-left">
            <SearchBox onAdd={addPosition} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              onClick={() => STARTER_WATCHLIST.forEach((p) => addPosition(p))}
              className="text-sm text-accent-soft underline underline-offset-2 hover:text-foreground"
            >
              …or start with a sample watchlist (Apple, Microsoft, an S&amp;P 500 fund, NVIDIA)
            </button>
            <div className="w-full max-w-xl text-left">
              <ImportCsv onImport={importPositions} />
            </div>
          </div>
        </section>
      ) : (
        <>
          {dataIssue && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
              📡 Live prices are temporarily unavailable (the free market-data service occasionally
              rate-limits). The app retries automatically every minute — your portfolio is safe and
              nothing is lost.
            </div>
          )}
          <section className="grid gap-4 sm:grid-cols-3 fade-up">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs text-muted">
                <Term id="portfolio">Portfolio</Term> value
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {owned.length ? moneyCompact(totals.value) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {owned.length
                  ? `${owned.length} holding${owned.length === 1 ? "" : "s"} · ${watching.length} watching`
                  : "You're only watching stocks right now — no money at risk."}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs text-muted">
                Today&apos;s <Term id="day-change">change</Term>
              </p>
              <p className={`mt-1 text-3xl font-semibold tracking-tight ${changeColor(totals.dayChange)}`}>
                {owned.length ? `${totals.dayChange >= 0 ? "+" : ""}${money(totals.dayChange)}` : "—"}
              </p>
              <p className={`mt-1 text-xs ${changeColor(totals.dayChange)}`}>
                {owned.length ? pct(totals.dayChangePct) : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs text-muted">
                Total gain/loss vs <Term id="cost-basis">what you paid</Term>
              </p>
              <p className={`mt-1 text-3xl font-semibold tracking-tight ${changeColor(totals.gain)}`}>
                {totals.gain != null ? `${totals.gain >= 0 ? "+" : ""}${money(totals.gain)}` : "—"}
              </p>
              <p className={`mt-1 text-xs ${changeColor(totals.gain)}`}>
                {totals.gainPct != null
                  ? pct(totals.gainPct)
                  : "Add the price you paid to see your profit."}
              </p>
            </div>
          </section>

          {concentration && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
              ⚠️ <strong>{concentration.symbol}</strong> is {concentration.pct.toFixed(0)}% of your
              portfolio. That&apos;s a lot of eggs in one basket —{" "}
              <Term id="diversification">diversification</Term> protects you when a single company
              stumbles.
            </div>
          )}

          {owned.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your holdings</h2>
                <button
                  onClick={refresh}
                  className="text-xs text-muted transition hover:text-foreground"
                >
                  {loadingQuotes ? "Refreshing…" : "↻ Refresh prices"}
                </button>
              </div>
              <PositionTable
                positions={owned}
                quotes={quotes}
                onRemove={removePosition}
                owned
              />
            </section>
          )}

          {watching.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                <Term id="watch-list">Watchlist</Term>
              </h2>
              <PositionTable
                positions={watching}
                quotes={quotes}
                onRemove={removePosition}
                owned={false}
              />
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Add a stock</h2>
            <SearchBox onAdd={addPosition} />
            <div className="mt-4 border-t border-line pt-4">
              <ImportCsv onImport={importPositions} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PositionTable({
  positions,
  quotes,
  onRemove,
  owned,
}: {
  positions: Position[];
  quotes: Record<string, Quote>;
  onRemove: (symbol: string) => void;
  owned: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Today</th>
            {owned && <th className="px-4 py-3 font-medium">Shares</th>}
            {owned && <th className="px-4 py-3 font-medium">Value</th>}
            {owned && <th className="px-4 py-3 font-medium">Gain/loss</th>}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const q = quotes[p.symbol];
            const value = q ? q.price * p.shares : null;
            const gain =
              q && p.costBasis != null ? (q.price - p.costBasis) * p.shares : null;
            const gainPct =
              q && p.costBasis ? ((q.price - p.costBasis) / p.costBasis) * 100 : null;
            return (
              <tr key={p.symbol} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <Link href={`/stock/${p.symbol}`} className="group block">
                    <span className="font-semibold text-accent-soft group-hover:underline">
                      {p.symbol}
                    </span>
                    <span className="block max-w-[220px] truncate text-xs text-muted">
                      {q?.name ?? p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{q ? money(q.price, q.currency) : "…"}</td>
                <td className={`px-4 py-3 ${changeColor(q?.dayChangePct)}`}>
                  {q ? pct(q.dayChangePct) : "…"}
                </td>
                {owned && <td className="px-4 py-3">{num(p.shares, 4)}</td>}
                {owned && <td className="px-4 py-3">{value != null ? money(value) : "…"}</td>}
                {owned && (
                  <td className={`px-4 py-3 ${changeColor(gain)}`}>
                    {gain != null
                      ? `${gain >= 0 ? "+" : ""}${money(gain)} (${pct(gainPct)})`
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/stock/${p.symbol}`}
                    className="mr-2 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-foreground"
                  >
                    Signals →
                  </Link>
                  <button
                    onClick={() => onRemove(p.symbol)}
                    title="Remove"
                    className="rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-rose-300"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
