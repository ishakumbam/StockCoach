// The alert sweep: runs every ~10 minutes during market hours (pinged by a
// GitHub Actions schedule), evaluates every user's alert rules against live
// data, and fans out notifications. Throttled via the app_meta table so
// public pings can't make it hammer the data sources.

import { computeIndicators } from "./indicators";
import { getChart, getQuotes } from "./marketdata";
import { adminClient, notify } from "./notify-server";
import { getDailyPicks } from "./picks";
import { buildVerdicts } from "./signals";
import { money, pct } from "./format";

const THROTTLE_MS = 5 * 60 * 1000;
const DEFAULT_DAY_MOVE_PCT = 5;

interface AlertRow {
  id: string;
  user_id: string;
  symbol: string;
  kind: string;
  threshold: number | null;
  active: boolean;
}

interface PortfolioRow {
  user_id: string;
  symbol: string;
  shares: number;
  cost_basis: number | null;
}

interface PrefsRow {
  user_id: string;
  day_move: boolean;
  day_move_pct: number;
  signal_flip: boolean;
  briefing: boolean;
}

function nyNow(): { date: string; minutes: number; weekday: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/** Start of the current NY calendar day, as ISO (for "already notified today"). */
function nyDayStartISO(): string {
  const { date } = nyNow();
  // 04:00 ET ≈ 08:00/09:00 UTC; being generous is fine for dedupe purposes.
  return new Date(`${date}T04:00:00-05:00`).toISOString();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface SweepResult {
  ran: boolean;
  reason?: string;
  notified: number;
  checkedSymbols: number;
}

export async function runAlertSweep(force = false): Promise<SweepResult> {
  const sb = adminClient();
  if (!sb) return { ran: false, reason: "admin client not configured", notified: 0, checkedSymbols: 0 };

  // Cross-instance throttle.
  const { data: meta } = await sb.from("app_meta").select("value").eq("key", "alerts_last_run").maybeSingle();
  const lastRun = meta?.value?.at ? Number(meta.value.at) : 0;
  if (!force && Date.now() - lastRun < THROTTLE_MS) {
    return { ran: false, reason: "throttled", notified: 0, checkedSymbols: 0 };
  }
  await sb.from("app_meta").upsert({ key: "alerts_last_run", value: { at: Date.now() } });

  const [{ data: alerts }, { data: portfolios }, { data: prefs }] = await Promise.all([
    sb.from("alerts").select("id,user_id,symbol,kind,threshold,active").eq("active", true),
    sb.from("portfolios").select("user_id,symbol,shares,cost_basis"),
    sb.from("alert_prefs").select("user_id,day_move,day_move_pct,signal_flip,briefing"),
  ]);

  const alertRows = (alerts ?? []) as AlertRow[];
  const portfolioRows = (portfolios ?? []) as PortfolioRow[];
  const prefsByUser = new Map((prefs ?? []).map((p: PrefsRow) => [p.user_id, p]));
  const prefFor = (userId: string): PrefsRow =>
    prefsByUser.get(userId) ?? {
      user_id: userId,
      day_move: true,
      day_move_pct: DEFAULT_DAY_MOVE_PCT,
      signal_flip: true,
      briefing: true,
    };

  const symbols = [
    ...new Set([...alertRows.map((a) => a.symbol), ...portfolioRows.map((p) => p.symbol)]),
  ].slice(0, 60);
  if (symbols.length === 0) return { ran: true, notified: 0, checkedSymbols: 0 };

  const quotes = await getQuotes(symbols);
  const dayStart = nyDayStartISO();
  let notified = 0;

  // Which (user, kind, symbol) combos already fired today — for dedupe.
  const { data: today } = await sb
    .from("notifications")
    .select("user_id,kind,symbol")
    .gte("created_at", dayStart);
  const firedToday = new Set((today ?? []).map((n) => `${n.user_id}|${n.kind}|${n.symbol ?? ""}`));

  // --- 1) Price targets ---------------------------------------------------
  for (const a of alertRows) {
    if (a.kind !== "price_above" && a.kind !== "price_below") continue;
    const q = quotes[a.symbol];
    if (!q || a.threshold == null) continue;
    const crossed = a.kind === "price_above" ? q.price >= a.threshold : q.price <= a.threshold;
    if (!crossed) continue;
    await notify({
      userId: a.user_id,
      symbol: a.symbol,
      kind: "price_target",
      title: `🎯 ${a.symbol} hit your target`,
      body: `${a.symbol} is at ${money(q.price)} — ${a.kind === "price_above" ? "above" : "below"} your ${money(a.threshold)} alert. (${pct(q.dayChangePct)} today)`,
    });
    await sb.from("alerts").update({ active: false, last_fired_at: new Date().toISOString() }).eq("id", a.id);
    notified++;
  }

  // --- 2) Big day moves (auto, per user prefs) -----------------------------
  const symbolsByUser = new Map<string, PortfolioRow[]>();
  for (const p of portfolioRows) {
    const list = symbolsByUser.get(p.user_id) ?? [];
    list.push(p);
    symbolsByUser.set(p.user_id, list);
  }

  for (const [userId, rows] of symbolsByUser) {
    const pref = prefFor(userId);
    if (!pref.day_move) continue;
    for (const row of rows) {
      const q = quotes[row.symbol];
      if (!q) continue;
      if (Math.abs(q.dayChangePct) < (pref.day_move_pct || DEFAULT_DAY_MOVE_PCT)) continue;
      if (firedToday.has(`${userId}|day_move|${row.symbol}`)) continue;
      const dir = q.dayChangePct > 0 ? "📈 up" : "📉 down";
      const owned = row.shares > 0;
      await notify({
        userId,
        symbol: row.symbol,
        kind: "day_move",
        title: `${row.symbol} is ${dir} ${Math.abs(q.dayChangePct).toFixed(1)}% today`,
        body: owned
          ? `Big move on a stock you own — now ${money(q.price)}. Moves this size usually have a news story behind them; check before reacting.`
          : `Big move on your watchlist — now ${money(q.price)}. Check the headlines before reacting.`,
      });
      notified++;
    }
  }

  // --- 3) Signal flips (long-term style, global state per symbol) ----------
  const flipUsers = new Map<string, string[]>(); // symbol -> userIds who care
  for (const [userId, rows] of symbolsByUser) {
    if (!prefFor(userId).signal_flip) continue;
    for (const row of rows) {
      const list = flipUsers.get(row.symbol) ?? [];
      list.push(userId);
      flipUsers.set(row.symbol, list);
    }
  }

  const { data: states } = await sb.from("signal_state").select("symbol,style,action");
  const stateMap = new Map((states ?? []).map((s) => [`${s.symbol}|${s.style}`, s.action]));

  const flipSymbols = [...flipUsers.keys()].slice(0, 40);
  await mapLimit(flipSymbols, 3, async (symbol) => {
    try {
      const daily = await getChart(symbol, "1y", "1d");
      const indicators = computeIndicators(daily.candles);
      const verdicts = buildVerdicts(indicators, daily.quote, []);
      const action = verdicts.find((v) => v.style === "long")!.action;
      const prev = stateMap.get(`${symbol}|long`);
      await sb.from("signal_state").upsert(
        { symbol, style: "long", action, updated_at: new Date().toISOString() },
        { onConflict: "symbol,style" }
      );
      if (prev && prev !== action) {
        for (const userId of flipUsers.get(symbol) ?? []) {
          if (firedToday.has(`${userId}|signal_flip|${symbol}`)) continue;
          await notify({
            userId,
            symbol,
            kind: "signal_flip",
            title: `🔄 ${symbol} signal flipped: ${prev.toUpperCase()} → ${action.toUpperCase()}`,
            body: `The long-term chart signal for ${symbol} changed. Open the analysis to see which indicators moved — signals are educational, not advice.`,
          });
          notified++;
        }
      }
    } catch {
      // symbol data unavailable this sweep — try again next run
    }
  });

  // --- 4) Market-open briefing ---------------------------------------------
  const { minutes, weekday } = nyNow();
  const marketDay = weekday >= 1 && weekday <= 5;
  if (marketDay && minutes >= 9 * 60 + 30 && minutes < 11 * 60) {
    let picksLine = "";
    try {
      const picks = await getDailyPicks();
      const top = picks.byStyle.long.buys.slice(0, 3).map((p) => p.symbol);
      if (top.length) picksLine = ` Today's strongest long-term signals: ${top.join(", ")}.`;
    } catch {
      // picks unavailable — send briefing without them
    }
    for (const [userId, rows] of symbolsByUser) {
      if (!prefFor(userId).briefing) continue;
      if (firedToday.has(`${userId}|briefing|`)) continue;
      let value = 0;
      let known = 0;
      for (const row of rows) {
        const q = quotes[row.symbol];
        if (q && row.shares > 0) {
          value += q.price * row.shares;
          known++;
        }
      }
      await notify({
        userId,
        symbol: null,
        kind: "briefing",
        title: "🌅 Markets are open",
        body:
          (known > 0
            ? `Your portfolio starts the day around ${money(value)}.`
            : `Your watchlist is ready.`) + picksLine,
      });
      notified++;
    }
  }

  return { ran: true, notified, checkedSymbols: symbols.length };
}
