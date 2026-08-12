import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/marketdata";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  try {
    const results = await searchSymbols(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Search is unavailable right now." });
  }
}
