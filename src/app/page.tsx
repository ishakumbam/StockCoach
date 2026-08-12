"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImportCsv } from "@/components/ImportCsv";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { Sparkline } from "@/components/Sparkline";
import { Term } from "@/components/Term";
import { changeColor, money, moneyCompact, pct, num } from "@/lib/format";
import type { DailyPicks } from "@/lib/picks";
import type { Position, Quote } from "@/lib/types";
import { usePortfolio } from "@/lib/usePortfolio";

const STARTER_WATCHLIST: Omit<Position, "addedAt">[] = [
  { symbol: "AAPL", name: "Apple Inc.", shares: 0, costBasis: null },
  { symbol: "MSFT", name: "Microsoft Corporation", shares: 0, costBasis: null },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 0, costBasis: null },
  { symbol: "NVDA", name: "NVIDIA Corporation", shares: 0, costBasis: null },
];

const ALLOC_COLORS = ["#6366f1", "#34d399", "#f59e0b", "#38bdf8", "#f472b6", "#a78bfa", "#fb923c", "#4ade80"];

export default function Dashboard() {
  const { positions, hydrated, signedIn, addPosition, removePosition, importPositions } =
    usePortfolio();
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
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

  useEffect(() => {
    if (!symbols) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/spark?symbols=${symbols}`);
        const data = (await res.json()) as { sparks: Record<string, number[]> };
        if (!cancelled) setSparks((prev) => ({ ...prev, ...data.sparks }));
      } catch {
        // sparklines are decoration — fail silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbols]);

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

  const allocation = useMemo(() => {
    if (totals.value <= 0) return [];
    return owned
      .map((p) => {
        const q = quotes[p.symbol];
        return { symbol: p.symbol, weight: q ? ((q.price * p.shares) / totals.value) * 100 : 0 };
      })
      .filter((a) => a.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [owned, quotes, totals.value]);

  const concentration = allocation.find((a) => a.weight > 20) ?? null;

  if (!hydrated) return null;

  if (positions.length === 0) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-8 text-center fade-up sm:p-12">
        <span className="mx-auto mb-5 inline-block drop-shadow-[0_8px_24px_rgba(99,102,241,0.45)]">
          <Logo size={56} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to StockCoach</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Track the stocks you own (or wish you owned), get plain-English buy/hold/sell signals for
          day trading, swing trading, and long-term investing — and learn as you go. New to
          stocks?{" "}
          <Link href="/learn" className="text-accent-soft underline underline-offset-2">
            Start with the 5-minute basics
          </Link>
          .
        </p>
        <div className="mt-8 text-left">
          <SearchBox onAdd={addPosition} />
        </div>
        <button
          onClick={() => STARTER_WATCHLIST.forEach((p) => addPosition(p))}
          className="mt-5 text-sm text-accent-soft underline underline-offset-2 hover:text-foreground"
        >
          …or start with a sample watchlist (Apple, Microsoft, an S&amp;P 500 fund, NVIDIA)
        </button>
        <div className="mt-6 border-t border-line pt-6 text-left">
          <ImportCsv onImport={importPositions} />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3 fade-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-xs text-muted">
            {owned.length} holding{owned.length === 1 ? "" : "s"} · {watching.length} on watchlist ·
            prices refresh every minute
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-foreground"
        >
          {loadingQuotes ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {dataIssue && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
          📡 Live prices are temporarily unavailable. The app retries automatically every minute —
          your portfolio is safe and nothing is lost.
        </div>
      )}

      {!signedIn && positions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
          <span className="text-muted">
            💾 Your portfolio currently lives only in this browser.{" "}
            <span className="text-foreground">Create a free account</span> to keep it safe and
            synced across devices.
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-soft"
          >
            Sign up →
          </Link>
        </div>
      )}

      <PicksStrip />

      <section className="grid gap-4 sm:grid-cols-3 fade-up">
        <StatCard
          label={<><Term id="portfolio">Portfolio</Term> value</>}
          value={owned.length ? moneyCompact(totals.value) : "—"}
          sub={owned.length ? undefined : "Watching only — no money at risk."}
        />
        <StatCard
          label={<>Today&apos;s <Term id="day-change">change</Term></>}
          value={owned.length ? `${totals.dayChange >= 0 ? "+" : ""}${money(totals.dayChange)}` : "—"}
          valueClass={changeColor(totals.dayChange)}
          sub={owned.length ? pct(totals.dayChangePct) : undefined}
          subClass={changeColor(totals.dayChange)}
        />
        <StatCard
          label={<>All-time gain vs <Term id="cost-basis">cost</Term></>}
          value={totals.gain != null ? `${totals.gain >= 0 ? "+" : ""}${money(totals.gain)}` : "—"}
          valueClass={changeColor(totals.gain)}
          sub={totals.gainPct != null ? pct(totals.gainPct) : "Add the price you paid to see profit."}
          subClass={totals.gainPct != null ? changeColor(totals.gain) : undefined}
        />
      </section>

      {allocation.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 fade-up">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Allocation</h2>
            <span className="text-xs text-muted">
              <Term id="diversification">Why does this matter?</Term>
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-line/50">
            {allocation.map((a, i) => (
              <div
                key={a.symbol}
                title={`${a.symbol} ${a.weight.toFixed(1)}%`}
                style={{ width: `${a.weight}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {allocation.map((a, i) => (
              <span key={a.symbol} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                />
                <span className="font-medium text-foreground">{a.symbol}</span>
                <span className="tnum">{a.weight.toFixed(1)}%</span>
              </span>
            ))}
          </div>
          {concentration && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              ⚠️ <strong>{concentration.symbol}</strong> is {concentration.weight.toFixed(0)}% of
              your portfolio — a lot of eggs in one basket. Diversifying protects you when a single
              company stumbles.
            </p>
          )}
        </section>
      )}

      {owned.length > 0 && (
        <section className="fade-up">
          <h2 className="mb-3 text-lg font-semibold">Holdings</h2>
          <PositionTable
            positions={owned}
            quotes={quotes}
            sparks={sparks}
            onRemove={removePosition}
            owned
          />
        </section>
      )}

      {watching.length > 0 && (
        <section className="fade-up">
          <h2 className="mb-3 text-lg font-semibold">
            <Term id="watch-list">Watchlist</Term>
          </h2>
          <PositionTable
            positions={watching}
            quotes={quotes}
            sparks={sparks}
            onRemove={removePosition}
            owned={false}
          />
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6 fade-up">
        <h2 className="text-lg font-semibold">Add a stock</h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          Search by company name or ticker — add it as a holding or just watch it.
        </p>
        <SearchBox onAdd={addPosition} />
        <div className="mt-5 border-t border-line pt-5">
          <ImportCsv onImport={importPositions} />
        </div>
      </section>
    </div>
  );
}

