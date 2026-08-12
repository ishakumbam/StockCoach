# StockCoach 📈

A beginner-friendly stock portfolio tracker that explains everything in plain
English. Track stocks you own (or want to own), get buy/hold/sell signal
leanings for **day trading**, **swing trading**, and **long-term investing** —
and learn what every term means along the way.

> **Educational tool — not financial advice.** Signals are computed from past
> price data only. No tool can reliably predict stock prices.

## Features

- **Portfolio tracking** — add stocks manually (with shares + price paid) or
  import a CSV exported from Schwab, Fidelity, Robinhood, and most brokerages.
  Column layout is auto-detected.
- **Watchlist** — follow stocks you don't own yet ("paper watching") with zero risk.
- **Signals per trading style** — the same stock gets a separate verdict for
  day / swing / long-term, each with expandable plain-English reasons
  (moving averages, RSI, MACD, momentum, volatility, 52-week range).
- **"What's happening today?"** — a plain-English explanation of the day's move,
  with a link to headlines when the move is big enough to have a story behind it.
- **Learn page** — a 5-lesson intro for people who know absolutely nothing about
  stocks, plus a full glossary. Every underlined term in the app has a tooltip.
- **Beginner guardrails** — concentration warnings (>20% in one stock),
  a day-trading reality check, and confidence labels on every signal.
- **Privacy by default** — your portfolio lives in your browser's localStorage.
  No accounts, no database, nothing uploaded. CSV files are parsed client-side.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- Market data: Yahoo Finance public endpoints (unofficial; server-side with
  cookie/crumb session, request batching, and a 60s in-memory cache)
- Dependency-free SVG charts

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Project layout

```
src/
  app/
    page.tsx               Dashboard (portfolio, watchlist, add/import)
    stock/[symbol]/        Stock detail: chart, verdicts, indicators
    learn/                 Beginner lessons + glossary
    api/quote/             Batch quotes for the dashboard
    api/analysis/          Full analysis (candles, indicators, verdicts)
    api/search/            Ticker autocomplete
  lib/
    yahoo.ts       Yahoo fetchers (session, cache, batching) — server only
    indicators.ts  SMA/EMA/RSI/MACD/volatility (pure)
    signals.ts     Style verdicts + day-move explainer (pure)
    csv.ts         Brokerage CSV parsing (pure, runs in browser)
    education.ts   Glossary
    usePortfolio.ts  localStorage-backed portfolio state
  components/      Chart, search box, CSV import, badges, tooltips
```

## Known limitations

- Yahoo's endpoints are unofficial and occasionally rate-limit (HTTP 429);
  the app degrades gracefully and retries every minute.
- Quotes may be delayed ~15 minutes depending on the exchange.
- Signals are technical-analysis heuristics for learning — they can't see
  news, earnings, or fundamentals.
