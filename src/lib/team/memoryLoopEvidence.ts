import { kv } from "@vercel/kv";
import { computeTeamWinrates, type TeamMemberWinrate } from "@/lib/team/computeTeamWinrates";
import { readAllDecisionRecords, readDecisionRecords } from "@/lib/team/decisionRecordStore";
import type { DecisionOutcome, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import { cleanPublicDecisionText } from "@/lib/watch/publicContentGuardrails";

export interface MemoryContext {
  historicalCount: number | null;
  symbolHistoricalCount: number | null;
  crossSymbolHistoricalCount: number;
  winLossDistribution: {
    wins: number;
    losses: number;
    openTrades: number;
  };
  similarSetups: Array<{
    timestamp: number;
    symbol: string;
    direction: string;
    outcome: string;
    relation: "same_symbol" | "cross_symbol";
  }>;
  lastReviewNotes: string | null;
  sampleSizeCaution: boolean;
  error?: "kv_unavailable" | "no_history";
}

export interface TeamTrackRecordSummary {
  generatedAt: string;
  locale: Locale;
  winrates: TeamMemberWinrate[];
}

interface MemoryLoopDeps {
  readDecisionRecords?: typeof readDecisionRecords;
  readAllDecisionRecords?: typeof readAllDecisionRecords;
  now?: () => number;
}

const MEMORY_RECORD_LIMIT = 100;
const TEAM_RECORD_LIMIT = 500;
const SIMILAR_SETUP_LIMIT = 5;
const SAMPLE_SIZE_CAUTION_THRESHOLD = 5;
const TEAM_WINRATE_CACHE_TTL_MS = 5 * 60_000;
const TEAM_WINRATE_CACHE_TTL_SECONDS = TEAM_WINRATE_CACHE_TTL_MS / 1_000;
const TEAM_WINRATE_CACHE_PREFIX = "claw42:team_winrates:v1:";

type KvCacheClient = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

const memoryTeamWinrateCache = new Map<
  Locale,
  { expiresAt: number; value: TeamTrackRecordSummary }
>();

export async function fetchMemoryContext(
  symbol: string,
  locale: Locale = LEGACY_WATCH_LOCALE,
  deps: MemoryLoopDeps = {},
): Promise<MemoryContext> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedLocale = normalizeWatchLocale(locale);

  try {
    const records = await (deps.readDecisionRecords ?? readDecisionRecords)(
      normalizedSymbol,
      MEMORY_RECORD_LIMIT,
      normalizedLocale,
    );
    const usableRecords = records
      .filter((record) => record.recordSource !== "legacy")
      .filter((record) => record.symbol === normalizedSymbol)
      .filter(isResolvedLearningRecord)
      .sort(sortNewestFirst);
    const crossSymbolRecords = await fetchCrossSymbolLearningRecords(
      normalizedSymbol,
      normalizedLocale,
      usableRecords.length,
      deps,
    );
    const learningRecords = [...usableRecords, ...crossSymbolRecords];

    if (learningRecords.length === 0) {
      return emptyMemoryContext("no_history");
    }

    return {
      historicalCount: learningRecords.length,
      symbolHistoricalCount: usableRecords.length,
      crossSymbolHistoricalCount: crossSymbolRecords.length,
      winLossDistribution: distributionForRecords(learningRecords),
      similarSetups: [
        ...usableRecords.map((record) => similarSetupFromRecord(record, "same_symbol")),
        ...crossSymbolRecords.map((record) => similarSetupFromRecord(record, "cross_symbol")),
      ].slice(0, SIMILAR_SETUP_LIMIT),
      lastReviewNotes:
        latestMemoryLoopNote(usableRecords) ?? latestMemoryLoopNote(crossSymbolRecords),
      sampleSizeCaution: learningRecords.length < SAMPLE_SIZE_CAUTION_THRESHOLD,
    };
  } catch {
    return emptyMemoryContext("kv_unavailable");
  }
}

export async function fetchTeamTrackRecord(
  locale: Locale = LEGACY_WATCH_LOCALE,
  deps: MemoryLoopDeps = {},
): Promise<TeamTrackRecordSummary> {
  const normalizedLocale = normalizeWatchLocale(locale);
  const now = deps.now?.() ?? Date.now();
  const shouldUseCache = !deps.readAllDecisionRecords;
  const cached = shouldUseCache ? await readTeamWinrateCache(normalizedLocale, now) : null;
  if (cached) return cached;

  const records = await (deps.readAllDecisionRecords ?? readAllDecisionRecords)(
    TEAM_RECORD_LIMIT,
    normalizedLocale,
  );
  const summary = {
    generatedAt: new Date(now).toISOString(),
    locale: normalizedLocale,
    winrates: await computeTeamWinrates(records),
  };
  if (shouldUseCache) await writeTeamWinrateCache(summary, now);
  return summary;
}

async function readTeamWinrateCache(locale: Locale, now: number) {
  if (hasKvConfig()) {
    try {
      return await (kv as KvCacheClient).get<TeamTrackRecordSummary>(teamWinrateCacheKey(locale));
    } catch {
      // Fall through to memory cache.
    }
  }

  const cached = memoryTeamWinrateCache.get(locale);
  if (!cached || cached.expiresAt <= now) return null;
  return cached.value;
}

