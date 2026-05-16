import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { checkLock, releaseLock, tryAcquireLock } from "@/lib/storage/kv-lock";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { marketSignalsFromPool, triggerPmDecisionPipelineOnce } from "@/lib/team/pmDecisionTrigger";
import { selectPmDecisionTopics } from "@/lib/team/topicSelector";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import {
  deriveDecisionFreshness,
  normalizeRefreshSymbol,
  type DecisionFreshnessSource,
} from "@/lib/watch/decisionFreshness";
import { filterPublicTimelineEvents } from "@/lib/watch/publicTimelineProjection";
import type { WatchRefreshStatus } from "@/lib/watch/refreshStatus";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import type { Locale } from "@/i18n/types";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface WatchRefreshPayload {
  status: WatchRefreshStatus;
  symbol: string;
  lastDecisionAt: string | null;
  nextAllowedAt: string | null;
  refreshStarted: boolean;
  refreshSource: DecisionFreshnessSource;
}

const REFRESH_RATE_LIMIT = { max: 6, windowMs: 60_000 };
const IN_FLIGHT_LOCK_MS = 5 * 60_000;
const COOLDOWN_LOCK_MS = 5 * 60_000;
const HISTORY_WINDOW_MINUTES = 720;

function json(payload: WatchRefreshPayload, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

function requestUrl(request: Request) {
  return new URL(request.url);
}

function ipKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown").replace(/[^a-zA-Z0-9:._-]/g, "_");
}

function isoOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function basePayload({
  status,
  symbol,
  freshness,
  nextAllowedAt = null,
  refreshStarted = false,
}: {
  status: WatchRefreshStatus;
  symbol: string;
  freshness: Awaited<ReturnType<typeof loadFreshness>>;
  nextAllowedAt?: string | null;
  refreshStarted?: boolean;
}): WatchRefreshPayload {
  return {
    status,
    symbol,
    lastDecisionAt: freshness.lastDecisionAt,
    nextAllowedAt,
    refreshStarted,
    refreshSource: freshness.refreshSource,
  };
}

async function loadFreshness(symbol: string, locale: Locale, now: number) {
  const [records, timelineEvents] = await Promise.all([
    readAllDecisionRecords(200, locale).catch(() => []),
    getWatchHistory({ windowMinutes: HISTORY_WINDOW_MINUTES, limit: 100, locale })
      .then((history) =>
        filterPublicTimelineEvents(history.entries, {
          mode: "public",
          importanceThreshold: "high",
          locale,
        }),
      )
      .catch(() => []),
  ]);

  return deriveDecisionFreshness({ symbol, records, timelineEvents, now });
}

async function loadTriggerContext(locale: Locale, symbol: string, now: number) {
  const [{ items, servedBy }, pool] = await Promise.all([
    fetchNewsWithChain({ limit: 8 }).catch(() => ({
      items: [] as NewsItem[],
      servedBy: "mock" as const,
      fellBackFrom: [],
    })),
    getCoinPool(),
  ]);
  const normalizedItems = await Promise.all(
    items.map((item) => normalizeNewsItem(item, servedBy).catch(() => item)),
  );
  const newsEvidence = normalizedItems.map((item) => newsItemToEvidence(item));
  const marketSignals = marketSignalsFromPool(pool, now);
  const candidate = selectPmDecisionTopics({
    pool,
    marketSignals,
    newsEvidence,
    symbol,
    now,
  })[0];
  const hasTrigger =
    candidate?.reasons.some(
      (reason) =>
        (reason.kind === "market" && reason.score >= 40) ||
        (reason.kind === "news" && reason.score >= 60),
    ) ?? false;

  return {
    pool,
    newsItems: normalizedItems,
    hasTrigger,
  };
}

async function handleStatus(request: Request) {
  const now = Date.now();
  const url = requestUrl(request);
  const symbol = normalizeRefreshSymbol(url.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const locale = normalizeWatchLocale(url.searchParams.get("locale"));
  const freshness = await loadFreshness(symbol, locale, now);
  const status: WatchRefreshStatus = freshness.isFresh ? "cached" : "stale";
  return json(basePayload({ status, symbol, freshness }));
}

export async function GET(request: Request) {
  return handleStatus(request);
}

export async function POST(request: Request) {
  const now = Date.now();
  const url = requestUrl(request);
  const symbol = normalizeRefreshSymbol(url.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const locale = normalizeWatchLocale(url.searchParams.get("locale"));
  const rateLimit = await checkRateLimit(`watch-refresh:ip:${ipKey(request)}`, REFRESH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    const freshness = await loadFreshness(symbol, locale, now);
    return json(
      basePayload({
        status: "locked",
        symbol,
        freshness,
        nextAllowedAt: isoOrNull(rateLimit.resetAt),
      }),
      { status: 429 },
    );
  }

  const inFlightKey = `watch:refresh:in-flight:${locale}:${symbol}`;
  const inFlight = await checkLock(inFlightKey);
  if (inFlight.locked) {
    const freshness = await loadFreshness(symbol, locale, now);
    return json(
      basePayload({
        status: "refreshing",
        symbol,
        freshness,
        nextAllowedAt: isoOrNull(inFlight.expiresAt),
      }),
    );
  }

  const freshness = await loadFreshness(symbol, locale, now);
  if (freshness.isFresh) {
    return json(basePayload({ status: "cached", symbol, freshness }));
  }

  const cooldownKey = `watch:refresh:cooldown:${locale}`;
  const cooldown = await checkLock(cooldownKey);
  if (cooldown.locked) {
    return json(
      basePayload({
        status: "locked",
        symbol,
        freshness,
        nextAllowedAt: isoOrNull(cooldown.expiresAt),
      }),
    );
  }

  const pmDecisionLockKey = `watch:pm-decision:${locale}:${symbol}`;
  const pmDecisionLock = await checkLock(pmDecisionLockKey);
  if (pmDecisionLock.locked) {
    return json(
      basePayload({
        status: "locked",
        symbol,
        freshness,
        nextAllowedAt: isoOrNull(pmDecisionLock.expiresAt),
      }),
    );
  }

  const context = await loadTriggerContext(locale, symbol, now);
  if (!context.hasTrigger) {
    return json(basePayload({ status: "no_signal", symbol, freshness }));
  }

  const cooldownHandle = await tryAcquireLock(cooldownKey, {
    ttlMs: COOLDOWN_LOCK_MS,
    waitMs: 0,
  });
  if (!cooldownHandle) {
    return json(basePayload({ status: "locked", symbol, freshness }));
  }
  const inFlightHandle = await tryAcquireLock(inFlightKey, {
    ttlMs: IN_FLIGHT_LOCK_MS,
    waitMs: 0,
  });
  if (!inFlightHandle) {
    return json(basePayload({ status: "refreshing", symbol, freshness }));
  }

  waitUntil(
    triggerPmDecisionPipelineOnce({
      triggerSource: "user_visit_trigger",
      pool: context.pool,
      newsItems: context.newsItems,
      locale,
      symbol,
      now,
      partialStageUpdates: true,
    })
      .catch((error) => {
        console.error("[claw42] watch refresh trigger failed", {
          symbol,
          locale,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => releaseLock(inFlightHandle)),
  );

  return json(basePayload({ status: "stale", symbol, freshness, refreshStarted: true }));
}
