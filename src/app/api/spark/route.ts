import { NextRequest, NextResponse } from "next/server";
import { getChart } from "@/lib/marketdata";

export const runtime = "nodejs";

// Last ~30 daily closes per symbol, for dashboard sparklines.
export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Pass ?symbols=AAPL,MSFT" }, { status: 400 });
  }

  const sparks: Record<string, number[]> = {};
  await Promise.allSettled(
    symbols.map(async (s) => {
      const { candles } = await getChart(s, "3mo", "1d");
      sparks[s] = candles.slice(-30).map((c) => Number(c.close.toFixed(4)));
    })
  );
  return NextResponse.json({ sparks });
}
