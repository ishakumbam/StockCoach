"use client";

// Portfolio state, persisted in the browser's localStorage. Private by design:
// holdings never leave the user's device.

import { useCallback, useEffect, useState } from "react";
import type { Position } from "./types";

const STORAGE_KEY = "stockcoach.portfolio.v1";

function load(): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Position[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => typeof p.symbol === "string");
  } catch {
    return [];
  }
}

function save(positions: Position[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // storage full/blocked — nothing useful to do
  }
}

export function usePortfolio() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPositions(load());
    setHydrated(true);
  }, []);

  const update = useCallback((updater: (prev: Position[]) => Position[]) => {
    setPositions((prev) => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  const addPosition = useCallback(
    (pos: Omit<Position, "addedAt">) => {
      update((prev) => {
        const existing = prev.find((p) => p.symbol === pos.symbol);
        if (existing) {
          // Merge: combine shares with a blended cost basis.
          const totalShares = existing.shares + pos.shares;
          let costBasis = existing.costBasis;
          if (totalShares > 0 && pos.shares > 0 && pos.costBasis != null) {
            const prevCost = (existing.costBasis ?? 0) * existing.shares;
            costBasis = (prevCost + pos.costBasis * pos.shares) / totalShares;
          }
          return prev.map((p) =>
            p.symbol === pos.symbol
              ? { ...p, shares: totalShares, costBasis, name: pos.name || p.name }
              : p
          );
        }
        return [...prev, { ...pos, addedAt: Date.now() }];
      });
    },
    [update]
  );

  const removePosition = useCallback(
    (symbol: string) => update((prev) => prev.filter((p) => p.symbol !== symbol)),
    [update]
  );

  const editPosition = useCallback(
    (symbol: string, changes: Partial<Pick<Position, "shares" | "costBasis">>) =>
      update((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, ...changes } : p))),
    [update]
  );

  const importPositions = useCallback(
    (rows: { symbol: string; shares: number; costBasis: number | null }[]) => {
      update((prev) => {
        const bySymbol = new Map(prev.map((p) => [p.symbol, p]));
        for (const row of rows) {
          // Imports replace (not merge) — the CSV is the source of truth.
          bySymbol.set(row.symbol, {
            symbol: row.symbol,
            name: bySymbol.get(row.symbol)?.name ?? row.symbol,
            shares: row.shares,
            costBasis: row.costBasis,
            addedAt: bySymbol.get(row.symbol)?.addedAt ?? Date.now(),
          });
        }
        return [...bySymbol.values()];
      });
    },
    [update]
  );

  return { positions, hydrated, addPosition, removePosition, editPosition, importPositions };
}
