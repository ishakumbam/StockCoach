import { NextRequest, NextResponse } from "next/server";
import { computeIndicators } from "@/lib/indicators";
import { buildVerdicts, explainDayMove } from "@/lib/signals";
import { getChart } from "@/lib/marketdata";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "Pass ?symbol=AAPL" }, { status: 400 });
  }

  try {
    const [dailyData, intradayData] = await Promise.all([
      getChart(symbol, "1y", "1d"),
      getChart(symbol, "5d", "15m").catch(() => null), // some tickers lack intraday
    ]);

    const quote = dailyData.quote;
    const daily = dailyData.candles;
    const intraday = intradayData?.candles ?? [];
    const indicators = computeIndicators(daily);
    const verdicts = buildVerdicts(indicators, quote, intraday);

    const analysis: Analysis = {
      quote,
      daily,
      intraday,
      verdicts,
      dayMoveExplanation: explainDayMove(quote, indicators),
      indicators,
    };
    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Couldn't load data for ${symbol}: ${message}` },
      { status: 502 }
    );
  }
}
