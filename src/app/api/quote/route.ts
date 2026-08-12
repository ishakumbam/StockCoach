import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/marketdata";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Pass ?symbols=AAPL,MSFT" }, { status: 400 });
  }

  const quotes = await getQuotes(symbols);
  const failed = symbols.filter((s) => !quotes[s]);
  return NextResponse.json({ quotes, failed });
}
