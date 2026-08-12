// The signal engine: turns indicators into buy/hold/sell leanings per trading
// style, with plain-English reasons a total beginner can follow.
//
// IMPORTANT: these are educational signals derived from price history only.
// They are not predictions of the future and not financial advice — the UI
// must always say so.

import { rsi, sma } from "./indicators";
import type {
  Candle,
  IndicatorSnapshot,
  Quote,
  SignalReason,
  StyleVerdict,
  TradingStyle,
  VerdictAction,
} from "./types";

function verdictFromScore(score: number): VerdictAction {
  if (score >= 0.2) return "buy";
  if (score <= -0.2) return "sell";
  return "hold";
}

function confidenceFromReasons(
  score: number,
  reasons: SignalReason[]
): "low" | "medium" | "high" {
  const nonNeutral = reasons.filter((r) => r.kind !== "neutral");
  if (nonNeutral.length < 2) return "low";
  const agreeing = nonNeutral.filter((r) =>
    score >= 0 ? r.kind === "bullish" : r.kind === "bearish"
  ).length;
  const agreement = agreeing / nonNeutral.length;
  if (Math.abs(score) >= 0.4 && agreement >= 0.75) return "high";
  if (Math.abs(score) >= 0.2 && agreement >= 0.6) return "medium";
  return "low";
}

function finish(
  style: TradingStyle,
  reasons: SignalReason[],
  quote: Quote
): StyleVerdict {
  const total = reasons.reduce((a, r) => a + r.weight, 0);
  const maxPossible = reasons.reduce((a, r) => a + Math.abs(r.weight), 0) || 1;
  const score = Math.max(-1, Math.min(1, total / maxPossible + total * 0.15));
  const action = verdictFromScore(score);
  const confidence = confidenceFromReasons(score, reasons);

  const styleName =
    style === "day" ? "today" : style === "swing" ? "the next few weeks to months" : "the long run";
  const actionText =
    action === "buy"
      ? `the signals lean positive for ${styleName}`
      : action === "sell"
        ? `the signals lean negative for ${styleName}`
        : `the signals are mixed for ${styleName} — no strong edge either way`;
  const headline = `For ${quote.symbol}, ${actionText} (confidence: ${confidence}).`;

  return { style, action, score, confidence, headline, reasons };
}

