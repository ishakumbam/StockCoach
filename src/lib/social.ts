// Trader buzz from free public feeds:
//  - StockTwits: trader posts tagged Bullish/Bearish, with follower counts
//  - ApeWisdom: aggregated Reddit ticker mentions (r/wallstreetbets & friends)
//
// These are opinions from social platforms — the UI must present them as
// "what traders are saying", never as advice, and always with attribution.

export interface TraderVoice {
  username: string;
  followers: number;
  platform: "Stocktwits";
  sentiment: "Bullish" | "Bearish";
  body: string;
  url: string;
  createdAt: string;
}

export interface BuzzTicker {
  symbol: string;
  name: string;
  redditRank: number | null;
  redditMentions: number | null;
  redditMentions24hAgo: number | null;
  stWatchers: number | null;
  bullish: number; // counts among recent tagged messages
  bearish: number;
  voices: TraderVoice[];
}

export interface SocialBuzz {
  generatedAt: number;
  tickers: BuzzTicker[];
  sources: string[];
}

const UA = "Mozilla/5.0 (compatible; StockCoach/1.0; educational app)";

let cached: SocialBuzz | null = null;
let cachedAt = 0;
let building: Promise<SocialBuzz> | null = null;
let lastGood: SocialBuzz | null = null;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

interface ApeWisdomResponse {
  results?: {
    rank: number;
    ticker: string;
    name?: string;
    mentions?: number;
    upvotes?: number;
    mentions_24h_ago?: number;
  }[];
}

interface StTrendingResponse {
  symbols?: { symbol: string; title?: string; watchlist_count?: number; exchange?: string }[];
}

interface StStreamResponse {
  messages?: {
    id: number;
    body?: string;
    created_at?: string;
    user?: { username?: string; followers?: number };
    entities?: { sentiment?: { basic?: string } | null };
  }[];
}

const TICKER_RE = /^[A-Z]{1,5}$/;

function cleanBody(body: string): string {
  return body
    .replace(/https?:\/\/\S+/g, "") // strip links
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

async function buzzForSymbol(
  symbol: string,
  meta: { name: string; redditRank: number | null; redditMentions: number | null; redditMentions24hAgo: number | null; stWatchers: number | null }
): Promise<BuzzTicker | null> {
  try {
    const stream = await getJson<StStreamResponse>(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json?limit=30`
    );
    const messages = stream.messages ?? [];
    let bullish = 0;
    let bearish = 0;
    const tagged = messages.filter((m) => {
      const s = m.entities?.sentiment?.basic;
      if (s === "Bullish") bullish++;
      else if (s === "Bearish") bearish++;
      return (s === "Bullish" || s === "Bearish") && (m.body ?? "").trim().length > 25;
    });

    const seen = new Set<string>();
    const voices: TraderVoice[] = tagged
      .sort((a, b) => (b.user?.followers ?? 0) - (a.user?.followers ?? 0))
      .filter((m) => {
        const u = m.user?.username ?? "";
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      })
      .slice(0, 3)
      .map((m) => ({
        username: m.user?.username ?? "trader",
        followers: m.user?.followers ?? 0,
        platform: "Stocktwits" as const,
        sentiment: m.entities!.sentiment!.basic as "Bullish" | "Bearish",
        body: cleanBody(m.body ?? ""),
        url: `https://stocktwits.com/${m.user?.username}/message/${m.id}`,
        createdAt: m.created_at ?? "",
      }));

    return { symbol, ...meta, bullish, bearish, voices };
  } catch {
    // Still worth showing the Reddit stats even without messages.
    if (meta.redditRank != null) {
      return { symbol, ...meta, bullish: 0, bearish: 0, voices: [] };
    }
    return null;
  }
}

async function buildBuzz(): Promise<SocialBuzz> {
  const sources: string[] = [];

  // Reddit mention leaderboard.
  const reddit = new Map<
    string,
    { rank: number; name: string; mentions: number | null; mentions24hAgo: number | null }
  >();
  try {
    const ape = await getJson<ApeWisdomResponse>(
      "https://apewisdom.io/api/v1.0/filter/all-stocks/page/1"
    );
    for (const r of ape.results ?? []) {
      if (TICKER_RE.test(r.ticker)) {
        reddit.set(r.ticker, {
          rank: r.rank,
          name: r.name ?? r.ticker,
          mentions: r.mentions ?? null,
          mentions24hAgo: r.mentions_24h_ago ?? null,
        });
      }
    }
    if (reddit.size > 0) sources.push("Reddit (via ApeWisdom)");
  } catch {
    // reddit source unavailable — continue with StockTwits only
  }

  // StockTwits trending.
  const stTrending = new Map<string, { name: string; watchers: number | null }>();
  try {
    const st = await getJson<StTrendingResponse>(
      "https://api.stocktwits.com/api/2/trending/symbols.json"
    );
    for (const s of st.symbols ?? []) {
      if (TICKER_RE.test(s.symbol)) {
        stTrending.set(s.symbol, { name: s.title ?? s.symbol, watchers: s.watchlist_count ?? null });
      }
    }
    if (stTrending.size > 0) sources.push("Stocktwits");
  } catch {
    // stocktwits trending unavailable
  }

  // Rank candidates: on both lists first, then Reddit rank, then ST watchers.
  const candidates = new Map<string, number>(); // symbol -> score (lower = better)
  for (const [sym, r] of reddit) candidates.set(sym, r.rank + (stTrending.has(sym) ? -50 : 0));
  let i = 0;
  for (const sym of stTrending.keys()) {
    if (!candidates.has(sym)) candidates.set(sym, 100 + i);
    i++;
  }

  const top = [...candidates.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([sym]) => sym);

  const tickers = (
    await Promise.all(
      top.map((sym) =>
        buzzForSymbol(sym, {
          name: reddit.get(sym)?.name ?? stTrending.get(sym)?.name ?? sym,
          redditRank: reddit.get(sym)?.rank ?? null,
          redditMentions: reddit.get(sym)?.mentions ?? null,
          redditMentions24hAgo: reddit.get(sym)?.mentions24hAgo ?? null,
          stWatchers: stTrending.get(sym)?.watchers ?? null,
        })
      )
    )
  ).filter((t): t is BuzzTicker => t != null);

  return { generatedAt: Math.floor(Date.now() / 1000), tickers, sources };
}

/** Social buzz, cached for 15 minutes; serves last-good data on failure. */
export async function getSocialBuzz(): Promise<SocialBuzz> {
  const fresh = cached && Date.now() - cachedAt < 15 * 60 * 1000;
  if (cached && fresh) return cached;
  if (!building) {
    building = buildBuzz()
      .then((b) => {
        if (b.tickers.length > 0) {
          cached = b;
          cachedAt = Date.now();
          lastGood = b;
        }
        return b.tickers.length > 0 ? b : (lastGood ?? b);
      })
      .catch(() => lastGood ?? { generatedAt: Math.floor(Date.now() / 1000), tickers: [], sources: [] })
      .finally(() => {
        building = null;
      });
  }
  return building;
}
