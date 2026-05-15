import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";
import { subscribeSharedThread } from "@/lib/sharedThreadStore";
import { getWatchHistoryVersion } from "@/lib/watchHistoryStore";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import {
  buildWatchTimelinePayload,
  type PublicWatchTimelinePayload,
} from "@/lib/watch/publicTimelinePayload";
import { createWatchTimelineSseStream, WATCH_TIMELINE_SSE_HEADERS } from "@/lib/watch/sseBroker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_STREAM_WINDOW_MINUTES = 60;
const MAX_STREAM_WINDOW_MINUTES = 720;
const DEFAULT_STREAM_LIMIT = 100;
const MAX_STREAM_LIMIT = 100;
const STREAM_RATE_LIMIT = { max: 20, windowMs: 60_000 };

function canReadDebugStream(request: Request) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

function numberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function streamNumberParam(value: string | null, fallback: number, max: number) {
  return Math.min(Math.max(numberParam(value, fallback), 1), max);
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function hashedRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function canOpenPublicStream(request: Request) {
  const ipHash = hashedRateLimitKey(getClientIp(request));
  return await checkRateLimit(`watch-stream:ip:${ipHash}`, STREAM_RATE_LIMIT);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "thread") {
    if (!canReadDebugStream(request)) {
      return Response.json({ error: "debug stream unavailable" }, { status: 403 });
    }

    const symbol = url.searchParams.get("symbol") ?? "BTC";
    const stream = subscribeSharedThread(symbol);

    return new Response(stream, {
      headers: WATCH_TIMELINE_SSE_HEADERS,
    });
  }

  const limit = streamNumberParam(
    url.searchParams.get("limit"),
    DEFAULT_STREAM_LIMIT,
    MAX_STREAM_LIMIT,
  );
  const windowMinutes = streamNumberParam(
    url.searchParams.get("windowMinutes"),
    DEFAULT_STREAM_WINDOW_MINUTES,
    MAX_STREAM_WINDOW_MINUTES,
  );
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const rateLimit = await canOpenPublicStream(request);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const stream = createWatchTimelineSseStream({
    locale,
    windowMinutes,
    limit,
    readVersion: getWatchHistoryVersion,
    async loadPayload(): Promise<PublicWatchTimelinePayload> {
      return (await buildWatchTimelinePayload({
        mode: "public",
        locale,
        before: Date.now(),
        limit,
        windowMinutes,
      })) as PublicWatchTimelinePayload;
    },
  });

  return new Response(stream, {
    headers: WATCH_TIMELINE_SSE_HEADERS,
  });
}
