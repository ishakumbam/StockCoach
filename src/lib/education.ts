// The beginner education layer: a glossary keyed by term id, used for inline
// "what does this mean?" tooltips and the Learn page.

export interface GlossaryEntry {
  term: string;
  short: string; // one-liner for tooltips
  long: string; // fuller explanation for the Learn page
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  stock: {
    term: "Stock",
    short: "A tiny ownership slice of a real company.",
    long: "When you buy a stock (also called a 'share'), you own a small piece of that company. If the company becomes more valuable, your slice does too. If it struggles, your slice is worth less. Stock prices move constantly because millions of people are continuously negotiating what those slices are worth.",
  },
  "share-price": {
    term: "Share price",
    short: "What one slice of the company costs right now.",
    long: "The share price is simply the last price at which someone bought and someone sold one share. A 'high' price doesn't mean expensive and a 'low' price doesn't mean cheap — a $900 stock can be a better deal than a $5 one. What matters is the company's total value and where it's headed.",
  },
  portfolio: {
    term: "Portfolio",
    short: "The collection of all investments you own.",
    long: "Your portfolio is everything you hold: all your stocks (and funds, bonds, cash). Investors think in portfolios rather than single stocks because a mix of investments smooths out the wild swings of any single company.",
  },
  diversification: {
    term: "Diversification",
    short: "Don't put all your eggs in one basket.",
    long: "Diversification means spreading your money across many companies and industries so no single disaster can sink you. If one stock is more than about 20% of your portfolio, a bad week for that one company becomes a bad week for your whole financial life.",
  },
  "moving-average": {
    term: "Moving average",
    short: "The stock's average price over the last N days — smooths out the noise.",
    long: "A 50-day moving average is the average closing price over the last 50 trading days. Because it smooths daily noise, comparing today's price to a moving average is the simplest way to see the real trend: price above the average = uptrend, below = downtrend. The 200-day version is the classic long-term health check.",
  },
  rsi: {
    term: "RSI (Relative Strength Index)",
    short: "A 0–100 gauge of how hard a stock was recently bought or sold.",
    long: "RSI compresses the last 14 periods of gains vs losses into a number from 0 to 100. Above 70 means the stock has been bought aggressively ('overbought' — may be due for a pause). Below 30 means it's been sold hard ('oversold' — bounces are common). In between is normal. It's a thermometer, not a crystal ball.",
  },
  macd: {
    term: "MACD",
    short: "A momentum gauge: is the price movement speeding up or slowing down?",
    long: "MACD (Moving Average Convergence Divergence) subtracts a slow moving average from a fast one. When the result is rising/positive, upward momentum is building; when falling/negative, momentum is fading. Traders use it to catch trend changes a bit earlier than price alone shows.",
  },
  volatility: {
    term: "Volatility",
    short: "How violently a stock's price swings around.",
    long: "Volatility measures the size of a stock's typical moves. A 20%-a-year volatility stock drifts; an 80% one lurches. Higher volatility = higher possible reward AND higher possible pain. Beginners overestimate how much volatility they can stomach — a 30% drop feels very different with real money.",
  },
  momentum: {
    term: "Momentum",
    short: "The tendency of moving stocks to keep moving the same way.",
    long: "One of the most studied effects in markets: stocks that performed well over the past months tend (on average, not always) to keep performing well over the next few, and vice versa. It's why traders prefer riding trends over fighting them.",
  },
  "fifty-two-week-range": {
    term: "52-week range",
    short: "The lowest and highest prices over the past year.",
    long: "Where a stock sits between its 1-year low and high tells you the market's recent verdict. Near the high = strength (but a fuller price). Near the low = weakness (looks 'cheap', but usually for a reason). Beginners often buy near lows expecting a rebound — the data says strength more often follows strength.",
  },
  "golden-cross": {
    term: "Golden cross / death cross",
    short: "When the 50-day average crosses the 200-day — a famous trend-change signal.",
    long: "A 'golden cross' is the 50-day moving average rising above the 200-day (medium-term strength overtaking long-term) — historically a mildly bullish sign. A 'death cross' is the opposite. Dramatic names, modest signals: they confirm trends more than predict them.",
  },
  "cost-basis": {
    term: "Cost basis",
    short: "The average price you paid per share.",
    long: "Your cost basis is what you paid, on average, for each share you own. Profit or loss = (current price − cost basis) × shares. It matters for taxes too: you're taxed on gains when you sell, and long-held gains (>1 year in the US) are usually taxed less.",
  },
  "day-change": {
    term: "Day change",
    short: "How much the price moved vs yesterday's closing price.",
    long: "The daily change compares the current price to yesterday's close. Most days it's noise. Rule of thumb: under ±1% means basically nothing happened; ±2–4% means something mildly interesting; beyond ±5% almost always has a news story behind it.",
  },
  "day-trading-risk": {
    term: "Day trading risk",
    short: "Most people who day trade lose money. Seriously.",
    long: "Academic studies across multiple countries consistently find that a large majority of retail day traders lose money, and only a tiny percent stay profitable over years. You're competing with professional firms whose computers react in microseconds. If you want to try it, treat it like an expensive hobby with money you can afford to lose — not a way to grow savings.",
  },
  "market-hours": {
    term: "Market hours",
    short: "US stocks trade 9:30am–4:00pm Eastern, Monday–Friday.",
    long: "Regular US trading runs 9:30am–4:00pm ET. Outside those hours prices barely move (limited 'pre-market' and 'after-hours' trading exists but is thin and jumpy). If your dashboard looks frozen at night or on weekends, that's why — the market is closed.",
  },
  etf: {
    term: "ETF (Exchange-Traded Fund)",
    short: "A single ticker that holds hundreds of stocks — instant diversification.",
    long: "An ETF is a basket of many stocks that trades like a single stock. For example, an S&P 500 ETF holds ~500 large US companies at once. For beginners, broad ETFs are the standard 'default' recommendation from most financial educators because one purchase spreads your risk across the whole market.",
  },
  "watch-list": {
    term: "Watchlist",
    short: "Stocks you don't own yet but are keeping an eye on.",
    long: "A watchlist lets you follow stocks you're curious about without spending money. It's the best way to learn: watch how a stock reacts to news and market swings for a few weeks before risking real dollars.",
  },
};

export function glossaryEntry(key: string | undefined): GlossaryEntry | null {
  if (!key) return null;
  return GLOSSARY[key] ?? null;
}
