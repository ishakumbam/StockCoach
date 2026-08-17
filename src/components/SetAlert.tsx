"use client";

// "Set alert" button + popover on the stock page: create a price target.

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export function SetAlert({ symbol, price }: { symbol: string; price: number }) {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"price_above" | "price_below">("price_above");
  const [threshold, setThreshold] = useState("");
  const [saved, setSaved] = useState(false);

  if (!ready || !supabase()) return null;

  async function save() {
    const value = Number(threshold);
    if (!isFinite(value) || value <= 0 || !user) return;
    await supabase()!.from("alerts").insert({
      user_id: user.id,
      symbol,
      kind,
      threshold: value,
    });
    setSaved(true);
    setTimeout(() => {
      setOpen(false);
      setSaved(false);
      setThreshold("");
    }, 1500);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground"
      >
        🎯 Set alert
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-line bg-surface-2 p-4 shadow-2xl fade-up">
          {!user ? (
            <p className="text-xs leading-relaxed text-muted">
              Price alerts need a free account so we can watch this stock for you.{" "}
              <Link href="/login" className="text-accent-soft underline">
                Sign in →
              </Link>
            </p>
          ) : saved ? (
            <p className="text-center text-sm">✅ Alert set — we&apos;re watching {symbol}.</p>
          ) : (
            <>
              <p className="text-sm font-medium">Alert me when {symbol}…</p>
              <div className="mt-2 flex gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
                <button
                  onClick={() => setKind("price_above")}
                  className={`flex-1 rounded-md px-2 py-1.5 transition ${
                    kind === "price_above" ? "bg-emerald-500/20 text-emerald-300" : "text-muted"
                  }`}
                >
                  rises above
                </button>
                <button
                  onClick={() => setKind("price_below")}
                  className={`flex-1 rounded-md px-2 py-1.5 transition ${
                    kind === "price_below" ? "bg-rose-500/20 text-rose-300" : "text-muted"
                  }`}
                >
                  drops below
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted">$</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={(kind === "price_above" ? price * 1.05 : price * 0.95).toFixed(2)}
                  className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">Now: {money(price)} · checked every ~10 min during market hours</p>
              <button
                onClick={save}
                disabled={!threshold || Number(threshold) <= 0}
                className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-soft disabled:opacity-40"
              >
                Set alert
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
