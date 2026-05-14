import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import {
  buildTopicSelectionEvidence,
  selectPmDecisionTopics,
  type TopicScoreBreakdown,
} from "@/lib/team/topicSelector";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import { filterPublicTimelineEvents } from "@/lib/watch/publicTimelineProjection";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { CoinPoolPayload, CoinTickerEntry, SignalRecord } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const PM_DECISION_SYMBOL_LOCK_MS = 170 * 60_000;
const RECENT_TOPIC_WINDOW_MINUTES = 180;
const MARKET_NEWS_ANCHOR_SYMBOL = "BTC";

function normalizeSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

export type PmDecisionTriggerAuditEvent =
  | {
      type: "candidate_considered";
      triggerSource: "cron" | "user_visit_trigger";
      locale: Locale;
      symbol: string;
      score: number;
      scoreBreakdown: TopicScoreBreakdown;
      reasonCount: number;
      hasTrigger: boolean;
      marketSignalIds: string[];
      newsEvidenceIds: string[];
    }
  | {
      type: "candidate_skipped";
      triggerSource: "cron" | "user_visit_trigger";
      locale: Locale;
      symbol: string;
      reason: "no_trigger" | "locked" | "pipeline_returned_null";
    }
  | {
      type: "candidate_generated";
      triggerSource: "cron" | "user_visit_trigger";
      locale: Locale;
      symbol: string;
      recordId: string | null;
    }
  | {
      type: "selection_skipped";
      triggerSource: "cron" | "user_visit_trigger";
      locale: Locale;
      reason: "no_candidates";
      candidateCount: number;
    };

type PmDecisionTriggerAuditSink = (event: PmDecisionTriggerAuditEvent) => void;

function signalFromTicker(item: CoinTickerEntry, now: number): SignalRecord | null {
  const change = item.change24h;
  if (!Number.isFinite(change)) return null;
  const symbol = normalizeSymbol(item.symbol);
  const severity = Math.abs(change) >= 3 ? "alert" : Math.abs(change) >= 1 ? "watch" : "info";
  return {
    id: `ticker:${symbol}:${Math.floor(now / 300_000)}`,
    ts: now,
    symbol,
    type: "range_change",
    severity,
    payload: {
      priceLevel: item.price,
      change24h: change,
      description: `${symbol} 24h ${change.toFixed(2)}%`,
    },
  };
}

export function marketSignalsFromPool(
  pool: CoinPoolPayload | undefined,
  now = Date.now(),
  symbol?: string,
): SignalRecord[] {
  if (!pool) return [];
  const normalizedSymbol = symbol ? normalizeSymbol(symbol) : undefined;
  return [...pool.majors, ...pool.trending, ...pool.opportunity]
    .filter((item) => !normalizedSymbol || normalizeSymbol(item.symbol) === normalizedSymbol)
    .map((item) => signalFromTicker(item, now))
    .filter((item): item is SignalRecord => Boolean(item));
}

function symbolsFromPool(pool: CoinPoolPayload | undefined) {
  if (!pool) return ["BTC"];
  return Array.from(
    new Set(
      [...pool.majors, ...pool.trending, ...pool.opportunity]
        .map((item) => normalizeSymbol(item.symbol))
        .filter(Boolean),
    ),
  );
}

function evidenceMatchesCandidateSymbol(evidence: { symbol: string[] }, candidate: string) {
  const normalizedCandidate = normalizeSymbol(candidate);
  if (evidence.symbol.length === 0) return normalizedCandidate === MARKET_NEWS_ANCHOR_SYMBOL;
  return evidence.symbol.some((symbol) => normalizeSymbol(symbol) === normalizedCandidate);
}

export async function evidenceFromNewsItems(items: NewsItem[]) {
  const evidences = items.map((item) => newsItemToEvidence(item));
  await Promise.all(
    evidences.map((evidence) =>
      saveNewsEvidence(evidence).catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] news evidence pre-save skipped", {
            evidenceId: evidence.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    ),
  );
  return evidences;
}

async function recentPublicTimelineEvents(locale: Locale): Promise<PublicTimelineEvent[]> {
  try {
    const history = await getWatchHistory({
      windowMinutes: RECENT_TOPIC_WINDOW_MINUTES,
      limit: 100,
      locale,
    });
    return filterPublicTimelineEvents(history.entries, {
      mode: "public",
      importanceThreshold: "high",
      locale,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] recent topic history unavailable", error);
    }
    return [];
  }
}

async function recentDecisionRecords(locale: Locale) {
  try {
    return await readAllDecisionRecords(200, locale);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] recent decision memory unavailable", error);
    }
    return [];
  }
}