function PicksStrip() {
  const [picks, setPicks] = useState<DailyPicks | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as DailyPicks;
        if (!cancelled) setPicks(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  const topBuys = picks?.byStyle.long.buys.slice(0, 3) ?? [];

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          ⚡ Today&apos;s strongest signals
          {picks && (
            <span className="hidden text-xs font-normal text-muted sm:inline">
              from a scan of {picks.scanned} popular stocks
            </span>
          )}
        </div>
        <Link
          href="/picks"
          className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-soft"
        >
          See all picks →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!picks ? (
          <span className="flex items-center gap-2 text-xs text-muted">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-line border-t-accent" />
            Scanning the market…
          </span>
        ) : topBuys.length === 0 ? (
          <span className="text-xs text-muted">
            No confident buy signals in today&apos;s scan — choppy day. &quot;No trade&quot; is a
            valid answer.
          </span>
        ) : (
          topBuys.map((p) => (
            <Link
              key={p.symbol}
              href={`/stock/${p.symbol}`}
              className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs transition hover:border-emerald-400"
            >
              <span className="font-semibold text-emerald-300">{p.symbol}</span>
              <span className="tnum text-muted">{money(p.price)}</span>
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                BUY lean
              </span>
            </Link>
          ))
        )}
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
        Educational signals from price patterns (long-term style) — not financial advice.
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = "",
  subClass = "text-muted",
}: {
  label: React.ReactNode;
  value: string;
  sub?: React.ReactNode;
  valueClass?: string;
  subClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tnum mt-1.5 text-3xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
      {sub && <p className={`tnum mt-1 text-xs ${subClass}`}>{sub}</p>}
    </div>
  );
}

function PositionTable({
  positions,
  quotes,
  sparks,
  onRemove,
  owned,
}: {
  positions: Position[];
  quotes: Record<string, Quote>;
  sparks: Record<string, number[]>;
  onRemove: (symbol: string) => void;
  owned: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">30-day trend</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
            <th className="px-4 py-3 text-right font-medium">Today</th>
            {owned && <th className="px-4 py-3 text-right font-medium">Shares</th>}
            {owned && <th className="px-4 py-3 text-right font-medium">Value</th>}
            {owned && <th className="px-4 py-3 text-right font-medium">Gain/loss</th>}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const q = quotes[p.symbol];
            const value = q ? q.price * p.shares : null;
            const gain = q && p.costBasis != null ? (q.price - p.costBasis) * p.shares : null;
            const gainPct = q && p.costBasis ? ((q.price - p.costBasis) / p.costBasis) * 100 : null;
            return (
              <tr
                key={p.symbol}
                className="group border-b border-line/70 transition last:border-0 hover:bg-surface-2/50"
              >
                <td className="px-4 py-3.5">
                  <Link href={`/stock/${p.symbol}`} className="block">
                    <span className="font-semibold text-foreground group-hover:text-accent-soft">
                      {p.symbol}
                    </span>
                    <span className="block max-w-[200px] truncate text-xs text-muted">
                      {q?.name ?? p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/stock/${p.symbol}`} className="block">
                    <Sparkline values={sparks[p.symbol]} />
                  </Link>
                </td>
                <td className="tnum px-4 py-3.5 text-right font-medium">
                  {q ? money(q.price, q.currency) : "…"}
                </td>
                <td className={`tnum px-4 py-3.5 text-right ${changeColor(q?.dayChangePct)}`}>
                  {q ? pct(q.dayChangePct) : "…"}
                </td>
                {owned && <td className="tnum px-4 py-3.5 text-right">{num(p.shares, 4)}</td>}
                {owned && (
                  <td className="tnum px-4 py-3.5 text-right">
                    {value != null ? money(value) : "…"}
                  </td>
                )}
                {owned && (
                  <td className={`tnum px-4 py-3.5 text-right ${changeColor(gain)}`}>
                    {gain != null ? (
                      <>
                        {gain >= 0 ? "+" : ""}
                        {money(gain)}
                        <span className="block text-xs opacity-75">{pct(gainPct)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <Link
                    href={`/stock/${p.symbol}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-foreground"
                  >
                    Signals →
                  </Link>
                  <button
                    onClick={() => onRemove(p.symbol)}
                    title={`Remove ${p.symbol}`}
                    className="ml-1 rounded-lg px-2 py-1.5 text-xs text-muted opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
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
