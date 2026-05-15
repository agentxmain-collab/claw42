import { NextResponse } from "next/server";
import { readDecisionRecords } from "@/lib/team/decisionRecordStore";
import { rateLimit } from "@/lib/rateLimit";
import { getStagingDecisionHistoryPayload } from "@/lib/watch/__fixtures__/stagingDecisionHistory";
import {
  buildDecisionHistoryPayload,
  normalizeDecisionHistorySymbol,
} from "@/lib/watch/decisionHistory";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { shouldUseStagingMockTimeline } from "@/lib/watch/__fixtures__/stagingMockTimeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const RECORD_READ_LIMIT = 500;

function numberParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-decision-history:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const symbol = normalizeDecisionHistorySymbol(url.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }

  const limit = Math.min(
    Math.max(numberParam(url.searchParams.get("limit"), DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );
  const before = url.searchParams.get("before");
  if (before && Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: "invalid_before" }, { status: 400 });
  }

  const payload = shouldUseStagingMockTimeline()
    ? getStagingDecisionHistoryPayload({ symbol, locale, limit, before })
    : buildDecisionHistoryPayload({
        symbol,
        locale,
        records: await readDecisionRecords(symbol, RECORD_READ_LIMIT, locale),
        limit,
        before,
      });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