export async function triggerPmDecisionPipelineOnce({
  triggerSource,
  pool,
  newsItems = [],
  locale = LEGACY_WATCH_LOCALE,
  symbol,
  now = Date.now(),
  onAudit,
}: {
  triggerSource: "cron" | "user_visit_trigger";
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  locale?: Locale;
  symbol?: string;
  now?: number;
  onAudit?: PmDecisionTriggerAuditSink;
}) {
  const normalizedLocale = normalizeWatchLocale(locale);
  const recentNewsEvidence = await evidenceFromNewsItems(newsItems);
  const recentTimelineEvents = await recentPublicTimelineEvents(normalizedLocale);
  const recentDecisionMemory = await recentDecisionRecords(normalizedLocale);
  const candidateTopics = selectPmDecisionTopics({
    pool,
    marketSignals: marketSignalsFromPool(pool, now),
    newsEvidence: recentNewsEvidence,
    recentDecisionRecords: recentDecisionMemory,
    recentTimelineEvents,
    symbol,
    now,
  });
  if (candidateTopics.length === 0) {
    onAudit?.({
      type: "selection_skipped",
      triggerSource,
      locale: normalizedLocale,
      reason: "no_candidates",
      candidateCount: 0,
    });
  }

  for (const topic of candidateTopics) {
    const candidate = topic.symbol;
    const recentMarketSignals = marketSignalsFromPool(pool, now, candidate);
    const scopedNewsEvidence = recentNewsEvidence.filter((evidence) =>
      evidenceMatchesCandidateSymbol(evidence, candidate),
    );
    const hasTrigger =
      recentMarketSignals.some((signal) => signal.severity === "alert") ||
      scopedNewsEvidence.some((evidence) => evidence.impactSeverity === "high");
    onAudit?.({
      type: "candidate_considered",
      triggerSource,
      locale: normalizedLocale,
      symbol: candidate,
      score: topic.score,
      scoreBreakdown: topic.scoreBreakdown,
      reasonCount: topic.reasons.length,
      hasTrigger,
      marketSignalIds: topic.marketSignalIds,
      newsEvidenceIds: topic.newsEvidenceIds,
    });
    if (!hasTrigger) {
      onAudit?.({
        type: "candidate_skipped",
        triggerSource,
        locale: normalizedLocale,
        symbol: candidate,
        reason: "no_trigger",
      });
      continue;
    }

    const lock = await tryAcquireLock(`watch:pm-decision:${normalizedLocale}:${candidate}`, {
      ttlMs: PM_DECISION_SYMBOL_LOCK_MS,
      waitMs: 0,
    });
    if (!lock) {
      onAudit?.({
        type: "candidate_skipped",
        triggerSource,
        locale: normalizedLocale,
        symbol: candidate,
        reason: "locked",
      });
      console.info("[claw42] PM decision pipeline locked skip", {
        locale: normalizedLocale,
        symbol: candidate,
        triggerSource,
        ttlMs: PM_DECISION_SYMBOL_LOCK_MS,
      });
      continue;
    }

    const selectionEvidence = buildTopicSelectionEvidence(topic, now);
    const result = await runPmDecisionPipeline({
      triggerSource,
      recentMarketSignals,
      recentNewsEvidence: [selectionEvidence, ...scopedNewsEvidence],
      importanceThreshold: "high",
      locale: normalizedLocale,
      now,
    });
    if (result) {
      onAudit?.({
        type: "candidate_generated",
        triggerSource,
        locale: normalizedLocale,
        symbol: candidate,
        recordId: result.record.id ?? null,
      });
      return result;
    }
    onAudit?.({
      type: "candidate_skipped",
      triggerSource,
      locale: normalizedLocale,
      symbol: candidate,
      reason: "pipeline_returned_null",
    });
  }

  return null;
}

export async function triggerPmDecisionPipelineBatch({
  triggerSource,
  pool,
  newsItems = [],
  locale = LEGACY_WATCH_LOCALE,
  now = Date.now(),
  onAudit,
}: {
  triggerSource: "cron" | "user_visit_trigger";
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  locale?: Locale;
  now?: number;
  onAudit?: PmDecisionTriggerAuditSink;
}) {
  const outputs = [];
  for (const symbol of symbolsFromPool(pool)) {
    const output = await triggerPmDecisionPipelineOnce({
      triggerSource,
      pool,
      newsItems,
      locale,
      symbol,
      now,
      onAudit,
    });
    if (output) outputs.push(output);
  }
  return outputs;
}
