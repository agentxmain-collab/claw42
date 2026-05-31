import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import {
  buildWatchTimelinePayload,
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
} from "@/lib/watch/publicTimelinePayload";
import type { PublicTimelineSnapshotPayload } from "@/lib/watch/publicTimelineSnapshotStore";
import {
  createEmptyPublicTimelineSnapshot,
  readPublicTimelineSnapshot,
} from "@/lib/watch/publicTimelineSnapshotStore";
import { getDecisionRecordStoreDiagnostics } from "@/lib/team/decisionRecordStore";
import {
  checkPublicBoardKvBudget,
  readPublicBoardLastGood,
  rememberPublicBoardLastGood,
} from "@/lib/watch/publicBoardKvBudgetGuard";
import { isLocale } from "@/i18n/locales";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PUBLIC_TIMELINE_PAGE_SIZE = 15;
const PUBLIC_TIMELINE_WINDOW_MINUTES = 60;
const PUBLIC_TIMELINE_ALLOWED_PAGES = new Set([1, 2]);
const PUBLIC_TIMELINE_ALLOWED_QUERY_KEYS = new Set(["locale", "page", "windowMinutes", "pageSize"]);
const PUBLIC_TIMELINE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
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

function parseCanonicalPublicQuery(url: URL, request: NextRequest) {
  for (const key of Array.from(url.searchParams.keys())) {
    if (!PUBLIC_TIMELINE_ALLOWED_QUERY_KEYS.has(key)) {
      return { ok: false as const, error: "unsupported_query" };
    }
  }

  const localeParam = url.searchParams.get("locale");
  if (localeParam !== null && !isLocale(localeParam)) {
    return { ok: false as const, error: "invalid_locale" };
  }

  const windowMinutesParam = url.searchParams.get("windowMinutes");
  if (
    windowMinutesParam !== null &&
    windowMinutesParam !== String(PUBLIC_TIMELINE_WINDOW_MINUTES)
  ) {
    return { ok: false as const, error: "invalid_window" };
  }

  const pageSizeParam = url.searchParams.get("pageSize");
  if (pageSizeParam !== null && pageSizeParam !== String(PUBLIC_TIMELINE_PAGE_SIZE)) {
    return { ok: false as const, error: "invalid_page_size" };
  }

  const pageParam = url.searchParams.get("page") ?? "1";
  if (!/^[1-9]\d*$/.test(pageParam)) {
    return { ok: false as const, error: "invalid_page" };
  }
  const page = Number(pageParam);
  if (!PUBLIC_TIMELINE_ALLOWED_PAGES.has(page)) {
    return { ok: false as const, error: "invalid_page" };
  }

  return {
    ok: true as const,
    locale: localeParam ?? localeFromRequestUrl(url, request.headers.get("accept-language")),
    windowMinutes: PUBLIC_TIMELINE_WINDOW_MINUTES,
    page,
    pageSize: PUBLIC_TIMELINE_PAGE_SIZE,
  };
}

function publicTimelineLastGoodKey({
  locale,
  windowMinutes,
  page,
  pageSize,
}: {
  locale: string;
  windowMinutes: number;
  page: number;
  pageSize: number;
}) {
  return `timeline:${locale}:${windowMinutes}:${page}:${pageSize}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "debug" ? "debug" : "public";
  if (mode === "debug" && !canReadDebug(request)) {
    return NextResponse.json({ error: "debug mode unavailable" }, { status: 403 });
  }
  const includeStorageDiagnostics = url.searchParams.get("diagnostics") === "storage";
  if (includeStorageDiagnostics && !canReadDebug(request)) {
    return NextResponse.json({ error: "debug mode unavailable" }, { status: 403 });
  }

  const publicQuery =
    mode === "public" && !includeStorageDiagnostics
      ? parseCanonicalPublicQuery(url, request)
      : null;
  if (publicQuery && !publicQuery.ok) {
    return NextResponse.json({ error: publicQuery.error }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-timeline:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const locale =
    publicQuery?.ok === true
      ? publicQuery.locale
      : localeFromRequestUrl(url, request.headers.get("accept-language"));
  const windowMinutes =
    publicQuery?.ok === true
      ? publicQuery.windowMinutes
      : Math.min(
          Math.max(numberParam(url.searchParams.get("windowMinutes"), 60), 1),
          MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
        );
  const limit = Math.min(Math.max(numberParam(url.searchParams.get("limit"), 30), 1), 100);
  const page =
    publicQuery?.ok === true
      ? publicQuery.page
      : Math.max(Math.floor(numberParam(url.searchParams.get("page"), 1)), 1);
  const pageSize =
    publicQuery?.ok === true
      ? publicQuery.pageSize
      : mode === "public"
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

  if (mode === "public" && !includeStorageDiagnostics) {
    const now = Date.now();
    const lastGoodKey = publicTimelineLastGoodKey({ locale, windowMinutes, page, pageSize });
    const budget = checkPublicBoardKvBudget({
      route: "timeline",
      estimatedCommands: 2,
      now,
    });
    if (!budget.allowed) {
      const lastGood = readPublicBoardLastGood<PublicTimelineSnapshotPayload>(lastGoodKey);
      return NextResponse.json(
        lastGood ??
          createEmptyPublicTimelineSnapshot({
            locale,
            windowMinutes,
            page,
            pageSize,
            now,
            status: "degraded",
            sourceHealth: {
              state: "degraded",
              reason: budget.reason,
            },
          }),
        { headers: PUBLIC_TIMELINE_CACHE_HEADERS },
      );
    }

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

    rememberPublicBoardLastGood(lastGoodKey, readResult.payload);
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
