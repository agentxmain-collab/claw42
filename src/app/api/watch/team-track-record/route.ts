import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { fetchTeamTrackRecord } from "@/lib/team/memoryLoopEvidence";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { checkPublicBoardKvBudget } from "@/lib/watch/publicBoardKvBudgetGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
} as const;
const PUBLIC_ALLOWED_QUERY_KEYS = new Set(["locale"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  for (const key of Array.from(url.searchParams.keys())) {
    if (!PUBLIC_ALLOWED_QUERY_KEYS.has(key)) {
      return NextResponse.json({ error: "unsupported_query" }, { status: 400 });
    }
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-team-track-record:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const budget = checkPublicBoardKvBudget({
    route: "team-track-record",
    estimatedCommands: 3,
  });
  if (!budget.allowed) {
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), locale, winrates: [], degraded: true },
      { headers: PUBLIC_CACHE_HEADERS },
    );
  }
  const payload = await fetchTeamTrackRecord(locale);

  return NextResponse.json(payload, {
    headers: PUBLIC_CACHE_HEADERS,
  });
}
