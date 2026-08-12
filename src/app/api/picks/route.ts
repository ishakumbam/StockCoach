import { NextResponse } from "next/server";
import { getDailyPicks } from "@/lib/picks";

export const runtime = "nodejs";
export const maxDuration = 120; // first scan of the day fans out ~40 symbols

export async function GET() {
  try {
    const picks = await getDailyPicks();
    return NextResponse.json(picks);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't build today's picks: ${message}` }, { status: 502 });
  }
}