// ---------------------------------------------------------------------------
// Long-term investing: trend vs 200-day average, 52-week range, volatility,
// and the consistency of the past year.
// ---------------------------------------------------------------------------
function longTermVerdict(ind: IndicatorSnapshot, quote: Quote): StyleVerdict {
  const reasons: SignalReason[] = [];
  const price = quote.price;

  if (ind.sma200 != null) {
    const above = price > ind.sma200;
    const gapPct = ((price / ind.sma200 - 1) * 100).toFixed(1);
    reasons.push({
      title: above
        ? `Price is above its 200-day average (+${gapPct}%)`
        : `Price is below its 200-day average (${gapPct}%)`,
      detail: above
        ? "The 200-day moving average is the classic long-term health check: it's the average price over roughly the last year. Trading above it means the overall trend has been up — long-term investors generally prefer buying stocks in uptrends."
        : "The 200-day moving average is the average price over roughly the last year. Trading below it means the long-term trend has been down. That doesn't make it a bad company, but history says falling stocks often keep falling before they recover.",
      kind: above ? "bullish" : "bearish",
      term: "moving-average",
      weight: above ? 0.35 : -0.35,
    });
  }

  if (ind.return1yPct != null) {
    const up = ind.return1yPct > 0;
    reasons.push({
      title: `${up ? "Up" : "Down"} ${Math.abs(ind.return1yPct).toFixed(0)}% over the past year`,
      detail: up
        ? "A rising year suggests the business (or at least investor sentiment about it) has been improving. Momentum tends to persist over 6–12 month windows more often than not."
        : "A down year means investors have been losing faith. Sometimes that's an overreaction and a bargain — but more often there's a real reason, so beginners should be cautious about 'catching a falling knife'.",
      kind: up ? "bullish" : "bearish",
      term: "momentum",
      weight: up ? 0.2 : -0.2,
    });
  }

  if (ind.rangePosition52w != null) {
    const pos = ind.rangePosition52w;
    if (pos >= 0.8) {
      reasons.push({
        title: "Near its 52-week high",
        detail:
          "It's trading in the top 20% of its price range from the past year. Counterintuitively, stocks near highs often keep doing well — strength attracts buyers. The risk is paying a 'full' price.",
        kind: "bullish",
        term: "fifty-two-week-range",
        weight: 0.15,
      });
    } else if (pos <= 0.2) {
      reasons.push({
        title: "Near its 52-week low",
        detail:
          "It's trading in the bottom 20% of its price range from the past year. It may look 'cheap', but stocks near lows are usually there for a reason. Long-term investors want evidence things are turning around, not just a low price.",
        kind: "bearish",
        term: "fifty-two-week-range",
        weight: -0.15,
      });
    } else {
      reasons.push({
        title: "In the middle of its 52-week range",
        detail:
          "Not near a high or a low — the market hasn't made up its mind. Neutral for the long-term picture.",
        kind: "neutral",
        term: "fifty-two-week-range",
        weight: 0,
      });
    }
  }

  if (ind.volatilityAnnualPct != null) {
    const vol = ind.volatilityAnnualPct;
    if (vol > 55) {
      reasons.push({
        title: `Very jumpy stock (volatility ≈ ${vol.toFixed(0)}%/yr)`,
        detail:
          "This stock swings a lot. High volatility means bigger possible gains AND bigger possible losses — expect a bumpy ride and only invest money you can leave alone for years.",
        kind: "bearish",
        term: "volatility",
        weight: -0.1,
      });
    } else if (vol < 25) {
      reasons.push({
        title: `Relatively calm stock (volatility ≈ ${vol.toFixed(0)}%/yr)`,
        detail:
          "This stock moves gently compared to most. Lower volatility usually means a steadier, easier-to-hold investment — good for beginners.",
        kind: "bullish",
        term: "volatility",
        weight: 0.1,
      });
    }
  }

  if (ind.sma50 != null && ind.sma200 != null) {
    const golden = ind.sma50 > ind.sma200;
    reasons.push({
      title: golden ? "50-day average above 200-day (uptrend structure)" : "50-day average below 200-day (downtrend structure)",
      detail: golden
        ? "When the recent (50-day) average sits above the long-term (200-day) average, the medium-term trend supports the long-term one. Traders call the moment they cross a 'golden cross'."
        : "When the recent (50-day) average sits below the long-term (200-day) average, the medium-term trend is dragging the long-term one down. Traders call the crossing moment a 'death cross' — dramatic name, but it just means weakness.",
      kind: golden ? "bullish" : "bearish",
      term: "golden-cross",
      weight: golden ? 0.2 : -0.2,
    });
  }

  return finish("long", reasons, quote);
}

