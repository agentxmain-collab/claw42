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
import { checkPublicBoardKvBudget } from "@/lib/watch/publicBoardKvBudgetGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_PUBLIC_PAGE = 2;
const RECORD_READ_LIMIT = 500;
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
} as const;
const PUBLIC_ALLOWED_QUERY_KEYS = new Set(["symbol", "locale", "page"]);

function pageParam(value: string | null) {
  if (!value) return 1;
  if (!/^[1-9]\d*$/.test(value)) return Number.NaN;
  return Number(value);
}

function validatePublicQuery(url: URL) {
  for (const key of Array.from(url.searchParams.keys())) {
    if (!PUBLIC_ALLOWED_QUERY_KEYS.has(key)) return { ok: false as const };
  }
  const page = pageParam(url.searchParams.get("page"));
  if (!Number.isFinite(page) || page < 1 || page > MAX_PUBLIC_PAGE) {
    return { ok: false as const };
  }
  return { ok: true as const, page };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const publicQuery = validatePublicQuery(url);
  if (!publicQuery.ok) {
    return NextResponse.json({ error: "unsupported_query" }, { status: 400 });
  }

  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const symbol = normalizeDecisionHistorySymbol(url.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-decision-history:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const budget = checkPublicBoardKvBudget({
    route: "decision-history",
    estimatedCommands: 4,
  });
  if (!budget.allowed) {
    return NextResponse.json(
      { symbol, locale, items: [], hasMore: false, nextBefore: null, degraded: true },
      { headers: PUBLIC_CACHE_HEADERS },
    );
  }

  const page = publicQuery.page;
  const requestedLimit = DEFAULT_LIMIT * page + 1;
  const start = (page - 1) * DEFAULT_LIMIT;
  const payloadSource = shouldUseStagingMockTimeline()
    ? getStagingDecisionHistoryPayload({ symbol, locale, limit: requestedLimit, before: null })
    : buildDecisionHistoryPayload({
        symbol,
        locale,
        records: await readDecisionRecords(symbol, RECORD_READ_LIMIT, locale),
        limit: requestedLimit,
        before: null,
      });
  const items = payloadSource.items.slice(start, start + DEFAULT_LIMIT);
  const payload = {
    ...payloadSource,
    items,
    hasMore: page < MAX_PUBLIC_PAGE && payloadSource.items.length > start + DEFAULT_LIMIT,
    nextBefore: null,
  };

  return NextResponse.json(payload, {
    headers: PUBLIC_CACHE_HEADERS,
  });
}
