import { NextResponse } from "next/server";
import { runAlertSweep } from "@/lib/alert-checker";

export const runtime = "nodejs";
export const maxDuration = 120;

// Safe to expose publicly: the sweep self-throttles (5 min, DB-backed), only
// reads public market data, and only writes notifications derived from each
// user's own rules.
export async function GET() {
  const result = await runAlertSweep();
  return NextResponse.json(result);
}
