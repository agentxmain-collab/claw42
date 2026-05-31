import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import {
  buildWatchTimelinePayload,
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  type PublicWatchTimelinePayload,
} from "@/lib/watch/publicTimelinePayload";
import {
  createEmptyPublicTimelineSnapshot,
  readPublicTimelineSnapshot,
} from "@/lib/watch/publicTimelineSnapshotStore";
import {
  buildPublicTimelineSnapshotFromPayload,
  publishPublicTimelineSnapshot,
} from "@/lib/watch/publicTimelineSnapshotProducer";
import { getDecisionRecordStoreDiagnostics } from "@/lib/team/decisionRecordStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PUBLIC_TIMELINE_PAGE_SIZE = 15;
const PUBLIC_TIMELINE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function numberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strictNumberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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
    MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  );
  const limit = Math.min(Math.max(numberParam(url.searchParams.get("limit"), 30), 1), 100);
  const page = Math.max(Math.floor(numberParam(url.searchParams.get("page"), 1)), 1);
  const pageSize =
    mode === "public"
      ? PUBLIC_TIMELINE_PAGE_SIZE
      : Math.min(
          Math.max(Math.floor(numberParam(url.searchParams.get("pageSize"), limit)), 1),
          100,
        );
  const before = strictNumberParam(url.searchParams.get("before"), Date.now());
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? strictNumberParam(sinceParam, 0) : undefined;

  if (!Number.isFinite(before) || (since !== undefined && !Number.isFinite(since))) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const includeStorageDiagnostics = url.searchParams.get("diagnostics") === "storage";
  if (includeStorageDiagnostics && !canReadDebug(request)) {
    return NextResponse.json({ error: "debug mode unavailable" }, { status: 403 });
  }

  if (mode === "public" && !includeStorageDiagnostics) {
    const now = Date.now();
    let readResult;
    try {
      readResult = await readPublicTimelineSnapshot({
        locale,
        windowMinutes,
        page,
        pageSize,
        now,
      });
    } catch (error) {
      readResult = {
        source: "empty" as const,
        storageError: true,
        payload: createEmptyPublicTimelineSnapshot({
          locale,
          windowMinutes,
          page,
          pageSize,
          now,
          status: "degraded",
          sourceHealth: {
            state: "degraded",
            reason: "snapshot_storage_error",
            error: error instanceof Error ? error.message : String(error),
            storageError: true,
          },
        }),
      };
    }

    if (readResult.source === "empty" && !readResult.storageError) {
      try {
        const sourcePayload = (await buildWatchTimelinePayload({
          mode: "public",
          locale,
          before: now,
          limit: pageSize,
          page,
          pageSize,
          windowMinutes,
          servedAt: now,
        })) as PublicWatchTimelinePayload;
        const snapshot = buildPublicTimelineSnapshotFromPayload(sourcePayload, {
          now,
          status: sourcePayload.events.length > 0 ? "fresh" : "empty",
          sourceHealth: {
            state: "fallback-build",
            reason: readResult.missReason ?? "snapshot_missing",
            generatedFrom: "timeline-route-fallback",
          },
        });
        await publishPublicTimelineSnapshot(snapshot);
        return NextResponse.json(snapshot, { headers: PUBLIC_TIMELINE_CACHE_HEADERS });
      } catch (error) {
        return NextResponse.json(
          {
            ...readResult.payload,
            snapshotStatus: "degraded",
            sourceHealth: {
              ...readResult.payload.sourceHealth,
              state: "degraded",
              reason: "snapshot_fallback_failed",
              error: error instanceof Error ? error.message : String(error),
            },
          },
          { headers: PUBLIC_TIMELINE_CACHE_HEADERS },
        );
      }
    }

    return NextResponse.json(readResult.payload, { headers: PUBLIC_TIMELINE_CACHE_HEADERS });
  }

  const payload = await buildWatchTimelinePayload({
    mode,
    locale,
    before,
    since,
    limit: mode === "public" ? pageSize : limit,
    page,
    pageSize,
    windowMinutes,
  });
  const body = includeStorageDiagnostics
    ? {
        ...payload,
        decisionRecordDiagnostics: await getDecisionRecordStoreDiagnostics({
          locale,
          limit: 20,
        }).catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        })),
      }
    : payload;

  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}