// ---------------------------------------------------------------------------
// Swing trading: 20/50-day trend, MACD, RSI extremes, 1–3 month momentum.
// ---------------------------------------------------------------------------
function swingVerdict(ind: IndicatorSnapshot, quote: Quote): StyleVerdict {
  const reasons: SignalReason[] = [];
  const price = quote.price;

  if (ind.sma20 != null && ind.sma50 != null) {
    const up = ind.sma20 > ind.sma50 && price > ind.sma20;
    const down = ind.sma20 < ind.sma50 && price < ind.sma20;
    reasons.push({
      title: up
        ? "Short-term trend is up (price > 20-day > 50-day avg)"
        : down
          ? "Short-term trend is down (price < 20-day < 50-day avg)"
          : "Short-term trend is unclear",
      detail:
        "Swing traders live by the trend over the last 1–3 months. When today's price is above the 20-day average and that's above the 50-day average, buyers are in control — and the reverse means sellers are. A tangle means no clear trend to ride.",
      kind: up ? "bullish" : down ? "bearish" : "neutral",
      term: "moving-average",
      weight: up ? 0.3 : down ? -0.3 : 0,
    });
  }

  if (ind.macd != null) {
    const positive = ind.macd.histogram > 0;
    reasons.push({
      title: positive ? "MACD momentum is positive" : "MACD momentum is negative",
      detail:
        "MACD compares a fast price average to a slow one to measure whether momentum is building or fading. Positive means the stock has been accelerating upward recently; negative means it's been losing steam.",
      kind: positive ? "bullish" : "bearish",
      term: "macd",
      weight: positive ? 0.2 : -0.2,
    });
  }

  if (ind.rsi14 != null) {
    const r = ind.rsi14;
    if (r >= 70) {
      reasons.push({
        title: `RSI is ${r.toFixed(0)} — overbought territory`,
        detail:
          "RSI measures how hard a stock has been bought lately, from 0–100. Above 70 means it's been bought aggressively and may be due for a breather or pullback. Not a sell-everything signal — strong stocks can stay overbought — but a caution flag for new buys.",
        kind: "bearish",
        term: "rsi",
        weight: -0.15,
      });
    } else if (r <= 30) {
      reasons.push({
        title: `RSI is ${r.toFixed(0)} — oversold territory`,
        detail:
          "RSI below 30 means the stock has been sold hard and fast. Oversold stocks often bounce in the short term — swing traders watch these for rebound setups. But oversold can stay oversold if the news is bad.",
        kind: "bullish",
        term: "rsi",
        weight: 0.15,
      });
    } else {
      reasons.push({
        title: `RSI is ${r.toFixed(0)} — normal range`,
        detail:
          "RSI between 30 and 70 is the everyday zone: the stock isn't stretched in either direction.",
        kind: "neutral",
        term: "rsi",
        weight: 0,
      });
    }
  }

  if (ind.return1mPct != null) {
    const up = ind.return1mPct > 0;
    reasons.push({
      title: `${up ? "Up" : "Down"} ${Math.abs(ind.return1mPct).toFixed(1)}% over the past month`,
      detail:
        "Recent momentum matters most for swing trades: a stock already moving your way is easier to ride than one you hope will turn around.",
      kind: up ? "bullish" : "bearish",
      term: "momentum",
      weight: up ? 0.15 : -0.15,
    });
  }

  return finish("swing", reasons, quote);
}

// ---------------------------------------------------------------------------
// Day trading: intraday (15-minute) candles — today's direction, gap, and
// short-window RSI. Always carries an explicit risk warning.
// ---------------------------------------------------------------------------
function dayVerdict(
  ind: IndicatorSnapshot,
  quote: Quote,
  intraday: Candle[]
): StyleVerdict {
  const reasons: SignalReason[] = [];
  const closes = intraday.map((c) => c.close);

  reasons.push({
    title: "Reality check: day trading is the hardest way to make money",
    detail:
      "Studies of retail day traders consistently find that the large majority lose money over time — you're competing against professionals and algorithms measured in microseconds. Treat any day-trade signal as practice/learning, and never trade money you can't afford to lose.",
    kind: "neutral",
    term: "day-trading-risk",
    weight: 0,
  });

  const up = quote.dayChangePct > 0.15;
  const down = quote.dayChangePct < -0.15;
  reasons.push({
    title: `Today: ${quote.dayChangePct >= 0 ? "+" : ""}${quote.dayChangePct.toFixed(2)}% vs yesterday's close`,
    detail:
      "Day traders usually trade WITH today's direction ('the trend is your friend') rather than betting on a reversal. A flat day offers little to work with.",
    kind: up ? "bullish" : down ? "bearish" : "neutral",
    term: "day-change",
    weight: up ? 0.25 : down ? -0.25 : 0,
  });

  if (closes.length >= 20) {
    const recent = closes.slice(-16); // last ~4 hours of 15m bars
    const sessionTrendUp = recent[recent.length - 1] > recent[0];
    const movePct = Math.abs(recent[recent.length - 1] / recent[0] - 1) * 100;
    if (movePct > 0.2) {
      reasons.push({
        title: sessionTrendUp
          ? "Intraday momentum points up over the last few hours"
          : "Intraday momentum points down over the last few hours",
        detail:
          "Looking at 15-minute price bars, the most recent stretch of trading has a clear direction. Day traders ride these short bursts — and exit fast when they stall.",
        kind: sessionTrendUp ? "bullish" : "bearish",
        term: "momentum",
        weight: sessionTrendUp ? 0.2 : -0.2,
      });
    }

    const shortRsi = rsi(closes, 14);
    if (shortRsi != null) {
      if (shortRsi >= 75) {
        reasons.push({
          title: `Intraday RSI is ${shortRsi.toFixed(0)} — stretched`,
          detail:
            "On short timeframes, an RSI this high means the recent buying burst may be exhausted. Chasing a stock after a big run often means buying someone else's exit.",
          kind: "bearish",
          term: "rsi",
          weight: -0.15,
        });
      } else if (shortRsi <= 25) {
        reasons.push({
          title: `Intraday RSI is ${shortRsi.toFixed(0)} — washed out`,
          detail:
            "A very low short-term RSI means intense recent selling; bounces are common (but not guaranteed) from these levels.",
          kind: "bullish",
          term: "rsi",
          weight: 0.15,
        });
      }
    }

    const sma20i = sma(closes, 20);
    if (sma20i != null) {
      const above = quote.price > sma20i;
      reasons.push({
        title: above
          ? "Price is above its intraday average"
          : "Price is below its intraday average",
        detail:
          "Comparing the live price to its average over the last ~5 hours is a quick way to see who's winning right now: buyers (above) or sellers (below).",
        kind: above ? "bullish" : "bearish",
        term: "moving-average",
        weight: above ? 0.1 : -0.1,
      });
    }
  }

  if (ind.volatilityAnnualPct != null && ind.volatilityAnnualPct > 60) {
    reasons.push({
      title: "This stock moves violently — position size carefully",
      detail:
        "High-volatility stocks can move several percent in minutes. Day traders control this risk by trading smaller amounts, not by being braver.",
      kind: "neutral",
      term: "volatility",
      weight: 0,
    });
  }

  return finish("day", reasons, quote);
}

