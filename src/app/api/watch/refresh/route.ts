import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { checkLock, releaseLock, tryAcquireLock } from "@/lib/storage/kv-lock";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { publishPmDecisionJobToQueue } from "@/lib/team/pmDecisionJobQueue";
import { runPmDecisionJob } from "@/lib/team/pmDecisionJobRunner";
import { marketSignalsFromPool } from "@/lib/team/pmDecisionTrigger";
import { selectPmDecisionTopics } from "@/lib/team/topicSelector";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { enqueuePmDecisionJob } from "@/lib/watch/pmDecisionJobLedger";
import {
  normalizeCandidateType,
  type CandidateType,
  type DecisionCandidate,
} from "@/lib/watch/decisionCandidate";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import {
  deriveDecisionFreshness,
  normalizeRefreshSymbol,
  WATCH_DECISION_FRESHNESS_MS,
  WATCH_DECISION_FUTURE_SKEW_MS,
  type DecisionFreshnessSource,
  type DecisionFreshnessSnapshot,
} from "@/lib/watch/decisionFreshness";
import {
  hasPublicBetaSymbolCoverage,
  isPublicBetaMajorRotationSymbol,
} from "@/lib/watch/publicSymbolCoverage";
import {
  HOTSPOT_STORAGE_SYMBOL,
  MARKET_OVERVIEW_STORAGE_SYMBOL,
  hotspotDecisionCandidate,
  marketOverviewCandidate,
  symbolDecisionCandidate,
} from "@/lib/watch/residentCandidate";
import { filterPublicTimelineEvents } from "@/lib/watch/publicTimelineProjection";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { WatchRefreshStatus } from "@/lib/watch/refreshStatus";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import type { Locale } from "@/i18n/types";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface WatchRefreshPayload {
  status: WatchRefreshStatus;
  symbol: string;
  candidateType?: CandidateType;
  candidateKey?: string;
  displayTitle?: string;
  lastDecisionAt: string | null;
  nextAllowedAt: string | null;
  refreshStarted: boolean;
  refreshSource: DecisionFreshnessSource;
}

const REFRESH_RATE_LIMIT = { max: 6, windowMs: 60_000 };
const IN_FLIGHT_LOCK_MS = 5 * 60_000;
const COOLDOWN_LOCK_MS = 5 * 60_000;
const HISTORY_WINDOW_MINUTES = 720;
const AUTO_SYMBOL_STORAGE_SYMBOL = "SYMBOL";
const AUTO_SYMBOL_CANDIDATE_KEY = "symbol:auto";

function json(payload: WatchRefreshPayload, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

function requestUrl(request: Request) {
  return new URL(request.url);
}

function requestNow(url: URL) {
  const raw = url.searchParams.get("testNow") ?? url.searchParams.get("now");
  if (!raw) return Date.now();
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  const parsedDate = Date.parse(raw);
  return Number.isFinite(parsedDate) ? parsedDate : Date.now();
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
  candidate,
  freshness,
  nextAllowedAt = null,
  refreshStarted = false,
}: {
  status: WatchRefreshStatus;
  candidate: DecisionCandidate;
  freshness: Awaited<ReturnType<typeof loadFreshness>>;
  nextAllowedAt?: string | null;
  refreshStarted?: boolean;
}): WatchRefreshPayload {
  return {
    status,
    symbol: candidate.symbol ?? storageSymbolForRefresh(candidate),
    candidateType: candidate.candidateType,
    candidateKey: candidate.candidateKey,
    displayTitle: candidate.displayTitle,
    lastDecisionAt: freshness.lastDecisionAt,
    nextAllowedAt,
    refreshStarted,
    refreshSource: freshness.refreshSource,
  };
}

function storageSymbolForRefresh(candidate: DecisionCandidate) {
  if (candidate.symbol) return candidate.symbol;
  if (isAutoSymbolRefreshCandidate(candidate)) return AUTO_SYMBOL_STORAGE_SYMBOL;
  return candidate.candidateType === "market_overview"
    ? MARKET_OVERVIEW_STORAGE_SYMBOL
    : HOTSPOT_STORAGE_SYMBOL;
}

function refreshIdentityKey(candidate: DecisionCandidate) {
  return candidate.candidateType === "symbol" && candidate.symbol
    ? candidate.symbol
    : candidate.candidateKey;
}

function autoSymbolRefreshCandidate(): DecisionCandidate {
  return {
    candidateType: "symbol",
    candidateKey: AUTO_SYMBOL_CANDIDATE_KEY,
    displayTitle: "优先级币种分析",
    executable: false,
    cadence: "event",
    score: 0,
    reasons: [],
  };
}

function isAutoSymbolRefreshCandidate(candidate: DecisionCandidate) {
  return candidate.candidateType === "symbol" && !candidate.symbol;
}

