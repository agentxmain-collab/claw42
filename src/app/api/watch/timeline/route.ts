import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import {
  buildWatchTimelinePayload,
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
} from "@/lib/watch/publicTimelinePayload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const before = strictNumberParam(url.searchParams.get("before"), Date.now());
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? strictNumberParam(sinceParam, 0) : undefined;

  if (!Number.isFinite(before) || (since !== undefined && !Number.isFinite(since))) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  return NextResponse.json(
    await buildWatchTimelinePayload({
      mode,
      locale,
      before,
      since,
      limit,
      windowMinutes,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
