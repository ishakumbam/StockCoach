"use client";

// Ticker search with autocomplete, then a small form to add as "I own it"
// (shares + price paid) or just watch it.

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";

export function SearchBox({
  onAdd,
}: {
  onAdd: (p: { symbol: string; name: string; shares: number; costBasis: number | null }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 1 || picked) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function reset() {
    setPicked(null);
    setQuery("");
    setShares("");
    setCost("");
    setResults([]);
    setOpen(false);
  }

  function submit(watchOnly: boolean) {
    if (!picked) return;
    const sharesNum = watchOnly ? 0 : Number(shares);
    const costNum = cost === "" ? null : Number(cost);
    if (!watchOnly && (!isFinite(sharesNum) || sharesNum <= 0)) return;
    onAdd({
      symbol: picked.symbol,
      name: picked.name,
      shares: watchOnly ? 0 : sharesNum,
      costBasis: watchOnly ? null : costNum,
    });
    reset();
  }

  return (
    <div ref={boxRef} className="relative">
      {!picked ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search any stock — try “Apple” or “TSLA”…"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          {open && results.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl">
              {results.map((r) => (
                <li key={r.symbol}>
                  <button
                    onClick={() => {
                      setPicked(r);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-accent/10"
                  >
                    <span>
                      <span className="font-semibold">{r.symbol}</span>
                      <span className="ml-2 text-muted">{r.name}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {r.type} · {r.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-accent/40 bg-surface p-4 fade-up">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="font-semibold">{picked.symbol}</span>
              <span className="ml-2 text-sm text-muted">{picked.name}</span>
            </div>
            <button onClick={reset} className="text-sm text-muted hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              How many shares do you own?
              <input
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 10"
                className="w-32 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Price you paid per share (optional)
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 150.00"
                className="w-40 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => submit(false)}
                disabled={!shares || Number(shares) <= 0}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                I own this
              </button>
              <button
                onClick={() => submit(true)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
              >
                Just watch it
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            “Just watch it” adds the stock to your watchlist so you can follow it and see signals
            without owning it — the safest way to learn.
          </p>
        </div>
      )}
    </div>
  );
}