export function buildVerdicts(
  ind: IndicatorSnapshot,
  quote: Quote,
  intraday: Candle[]
): StyleVerdict[] {
  return [
    dayVerdict(ind, quote, intraday),
    swingVerdict(ind, quote),
    longTermVerdict(ind, quote),
  ];
}

/** Plain-English explanation of why the stock moved today, from price action. */
export function explainDayMove(quote: Quote, ind: IndicatorSnapshot): string {
  const pct = quote.dayChangePct;
  const dir = pct >= 0 ? "up" : "down";
  const size =
    Math.abs(pct) < 0.5
      ? "barely moved"
      : Math.abs(pct) < 1.5
        ? `is ${dir} a modest ${Math.abs(pct).toFixed(1)}%`
        : Math.abs(pct) < 4
          ? `is ${dir} a notable ${Math.abs(pct).toFixed(1)}%`
          : `is ${dir} a big ${Math.abs(pct).toFixed(1)}%`;

  let context = "";
  if (Math.abs(pct) < 0.5) {
    context =
      "Small daily wiggles like this are normal market noise — millions of buy and sell orders roughly balancing out. It usually means nothing changed about the company today.";
  } else if (Math.abs(pct) >= 4) {
    context =
      pct > 0
        ? "Moves this big almost always have a specific cause: strong earnings, an analyst upgrade, a new product, or industry-wide news. Check today's headlines for this company before assuming the jump will stick."
        : "Drops this big almost always have a specific cause: disappointing earnings, bad news, a downgrade, or sector-wide selling. Check today's headlines — the 'why' matters more than the number.";
  } else {
    context =
      pct > 0
        ? "A move like this can come from mildly good news, the overall market rising, or simply more buyers than sellers today. One day says very little about where the stock goes next."
        : "A dip like this can come from mildly bad news, the overall market falling, or simply more sellers than buyers today. For long-term investors, single-day dips are usually noise.";
  }

  let trend = "";
  if (ind.sma200 != null) {
    trend =
      quote.price > ind.sma200
        ? " Zooming out: the stock is still above its long-term (200-day) average, so the bigger uptrend is intact despite daily wiggles."
        : " Zooming out: the stock is below its long-term (200-day) average, so today's move happened inside a broader downtrend — worth more caution.";
  }

  return `${quote.symbol} ${size} today. ${context}${trend}`;
}