function isRealSymbolValue(value: string | null | undefined) {
  const normalized = normalizeRefreshSymbol(value);
  return Boolean(
    normalized &&
    normalized !== MARKET_OVERVIEW_STORAGE_SYMBOL &&
    normalized !== HOTSPOT_STORAGE_SYMBOL &&
    normalized !== AUTO_SYMBOL_STORAGE_SYMBOL,
  );
}

function candidateFromRequest(url: URL, locale: Locale, now: number): DecisionCandidate | null {
  const candidateType = url.searchParams.get("candidateType");
  if (candidateType === "symbol" && !normalizeRefreshSymbol(url.searchParams.get("symbol"))) {
    return autoSymbolRefreshCandidate();
  }
  if (candidateType === "market_overview") {
    return marketOverviewCandidate({ locale, now });
  }
  if (candidateType === "hotspot") {
    return hotspotDecisionCandidate({
      locale,
      now,
      candidateKey: url.searchParams.get("candidateKey"),
      displayTitle: url.searchParams.get("displayTitle"),
      symbol: url.searchParams.get("symbol"),
      executable: url.searchParams.get("executable") === "true",
    });
  }
  const symbol = normalizeRefreshSymbol(url.searchParams.get("symbol"));
  return symbol ? symbolDecisionCandidate({ symbol }) : null;
}

async function loadFreshness(candidate: DecisionCandidate, locale: Locale, now: number) {
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

  if (isAutoSymbolRefreshCandidate(candidate)) {
    return deriveAnySymbolDecisionFreshness({ records, timelineEvents, now });
  }

  return deriveDecisionFreshness({
    symbol: storageSymbolForRefresh(candidate),
    candidateType: candidate.candidateType,
    candidateKey: candidate.candidateKey,
    records,
    timelineEvents,
    now,
  });
}

function deriveAnySymbolDecisionFreshness({
  records,
  timelineEvents,
  now,
}: {
  records: readonly StrategyDecisionRecord[];
  timelineEvents: readonly PublicTimelineEvent[];
  now: number;
}): DecisionFreshnessSnapshot {
  const candidates = [
    ...records.flatMap((record) => {
      if (normalizeCandidateType(record.candidate?.candidateType) !== "symbol") return [];
      const symbol = normalizeRefreshSymbol(record.symbol ?? record.tradeDecision?.symbol);
      if (!isRealSymbolValue(symbol)) return [];
      const createdAt = Date.parse(record.createdAt);
      return Number.isFinite(createdAt)
        ? [{ symbol: symbol as string, ts: createdAt, source: "records" as const }]
        : [];
    }),
    ...timelineEvents.flatMap((event) => {
      const symbol =
        event.payload.kind === "pm_decision" ? normalizeRefreshSymbol(event.payload.symbol) : null;
      if (
        event.payload.kind !== "pm_decision" ||
        normalizeCandidateType(event.payload.candidateType) !== "symbol" ||
        !isRealSymbolValue(symbol)
      ) {
        return [];
      }
      return Number.isFinite(event.ts)
        ? [{ symbol: symbol as string, ts: event.ts, source: "timeline" as const }]
        : [];
    }),
  ]
    .filter((candidate) => candidate.ts <= now + WATCH_DECISION_FUTURE_SKEW_MS)
    .sort((left, right) => right.ts - left.ts);
  const latest = candidates[0];
  const freshSymbols = candidates
    .filter((candidate) => now - candidate.ts < WATCH_DECISION_FRESHNESS_MS)
    .map((candidate) => candidate.symbol);

  if (!latest) {
    return {
      symbol: AUTO_SYMBOL_STORAGE_SYMBOL,
      lastDecisionAt: null,
      lastDecisionAtMs: null,
      refreshSource: "none",
      isFresh: false,
    };
  }

  return {
    symbol: AUTO_SYMBOL_STORAGE_SYMBOL,
    lastDecisionAt: new Date(latest.ts).toISOString(),
    lastDecisionAtMs: latest.ts,
    refreshSource: latest.source,
    isFresh: hasPublicBetaSymbolCoverage(freshSymbols),
  };
}

async function loadTriggerContext(locale: Locale, candidate: DecisionCandidate, now: number) {
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
  if (candidate.candidateType !== "symbol") {
    return {
      pool,
      newsItems: normalizedItems,
      hasTrigger: true,
    };
  }
  const newsEvidence = normalizedItems.map((item) => newsItemToEvidence(item));
  const marketSignals = marketSignalsFromPool(pool, now);
  const selectedTopic = selectPmDecisionTopics({
    pool,
    marketSignals,
    newsEvidence,
    symbol: candidate.symbol,
    now,
  })[0];
  const hasStrongTrigger =
    selectedTopic?.reasons.some(
      (reason) =>
        (reason.kind === "market" && reason.score >= 40) ||
        (reason.kind === "news" && reason.score >= 60),
    ) ?? false;
  const hasMajorRotationBaseline =
    isAutoSymbolRefreshCandidate(candidate) &&
    isPublicBetaMajorRotationSymbol(selectedTopic?.symbol);
  const hasTrigger = hasStrongTrigger || hasMajorRotationBaseline;

  return {
    pool,
    newsItems: normalizedItems,
    hasTrigger,
  };
}

