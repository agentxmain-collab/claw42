import { NextResponse, type NextRequest } from "next/server";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import {
  buildDecisionRecordIndex,
  filterPublicTimelineEvents,
} from "@/lib/watch/publicTimelineProjection";
import { rateLimit } from "@/lib/rateLimit";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-history:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const beforeParam = url.searchParams.get("before");
  const limitParam = url.searchParams.get("limit");
  const mode = url.searchParams.get("mode") === "debug" ? "debug" : "public";
  if (
    mode === "debug" &&
    (process.env.NODE_ENV === "production" || request.headers.get("x-claw42-debug") !== "1")
  ) {
    return NextResponse.json({ error: "debug mode unavailable" }, { status: 403 });
  }
  const before = beforeParam ? Number(beforeParam) : Date.now();
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 30;

  if (!Number.isFinite(before) || !Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const result = await getWatchHistory({ before, limit, locale });
  if (mode === "debug") {
    return NextResponse.json(
      { ...result, locale },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const events = filterPublicTimelineEvents(result.entries, {
    mode: "public",
    importanceThreshold: "high",
    locale,
    decisionRecordsById: buildDecisionRecordIndex(await readAllDecisionRecords(500, locale)),
  });

  return NextResponse.json(
    {
      oldestTs: result.oldestTs,
      hasMore: result.hasMore,
      locale,
      events,
    },
    {
      headers: PUBLIC_CACHE_HEADERS,
    },
  );
}
