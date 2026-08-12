"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StyleTabs } from "@/components/StyleTabs";
import { changeColor, money, pct } from "@/lib/format";
import type { TradingStyle } from "@/lib/types";
import type { DailyPicks, Pick } from "@/lib/picks";

export default function PicksPage() {
  const [picks, setPicks] = useState<DailyPicks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<TradingStyle>("long");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/picks");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Something went wrong.");
        else setPicks(data as DailyPicks);
      } catch {
        if (!cancelled) setError("Couldn't reach the data service. Are you online?");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!picks) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-muted">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        Scanning 40 popular stocks and ranking today&apos;s signals…
        <span className="text-xs">(first load of the day takes ~15 seconds)</span>
      </div>
    );
  }

  const { buys, sells } = picks.byStyle[style];
  const dateLabel = new Date(picks.date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8 fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Picks</h1>
        <p className="mt-1 text-sm text-muted">
          {dateLabel} · scanned {picks.scanned} popular US stocks &amp; ETFs at market open and
          kept only the strongest signals (medium/high confidence).
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
        ⚠️ <strong>These are educational signals, not stock tips.</strong> They're computed from
        price patterns alone — no tool can see tomorrow's news or reliably predict prices. A
        "strong signal" is a lesson in how traders read charts, not a promise of profit.
      </div>

      <StyleTabs value={style} onChange={setStyle} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PickColumn
          title="Strongest BUY leanings"
          emptyText="No stock in today's scan earned a confident buy signal for this style — that happens on choppy days. 'No trade' is a valid answer."
          picks={buys}
          kind="buy"
        />
        <PickColumn
          title="Strongest SELL / avoid leanings"
          emptyText="No stock in today's scan earned a confident sell signal for this style."
          picks={sells}
          kind="sell"
        />
      </div>

      <p className="text-xs text-muted">
        Picks refresh automatically each market day. Not financial advice — always do your own
        research before trading real money.
      </p>
    </div>
  );
}

function PickColumn({
  title,
  picks,
  emptyText,
  kind,
}: {
  title: string;
  picks: Pick[];
  emptyText: string;
  kind: "buy" | "sell";
}) {
  const accent = kind === "buy" ? "text-emerald-300" : "text-rose-300";
  return (
    <section>
      <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wider ${accent}`}>{title}</h2>
      {picks.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {picks.map((p, i) => (
            <Link
              key={p.symbol}
              href={`/stock/${p.symbol}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-semibold">{p.symbol}</span>
                    <span className="block max-w-[180px] truncate text-xs text-muted">{p.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="tnum block font-medium">{money(p.price)}</span>
                  <span className={`tnum block text-xs ${changeColor(p.dayChangePct)}`}>
                    {pct(p.dayChangePct)} today
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    kind === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {p.confidence} confidence · {(Math.abs(p.score) * 100).toFixed(0)}/100
                </span>
              </div>
              {p.topReasons.length > 0 && (
                <ul className="mt-2.5 space-y-1 text-xs leading-relaxed text-muted">
                  {p.topReasons.map((r, j) => (
                    <li key={j}>· {r}</li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
