"use client";

// Portfolio state. Signed-out users get a private localStorage portfolio;
// signed-in users get a cloud portfolio in Supabase (protected by row-level
// security, synced across devices). On first sign-in, any local portfolio is
// migrated up to the cloud automatically.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Position } from "./types";
import { useAuth } from "./useAuth";

const STORAGE_KEY = "stockcoach.portfolio.v1";

function loadLocal(): Position[] {
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

function saveLocal(positions: Position[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // storage full/blocked — nothing useful to do
  }
}

interface PortfolioRow {
  symbol: string;
  name: string;
  shares: number;
  cost_basis: number | null;
  added_at: string;
}

function rowToPosition(r: PortfolioRow): Position {
  return {
    symbol: r.symbol,
    name: r.name,
    shares: r.shares,
    costBasis: r.cost_basis,
    addedAt: new Date(r.added_at).getTime(),
  };
}

export function usePortfolio() {
  const { user, ready } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const cloud = ready && user != null && supabase() != null;

  // Load (and migrate) whenever auth state settles or changes.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      if (!cloud) {
        setPositions(loadLocal());
        setHydrated(true);
        return;
      }
      const sb = supabase()!;
      const { data, error } = await sb
        .from("portfolios")
        .select("symbol,name,shares,cost_basis,added_at")
        .order("added_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        // fall back to local rather than showing an empty portfolio
        setPositions(loadLocal());
        setHydrated(true);
        return;
      }

      let rows = (data ?? []) as PortfolioRow[];

      // One-time migration: lift the local portfolio into the cloud.
      const local = loadLocal();
      if (rows.length === 0 && local.length > 0) {
        const upserts = local.map((p) => ({
          user_id: user!.id,
          symbol: p.symbol,
          name: p.name,
          shares: p.shares,
          cost_basis: p.costBasis,
        }));
        const { error: upErr } = await sb.from("portfolios").upsert(upserts, {
          onConflict: "user_id,symbol",
        });
        if (!upErr) {
          window.localStorage.removeItem(STORAGE_KEY);
          const { data: fresh } = await sb
            .from("portfolios")
            .select("symbol,name,shares,cost_basis,added_at")
            .order("added_at", { ascending: true });
          rows = (fresh ?? []) as PortfolioRow[];
        }
      }

      if (!cancelled) {
        setPositions(rows.map(rowToPosition));
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, cloud, user]);

  // Optimistic local update + fire-and-forget cloud write.
  const apply = useCallback(
    (updater: (prev: Position[]) => Position[], sync?: () => Promise<unknown>) => {
      setPositions((prev) => {
        const next = updater(prev);
        if (!cloud) saveLocal(next);
        return next;
      });
      if (cloud && sync) void sync();
    },
    [cloud]
  );

  const addPosition = useCallback(
    (pos: Omit<Position, "addedAt">) => {
      apply(
        (prev) => {
          const existing = prev.find((p) => p.symbol === pos.symbol);
          if (existing) {
            const totalShares = existing.shares + pos.shares;
            let costBasis = existing.costBasis;
            if (totalShares > 0 && pos.shares > 0 && pos.costBasis != null) {
              const prevCost = (existing.costBasis ?? 0) * existing.shares;
              costBasis = (prevCost + pos.costBasis * pos.shares) / totalShares;
            }
            void syncUpsert({ ...pos, shares: totalShares, costBasis });
            return prev.map((p) =>
              p.symbol === pos.symbol
                ? { ...p, shares: totalShares, costBasis, name: pos.name || p.name }
                : p
            );
          }
          void syncUpsert(pos);
          return [...prev, { ...pos, addedAt: Date.now() }];
        }
      );

      function syncUpsert(p: { symbol: string; name: string; shares: number; costBasis: number | null }) {
        if (!cloud) return;
        const sb = supabase()!;
        void sb.from("portfolios").upsert(
          {
            user_id: user!.id,
            symbol: p.symbol,
            name: p.name,
            shares: p.shares,
            cost_basis: p.costBasis,
          },
          { onConflict: "user_id,symbol" }
        );
      }
    },
    [apply, cloud, user]
  );

  const removePosition = useCallback(
    (symbol: string) =>
      apply(
        (prev) => prev.filter((p) => p.symbol !== symbol),
        async () => supabase()!.from("portfolios").delete().eq("symbol", symbol)
      ),
    [apply]
  );

  const editPosition = useCallback(
    (symbol: string, changes: Partial<Pick<Position, "shares" | "costBasis">>) =>
      apply(
        (prev) => prev.map((p) => (p.symbol === symbol ? { ...p, ...changes } : p)),
        async () =>
          supabase()!
            .from("portfolios")
            .update({
              ...(changes.shares !== undefined ? { shares: changes.shares } : {}),
              ...(changes.costBasis !== undefined ? { cost_basis: changes.costBasis } : {}),
            })
            .eq("symbol", symbol)
      ),
    [apply]
  );

  const importPositions = useCallback(
    (rows: { symbol: string; shares: number; costBasis: number | null }[]) =>
      apply(
        (prev) => {
          const bySymbol = new Map(prev.map((p) => [p.symbol, p]));
          for (const row of rows) {
            bySymbol.set(row.symbol, {
              symbol: row.symbol,
              name: bySymbol.get(row.symbol)?.name ?? row.symbol,
              shares: row.shares,
              costBasis: row.costBasis,
              addedAt: bySymbol.get(row.symbol)?.addedAt ?? Date.now(),
            });
          }
          return [...bySymbol.values()];
        },
        async () =>
          supabase()!.from("portfolios").upsert(
            rows.map((r) => ({
              user_id: user!.id,
              symbol: r.symbol,
              name: r.symbol,
              shares: r.shares,
              cost_basis: r.costBasis,
            })),
            { onConflict: "user_id,symbol" }
          )
      ),
    [apply, user]
  );

  return {
    positions,
    hydrated,
    signedIn: cloud,
    addPosition,
    removePosition,
    editPosition,
    importPositions,
  };
}
