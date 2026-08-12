import Link from "next/link";
import { GLOSSARY } from "@/lib/education";
import { TRADING_STYLES } from "@/lib/types";

export const metadata = { title: "Learn the basics — StockCoach" };

const LESSONS: { title: string; emoji: string; body: string[] }[] = [
  {
    title: "What even is a stock?",
    emoji: "🏢",
    body: [
      "A stock is a tiny ownership slice of a real company. Buy one share of Apple and you literally own a (very small) piece of Apple — its stores, its iPhones, its profits.",
      "Companies sell shares to raise money to grow. Investors buy them hoping the company becomes more valuable over time, which makes each slice worth more.",
      "The price you see isn't set by anyone — it's simply the last price where a buyer and a seller agreed to trade. It moves constantly because millions of people keep re-negotiating.",
    ],
  },
  {
    title: "Why do prices go up and down?",
    emoji: "🎢",
    body: [
      "Short version: more buyers than sellers → price rises. More sellers than buyers → price falls.",
      "What tips that balance? News (earnings, products, scandals), the overall economy (interest rates, inflation), industry trends, and plain human emotion — fear and greed.",
      "Crucial beginner insight: on most days, a stock's move means nothing. Under ±1% is noise. A move beyond ±5% almost always has a news story behind it — StockCoach links you to the headlines when that happens.",
    ],
  },
  {
    title: "The three ways people trade",
    emoji: "⏱️",
    body: [
      "Day trading: buy and sell within hours. It's the style you see in movies — and the one where studies show most beginners lose money. You're competing with professional algorithms.",
      "Swing trading: hold for weeks to months, trying to ride medium-term trends. Requires checking in regularly and having a plan for when you're wrong.",
      "Long-term investing: buy quality and hold for years. Boring, and historically the most reliable wealth-builder for regular people. If you're brand new, this is the style to learn first.",
      "StockCoach shows a separate signal for each style, because the same stock can be a terrible day trade and a great 10-year hold at the same time.",
    ],
  },
  {
    title: "How to not blow up: the golden rules",
    emoji: "🛡️",
    body: [
      "Only invest money you won't need for years. If you might need it for rent, it doesn't belong in stocks.",
      "Diversify. No single stock should dominate your portfolio — the dashboard warns you when one passes 20%.",
      "For most beginners, a broad index fund (like an S&P 500 ETF) beats stock-picking. One ticker, ~500 companies, instant diversification.",
      "Time in the market beats timing the market. Missing just the 10 best days of a decade historically cuts returns roughly in half — and those days are unpredictable.",
      "Never trade on emotion or hype. If your only reason to buy is 'it's going up' or someone on social media said so, that's gambling, not investing.",
    ],
  },
  {
    title: "How StockCoach's signals work (and their limits)",
    emoji: "🔍",
    body: [
      "Our signals come from technical analysis: patterns in past prices, like moving averages, RSI, and momentum. Each signal card explains in plain English what we saw and why traders care.",
      "What signals CAN do: describe the trend, spot when a stock is stretched or washed out, and teach you the vocabulary traders use.",
      "What signals CANNOT do: see the future. They don't know about tomorrow's earnings report, a CEO resignation, or a war. Nobody — human or algorithm — reliably predicts short-term stock prices. Anyone who claims otherwise is selling something.",
      "That's why every verdict comes with a confidence level and its full reasoning — so you learn to think, not just follow.",
    ],
  },
];

export default function LearnPage() {
  return (
    <div className="space-y-10 fade-up">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Stocks, from absolute zero</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Five short lessons that cover everything StockCoach shows you. No jargon without an
          explanation, no assumptions. Read them in order — about five minutes total.
        </p>
      </section>

      <section className="space-y-6">
        {LESSONS.map((lesson, i) => (
          <article key={i} className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold">
              <span className="mr-2">{lesson.emoji}</span>
              Lesson {i + 1}: {lesson.title}
            </h2>
            <div className="mt-3 space-y-3">
              {lesson.body.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Trading styles at a glance</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {TRADING_STYLES.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-accent-soft">Typical horizon: {s.horizon}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{s.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Glossary</h2>
        <p className="mt-1 text-sm text-muted">
          Every dotted-underlined term you&apos;ll see around the app, explained properly.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(GLOSSARY).map(([key, entry]) => (
            <div key={key} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-accent-soft">{entry.term}</p>
              <p className="mt-1 text-xs italic text-muted">{entry.short}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{entry.long}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
        <p className="text-sm font-medium">Ready to practice — without risking a cent?</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
          Add a few stocks to your watchlist and follow their signals for a couple of weeks. It&apos;s
          the safest way to build intuition.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-soft"
        >
          Go to my dashboard →
        </Link>
      </section>
    </div>
  );
}
