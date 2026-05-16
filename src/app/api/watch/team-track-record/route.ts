import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { fetchTeamTrackRecord } from "@/lib/team/memoryLoopEvidence";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-team-track-record:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const payload = await fetchTeamTrackRecord(locale);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
