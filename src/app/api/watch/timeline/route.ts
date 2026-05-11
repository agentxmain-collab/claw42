import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import { filterPublicTimelineEvents } from "@/lib/watch/publicTimelineProjection";
import { getNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_EVIDENCE_MAP_ITEMS = 120;

function numberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function canReadDebug(request: NextRequest) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-timeline:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const mode = url.searchParams.get("mode") === "debug" ? "debug" : "public";
  if (mode === "debug" && !canReadDebug(request)) {
    return NextResponse.json({ error: "debug mode unavailable" }, { status: 403 });
  }

  const windowMinutes = Math.min(
    Math.max(numberParam(url.searchParams.get("windowMinutes"), 60), 1),
    720,
  );
  const limit = Math.min(Math.max(numberParam(url.searchParams.get("limit"), 30), 1), 100);
  const before = numberParam(url.searchParams.get("before"), Date.now());
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? numberParam(sinceParam, 0) : undefined;

  if (!Number.isFinite(before) || (since !== undefined && !Number.isFinite(since))) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const servedAt = Date.now();
  const result = await getWatchHistory({ before, since, limit, windowMinutes, locale });
  if (mode === "debug") {
    return NextResponse.json(
      {
        entries: result.entries,
        oldestTs: result.oldestTs,
        hasMore: result.hasMore,
        windowMinutes,
        locale,
        servedAt,
        nextPollMs: 30_000,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const events = filterPublicTimelineEvents(result.entries, {
    mode: "public",
    importanceThreshold: "high",
    locale,
  });
  const evidenceIds = Array.from(new Set(events.flatMap((event) => event.evidenceIds))).slice(
    0,
    MAX_EVIDENCE_MAP_ITEMS,
  );
  const evidencePairs = await Promise.all(
    evidenceIds.map(async (evidenceId) => [evidenceId, await getNewsEvidence(evidenceId)] as const),
  );
  const evidenceMap = Object.fromEntries(
    evidencePairs.flatMap(([evidenceId, evidence]) => (evidence ? [[evidenceId, evidence]] : [])),
  );
  return NextResponse.json(
    {
      events,
      evidenceMap,
      oldestTs:
        events.length > 0 ? (events[events.length - 1]?.ts ?? result.oldestTs) : result.oldestTs,
      hasMore: result.hasMore,
      windowMinutes,
      locale,
      servedAt,
      nextPollMs: servedAt % (3 * 60_000) < 30_000 ? 30_000 : 90_000,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