async function writeTeamWinrateCache(summary: TeamTrackRecordSummary, now: number) {
  if (hasKvConfig()) {
    try {
      await (kv as KvCacheClient).set(teamWinrateCacheKey(summary.locale), summary, {
        ex: TEAM_WINRATE_CACHE_TTL_SECONDS,
      });
      return;
    } catch {
      // Fall through to memory cache.
    }
  }

  memoryTeamWinrateCache.set(summary.locale, {
    expiresAt: now + TEAM_WINRATE_CACHE_TTL_MS,
    value: summary,
  });
}

export function formatMemoryContextForPrompt(context: MemoryContext) {
  if (context.error === "kv_unavailable") {
    return [
      "Memory context unavailable; make the PM decision from current evidence only.",
      "Do not mention backend availability in public output.",
    ].join("\n");
  }

  if (context.error === "no_history" || context.historicalCount === 0) {
    return [
      "Resolved decision memory has no usable sample for this symbol.",
      "Return an empty public rationale; do not seed a public memory note from an unresolved case.",
    ].join("\n");
  }

  const distribution = context.winLossDistribution;
  const setups = context.similarSetups
    .map(
      (setup) =>
        `- ${new Date(setup.timestamp).toISOString()}: ${setup.symbol} ${setup.direction} -> ${
          setup.outcome
        }`,
    )
    .join("\n");

  return [
    `Historical samples: ${context.historicalCount}`,
    `Current-symbol samples: ${context.symbolHistoricalCount ?? 0}`,
    `Cross-symbol samples: ${context.crossSymbolHistoricalCount}`,
    `Outcome distribution: wins=${distribution.wins}, losses=${distribution.losses}, open=${distribution.openTrades}`,
    context.sampleSizeCaution
      ? `Sample-size caution: fewer than ${SAMPLE_SIZE_CAUTION_THRESHOLD} historical samples. Treat win-rate cues as directional only.`
      : "Sample-size caution: false",
    context.lastReviewNotes
      ? `Last review note: ${context.lastReviewNotes}`
      : "Last review note: none",
    `Similar recent setups:\n${setups || "- none"}`,
    context.crossSymbolHistoricalCount > 0
      ? "Cross-symbol resolved lessons: use these only as pattern memory, not as symbol-specific proof."
      : "Cross-symbol resolved lessons: none",
  ].join("\n");
}

function emptyMemoryContext(error: MemoryContext["error"]): MemoryContext {
  return {
    historicalCount: error === "no_history" ? 0 : null,
    symbolHistoricalCount: error === "no_history" ? 0 : null,
    crossSymbolHistoricalCount: 0,
    winLossDistribution: {
      wins: 0,
      losses: 0,
      openTrades: 0,
    },
    similarSetups: [],
    lastReviewNotes: null,
    sampleSizeCaution: true,
    error,
  };
}

async function fetchCrossSymbolLearningRecords(
  normalizedSymbol: string,
  locale: Locale,
  sameSymbolCount: number,
  deps: MemoryLoopDeps,
) {
  if (sameSymbolCount >= SAMPLE_SIZE_CAUTION_THRESHOLD) return [];
  const readAll =
    deps.readAllDecisionRecords ??
    (process.env.NODE_ENV === "test" ? null : readAllDecisionRecords);
  if (!readAll) return [];

  const records = await readAll(MEMORY_RECORD_LIMIT, locale);
  return records
    .filter((record) => record.recordSource !== "legacy")
    .filter((record) => record.symbol !== normalizedSymbol)
    .filter(isResolvedLearningRecord)
    .sort(sortNewestFirst)
    .slice(0, SIMILAR_SETUP_LIMIT);
}

function distributionForRecords(records: StrategyDecisionRecord[]) {
  return records.reduce(
    (distribution, record) => {
      if (record.resolvedOutcome === "hit_tp") distribution.wins += 1;
      else if (isResolvedNonWin(record.resolvedOutcome)) distribution.losses += 1;
      else distribution.openTrades += 1;
      return distribution;
    },
    { wins: 0, losses: 0, openTrades: 0 },
  );
}

function isResolvedNonWin(outcome: DecisionOutcome) {
  return outcome === "hit_sl" || outcome === "expired" || outcome === "manual_close";
}

function isResolvedLearningRecord(record: StrategyDecisionRecord) {
  return Boolean(record.resolvedAt && record.resolvedOutcome);
}

function similarSetupFromRecord(
  record: StrategyDecisionRecord,
  relation: "same_symbol" | "cross_symbol",
) {
  return {
    timestamp: Date.parse(record.createdAt) || 0,
    symbol: record.symbol,
    direction:
      record.tradeDecision?.direction ??
      record.analystInputs.find((input) => input.memberId === "pm")?.direction ??
      "wait",
    outcome: record.resolvedOutcome ?? "open",
    relation,
  };
}

function latestMemoryLoopNote(records: StrategyDecisionRecord[]) {
  for (const record of records) {
    const memoryInput = record.analystInputs.find((input) => input.memberId === "memory_loop");
    const note =
      memoryInput?.oneLineSummary?.trim() ||
      memoryInput?.detailedRationale?.trim() ||
      memoryInput?.rationale?.trim();
    const cleaned = cleanPublicDecisionText(note, record.locale);
    if (cleaned) return cleaned;
  }
  return null;
}

function sortNewestFirst(left: StrategyDecisionRecord, right: StrategyDecisionRecord) {
  return Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "");
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase() || "BTC";
}

function teamWinrateCacheKey(locale: Locale) {
  return `${TEAM_WINRATE_CACHE_PREFIX}${locale}`;
}

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}
