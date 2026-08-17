"use client";

// Alert settings: push toggle, automatic-alert preferences, price targets.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/format";
import { disablePush, enablePush, getPushState } from "@/lib/push-client";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

interface AlertRow {
  id: string;
  symbol: string;
  kind: string;
  threshold: number | null;
  active: boolean;
}

interface Prefs {
  day_move: boolean;
  day_move_pct: number;
  signal_flip: boolean;
  briefing: boolean;
}

const DEFAULT_PREFS: Prefs = { day_move: true, day_move_pct: 5, signal_flip: true, briefing: true };

export default function AlertsPage() {
  const { user, ready } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [rules, setRules] = useState<AlertRow[]>([]);
  const [pushState, setPushState] = useState<"unsupported" | "denied" | "subscribed" | "off">("off");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    if (!sb || !user) return;
    const [{ data: p }, { data: a }] = await Promise.all([
      sb.from("alert_prefs").select("day_move,day_move_pct,signal_flip,briefing").maybeSingle(),
      sb.from("alerts").select("id,symbol,kind,threshold,active").order("created_at", { ascending: false }),
    ]);
    if (p) setPrefs(p as Prefs);
    setRules((a ?? []) as AlertRow[]);
    setPushState(await getPushState());
  }, [user]);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center fade-up">
        <p className="text-3xl">🔔</p>
        <h1 className="mt-2 text-xl font-semibold">Alerts need an account</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Alerts are personal — big moves on <em>your</em> stocks, <em>your</em> price targets.
          Sign in (free) and we&apos;ll keep watch for you.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft"
        >
          Sign in / Sign up →
        </Link>
      </div>
    );
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    const sb = supabase();
    if (!sb) return;
    await sb.from("alert_prefs").upsert({ user_id: user!.id, ...next }, { onConflict: "user_id" });
  }

  async function togglePush() {
    setBusy(true);
    try {
      if (pushState === "subscribed") {
        await disablePush();
      } else {
        await enablePush();
      }
      setPushState(await getPushState());
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await supabase()?.from("alerts").delete().eq("id", id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">🔔 Alerts</h1>
        <p className="mt-1 text-sm text-muted">
          We check your stocks every ~10 minutes during market hours.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Browser notifications</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Get pop-ups on this device even when StockCoach is closed. On iPhone, first add
          StockCoach to your home screen (Share → Add to Home Screen).
        </p>
        {pushState === "unsupported" ? (
          <p className="mt-3 text-xs text-amber-200">This browser doesn&apos;t support push notifications.</p>
        ) : pushState === "denied" ? (
          <p className="mt-3 text-xs text-amber-200">
            Notifications are blocked for this site — enable them in your browser&apos;s site
            settings, then come back.
          </p>
        ) : (
          <button
            onClick={togglePush}
            disabled={busy}
            className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              pushState === "subscribed"
                ? "border border-line text-muted hover:border-rose-400 hover:text-rose-300"
                : "bg-accent text-white hover:bg-accent-soft"
            }`}
          >
            {busy ? "One sec…" : pushState === "subscribed" ? "✓ Enabled on this device — turn off" : "Enable on this device"}
          </button>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Either way, everything also lands in the 🔔 bell inside the app.
        </p>
      </section>

      <section className="rounded-2xl border border-accent/30 bg-accent/[0.07] p-5">
        <h2 className="text-sm font-semibold">📱 Get alerts on your phone</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-foreground"> iPhone / iPad</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
              <li>
                Open <span className="text-foreground">stockcoach.vercel.app</span> in{" "}
                <strong>Safari</strong> on your phone
              </li>
              <li>
                Tap the Share button <span className="text-foreground">⎋</span> →{" "}
                <strong>Add to Home Screen</strong>
              </li>
              <li>Open StockCoach from the new home-screen icon and sign in</li>
              <li>
                Come back to this page and tap <strong>Enable on this device</strong>
              </li>
            </ol>
            <p className="mt-1.5 text-[11px] text-muted/80">
              (Apple only allows web notifications for apps on the home screen — that&apos;s why
              the extra step.)
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">🤖 Android</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
              <li>
                Open <span className="text-foreground">stockcoach.vercel.app</span> in Chrome and
                sign in
              </li>
              <li>
                Tap <strong>Enable on this device</strong> above and allow notifications
              </li>
              <li>
                Optional: menu ⋮ → <strong>Add to Home screen</strong> for a real app icon
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Automatic alerts</h2>
        <div className="mt-3 space-y-3">
          <PrefToggle
            label="Big day moves"
            desc={
              <span>
                A stock you own or watch moves ±
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={prefs.day_move_pct}
                  onChange={(e) => savePrefs({ ...prefs, day_move_pct: Number(e.target.value) || 5 })}
                  className="mx-1 w-12 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-center text-xs text-foreground outline-none focus:border-accent"
                />
                % in a day.
              </span>
            }
            checked={prefs.day_move}
            onChange={(v) => savePrefs({ ...prefs, day_move: v })}
          />
          <PrefToggle
            label="Signal flips"
            desc="The long-term chart signal on one of your stocks changes direction (buy→sell or sell→buy)."
            checked={prefs.signal_flip}
            onChange={(v) => savePrefs({ ...prefs, signal_flip: v })}
          />
          <PrefToggle
            label="Market-open briefing"
            desc="One notification each trading morning with your portfolio and today's strongest signals."
            checked={prefs.briefing}
            onChange={(v) => savePrefs({ ...prefs, briefing: v })}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Price targets</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Set these from any stock page (the &quot;🎯 Set alert&quot; button). Each fires once,
          then turns itself off.
        </p>
        {rules.length === 0 ? (
          <p className="mt-3 text-xs text-muted">No price targets yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-sm"
              >
                <span>
                  <Link href={`/stock/${r.symbol}`} className="font-semibold text-accent-soft hover:underline">
                    {r.symbol}
                  </Link>{" "}
                  <span className="text-muted">
                    {r.kind === "price_above" ? "rises above" : "drops below"}{" "}
                    <span className="tnum text-foreground">{money(r.threshold)}</span>
                    {!r.active && " · fired ✓"}
                  </span>
                </span>
                <button
                  onClick={() => deleteRule(r.id)}
                  className="rounded px-2 py-1 text-xs text-muted transition hover:text-rose-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PrefToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-accent" : "bg-surface-2 ring-1 ring-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