async function handleStatus(request: Request) {
  const url = requestUrl(request);
  const now = requestNow(url);
  const locale = normalizeWatchLocale(url.searchParams.get("locale"));
  const candidate = candidateFromRequest(url, locale, now);
  if (!candidate) return NextResponse.json({ error: "invalid_candidate" }, { status: 400 });
  const freshness = await loadFreshness(candidate, locale, now);
  const status: WatchRefreshStatus = freshness.isFresh ? "cached" : "stale";
  return json(basePayload({ status, candidate, freshness }));
}

export async function GET(request: Request) {
  return handleStatus(request);
}

export async function POST(request: Request) {
  const url = requestUrl(request);
  const now = requestNow(url);
  const locale = normalizeWatchLocale(url.searchParams.get("locale"));
  const candidate = candidateFromRequest(url, locale, now);
  if (!candidate) return NextResponse.json({ error: "invalid_candidate" }, { status: 400 });
  const identityKey = refreshIdentityKey(candidate);
  const rateLimit = await checkRateLimit(`watch-refresh:ip:${ipKey(request)}`, REFRESH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    const freshness = await loadFreshness(candidate, locale, now);
    return json(
      basePayload({
        status: "locked",
        candidate,
        freshness,
        nextAllowedAt: isoOrNull(rateLimit.resetAt),
      }),
      { status: 429 },
    );
  }

  const inFlightKey = `watch:refresh:in-flight:${locale}:${identityKey}`;
  const inFlight = await checkLock(inFlightKey);
  if (inFlight.locked) {
    const freshness = await loadFreshness(candidate, locale, now);
    return json(
      basePayload({
        status: "refreshing",
        candidate,
        freshness,
        nextAllowedAt: isoOrNull(inFlight.expiresAt),
      }),
    );
  }

  const freshness = await loadFreshness(candidate, locale, now);
  if (freshness.isFresh) {
    return json(basePayload({ status: "cached", candidate, freshness }));
  }

  const cooldownKey = `watch:refresh:cooldown:${locale}`;
  const cooldown = await checkLock(cooldownKey);
  if (cooldown.locked) {
    return json(
      basePayload({
        status: "locked",
        candidate,
        freshness,
        nextAllowedAt: isoOrNull(cooldown.expiresAt),
      }),
    );
  }

  const pmDecisionLockKey = `watch:pm-decision:${locale}:${identityKey}`;
  const pmDecisionLock = await checkLock(pmDecisionLockKey);
  if (pmDecisionLock.locked) {
    return json(
      basePayload({
        status: "locked",
        candidate,
        freshness,
        nextAllowedAt: isoOrNull(pmDecisionLock.expiresAt),
      }),
    );
  }

  const context = await loadTriggerContext(locale, candidate, now);
  if (!context.hasTrigger) {
    return json(basePayload({ status: "no_signal", candidate, freshness }));
  }

  const cooldownHandle = await tryAcquireLock(cooldownKey, {
    ttlMs: COOLDOWN_LOCK_MS,
    waitMs: 0,
  });
  if (!cooldownHandle) {
    return json(basePayload({ status: "locked", candidate, freshness }));
  }
  const inFlightHandle = await tryAcquireLock(inFlightKey, {
    ttlMs: IN_FLIGHT_LOCK_MS,
    waitMs: 0,
  });
  if (!inFlightHandle) {
    return json(basePayload({ status: "refreshing", candidate, freshness }));
  }

  const pmDecisionJob = await enqueuePmDecisionJob({
    kind: "once",
    triggerSource: "user_visit_trigger",
    locale,
    ...(isAutoSymbolRefreshCandidate(candidate)
      ? {}
      : candidate.candidateType === "symbol"
        ? { symbol: candidate.symbol }
        : { candidate }),
    now,
  });

  waitUntil(
    (async () => {
      const queueResult = await publishPmDecisionJobToQueue(pmDecisionJob, { now });
      if (queueResult.mode === "queue") return;
      if (queueResult.mode === "failed") {
        console.error("[claw42] watch refresh queue publish failed; falling back to waitUntil", {
          candidateKey: candidate.candidateKey,
          locale,
          error: queueResult.errorMessage,
        });
      }
      await runPmDecisionJob(pmDecisionJob, {
        pool: context.pool,
        newsItems: context.newsItems,
        now,
        partialStageUpdates: true,
      });
    })()
      .catch((error) => {
        console.error("[claw42] watch refresh trigger failed", {
          candidateKey: candidate.candidateKey,
          locale,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => releaseLock(inFlightHandle)),
  );

  return json(basePayload({ status: "stale", candidate, freshness, refreshStarted: true }));
}
