import { NextResponse } from "next/server";
import { getSocialBuzz } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const buzz = await getSocialBuzz();
  return NextResponse.json(buzz);
}
