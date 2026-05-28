import { getCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import { getCoinPool } from "@/lib/marketDataCache";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { evaluateDecisionResolution } from "@/lib/team/decisionResolution";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { checkLock, type LockSnapshot } from "@/lib/storage/kv-lock";
import { readPmDecisionJobs, type PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import { readPublicCardIndexPage, type PublicCardIndexPage } from "@/lib/watch/publicCardIndex";
import type { Locale } from "@/i18n/types";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";

export const STRATEGY_RESOLUTION_BUCKET_LABELS = [
  "alreadyResolved",
  "openNoTradeDecision",
  "openStrategyNoEvaluationWindow",
  "openStrategyWindowNotElapsed",
  "openStrategyWindowElapsedMissingPrice",
  "openStrategyWindowElapsedInvalidPrice",
  "openStrategyWindowElapsedResolvableHitTp",
  "openStrategyWindowElapsedResolvableHitSl",
  "openStrategyWindowElapsedResolvableExpired",
  "openStrategyManualCloseExcluded",
] as const;

export type StrategyResolutionBucketLabel = (typeof STRATEGY_RESOLUTION_BUCKET_LABELS)[number];

export type StrategyResolutionBucketCounts = Record<StrategyResolutionBucketLabel, number>;

export interface StrategyResolutionDryRunSummary {
  resolvableCount: number;
  hitTp: number;
  hitSl: number;
  expired: number;
  stillMissingPrice: number;
  topMissingSymbols: Array<{ symbol: string; count: number }>;
}

export interface StrategyResolutionAugmentedDryRunSummary extends StrategyResolutionDryRunSummary {
  perSourceBreakdown: {
    pool: number;
    coinwWhitelistedAssumed: number;
  };
}

export interface StrategyResolutionDiagnosticResult {
  locale: Locale;
  poolTsAgeMs: number | null;
  poolSource: string | null;
  poolIsStale: boolean;
  poolError: string | null;
  poolEntryCounts: { majors: number; trending: number; opportunity: number };
  buckets: StrategyResolutionBucketCounts;
  rawRecordsLast1h: number;
  rawStrategyRecordsLast1h: number;
  publicIndexEntriesLast1h: number;
  rawStrategyButNotIndexedCount: number;
  indexWriteFailureSample: string[];
  latestRawRecordCreatedAt: string | null;
  latestPublicIndexCreatedAt: string | null;
  dryRun: {
    baselinePoolOnly: StrategyResolutionDryRunSummary;
    coinwResolverAugmented: StrategyResolutionAugmentedDryRunSummary;
  };
  recentJobErrors: Array<{
    id: string;
    status: PmDecisionJobRecord["status"];
    updatedAt: string;
    lastError: string | null;
  }>;
  lockStatus: {
    strategyReplayTriggerNow: LockSnapshot | null;
  };
  readLimit: number;
  recordsRead: number;
  symbolsRead: number;
  sampleRecordIds: string[];
}

export interface BuildStrategyResolutionDiagnosticOptions {
  locale: Locale;
  readLimit?: number;
  now?: number;
  getPool?: () => Promise<CoinPoolPayload>;
  readRecords?: (limit: number, locale: Locale) => Promise<StrategyDecisionRecord[]>;
  readIndexPage?: (
    locale: Locale,
    options: { page: number; pageSize: number },
  ) => Promise<PublicCardIndexPage>;
  readJobs?: (options: { locale: Locale; limit: number }) => Promise<PmDecisionJobRecord[]>;
  getInstrumentSet?: () => Promise<ReadonlyMap<string, unknown>>;
  checkRuntimeLock?: (key: string) => Promise<LockSnapshot>;
}

export async function buildStrategyResolutionDiagnostic({
  locale,
  readLimit = 500,
  now = Date.now(),
  getPool = getCoinPool,
  readRecords = readAllDecisionRecords,
  readIndexPage = (targetLocale, options) => readPublicCardIndexPage(targetLocale, options),
  readJobs = readPmDecisionJobs,
  getInstrumentSet = getCoinWFuturesInstrumentSet,
  checkRuntimeLock = checkLock,
}: BuildStrategyResolutionDiagnosticOptions): Promise<StrategyResolutionDiagnosticResult> {
  const [poolResult, records, publicIndexPage, jobs, instruments, triggerLock] = await Promise.all([
    settle(getPool),
    readRecords(readLimit, locale),
    readIndexPage(locale, { page: 1, pageSize: 100 }),
    readJobs({ locale, limit: Math.min(readLimit, 100) }),
    getInstrumentSet(),
    checkRuntimeLock(`cron:strategy-replay:trigger-now:${locale}`).catch(() => null),
  ]);

  const pool = poolResult.ok ? poolResult.value : null;
  const priceBySymbol = pool ? priceMapFromPool(pool) : new Map<string, number>();
  const classified = records.map((record) => ({
    record,
    bucket: classifyDecisionRecord(record, now, priceBySymbol),
  }));
  const publicIndexIds = new Set(publicIndexPage.entries.map((entry) => entry.id));
  const rawStrategyRecords = records.filter(isStrategyRecord);
  const latestRawRecordCreatedAt = latestIso(records.map((record) => record.createdAt));
  const latestPublicIndexCreatedAt = latestIso(
    publicIndexPage.entries.map((entry) => entry.createdAt),
  );

  return {
    locale,
    poolTsAgeMs: pool ? Math.max(0, now - pool.ts) : null,
    poolSource: pool?.source ?? null,
    poolIsStale: Boolean(pool?.isStale),
    poolError: poolResult.ok ? (pool?.error ?? null) : poolResult.error,
    poolEntryCounts: {
      majors: pool?.majors.length ?? 0,
      trending: pool?.trending.length ?? 0,
      opportunity: pool?.opportunity.length ?? 0,
    },
    buckets: bucketCounts(classified.map((item) => item.bucket)),
    rawRecordsLast1h: countRecent(records, now),
    rawStrategyRecordsLast1h: countRecent(rawStrategyRecords, now),
    publicIndexEntriesLast1h: countRecent(publicIndexPage.entries, now),
    rawStrategyButNotIndexedCount: rawStrategyRecords.filter(
      (record) => !publicIndexIds.has(publicIndexIdForRecord(record)),
    ).length,
    indexWriteFailureSample: rawStrategyRecords
      .filter((record) => !publicIndexIds.has(publicIndexIdForRecord(record)))
      .slice(0, 10)
      .map((record) => record.id),
    latestRawRecordCreatedAt,
    latestPublicIndexCreatedAt,
    dryRun: buildDryRun(classified, instruments),
    recentJobErrors: jobs
      .filter((job) => job.status === "failed" || Boolean(job.lastError))
      .slice(0, 10)
      .map((job) => ({
        id: job.id,
        status: job.status,
        updatedAt: job.updatedAt,
        lastError: job.lastError,
      })),
    lockStatus: {
      strategyReplayTriggerNow: triggerLock,
    },
    readLimit,
    recordsRead: records.length,
    symbolsRead: new Set(records.map((record) => normalizeSymbol(record.symbol))).size,
    sampleRecordIds: records.slice(0, 10).map((record) => record.id),
  };
}

export function classifyDecisionRecord(
  record: StrategyDecisionRecord,
  now: number,
  priceBySymbol: ReadonlyMap<string, number | null | undefined>,
): StrategyResolutionBucketLabel {
  if (
    record.resolvedOutcome === "manual_close" ||
    record.resolutionReason === "manual_close_requested"
  ) {
    return "openStrategyManualCloseExcluded";
  }
  if (record.resolvedAt || record.resolvedOutcome) return "alreadyResolved";

  const decision = directionalTradeDecision(record.tradeDecision);
  if (!decision) return "openNoTradeDecision";

  const windowEndsAt = parseIsoMs(record.evaluationWindowEndsAt);
  if (windowEndsAt === null) return "openStrategyNoEvaluationWindow";
  if (windowEndsAt > now) return "openStrategyWindowNotElapsed";

  const symbol = normalizeSymbol(decision.symbol || record.symbol);
  const observedPrice = priceBySymbol.get(symbol);
  if (observedPrice === undefined || observedPrice === null) {
    return "openStrategyWindowElapsedMissingPrice";
  }
  if (!Number.isFinite(observedPrice) || observedPrice <= 0) {
    return "openStrategyWindowElapsedInvalidPrice";
  }

  const resolution = evaluateDecisionResolution(record, observedPrice, now, "coinw-kline");
  if (resolution?.outcome === "hit_tp") return "openStrategyWindowElapsedResolvableHitTp";
  if (resolution?.outcome === "hit_sl") return "openStrategyWindowElapsedResolvableHitSl";
  return "openStrategyWindowElapsedResolvableExpired";
}

function buildDryRun(
  classified: Array<{ record: StrategyDecisionRecord; bucket: StrategyResolutionBucketLabel }>,
  instruments: ReadonlyMap<string, unknown>,
) {
  const baseline: StrategyResolutionDryRunSummary = {
    resolvableCount: countBuckets(classified, [
      "openStrategyWindowElapsedResolvableHitTp",
      "openStrategyWindowElapsedResolvableHitSl",
      "openStrategyWindowElapsedResolvableExpired",
    ]),
    hitTp: countBuckets(classified, ["openStrategyWindowElapsedResolvableHitTp"]),
    hitSl: countBuckets(classified, ["openStrategyWindowElapsedResolvableHitSl"]),
    expired: countBuckets(classified, ["openStrategyWindowElapsedResolvableExpired"]),
    stillMissingPrice: countBuckets(classified, ["openStrategyWindowElapsedMissingPrice"]),
    topMissingSymbols: topMissingSymbols(classified, () => true),
  };
  const missingRecords = classified.filter(
    (item) => item.bucket === "openStrategyWindowElapsedMissingPrice",
  );
  const coinwWhitelistedAssumed = missingRecords.filter((item) =>
    instruments.has(normalizeSymbol(item.record.tradeDecision?.symbol ?? item.record.symbol)),
  ).length;
  const stillMissingPrice = missingRecords.length - coinwWhitelistedAssumed;

  return {
    baselinePoolOnly: baseline,
    coinwResolverAugmented: {
      resolvableCount: baseline.resolvableCount + coinwWhitelistedAssumed,
      hitTp: baseline.hitTp,
      hitSl: baseline.hitSl,
      expired: baseline.expired,
      stillMissingPrice,
      perSourceBreakdown: {
        pool: baseline.resolvableCount,
        coinwWhitelistedAssumed,
      },
      topMissingSymbols: topMissingSymbols(classified, (record) => {
        const symbol = normalizeSymbol(record.tradeDecision?.symbol ?? record.symbol);
        return !instruments.has(symbol);
      }),
    },
  };
}

function countBuckets(
  classified: Array<{ bucket: StrategyResolutionBucketLabel }>,
  labels: StrategyResolutionBucketLabel[],
) {
  const labelSet = new Set(labels);
  return classified.filter((item) => labelSet.has(item.bucket)).length;
}

function topMissingSymbols(
  classified: Array<{ record: StrategyDecisionRecord; bucket: StrategyResolutionBucketLabel }>,
  includeRecord: (record: StrategyDecisionRecord) => boolean,
) {
  const counts = new Map<string, number>();
  for (const { record, bucket } of classified) {
    if (bucket !== "openStrategyWindowElapsedMissingPrice" || !includeRecord(record)) continue;
    const symbol = normalizeSymbol(record.tradeDecision?.symbol ?? record.symbol);
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([symbol, count]) => ({ symbol, count }));
}

function bucketCounts(labels: StrategyResolutionBucketLabel[]): StrategyResolutionBucketCounts {
  const counts = Object.fromEntries(
    STRATEGY_RESOLUTION_BUCKET_LABELS.map((label) => [label, 0]),
  ) as StrategyResolutionBucketCounts;
  for (const label of labels) counts[label] += 1;
  return counts;
}

function priceMapFromPool(pool: CoinPoolPayload) {
  const prices = new Map<string, number>();
  for (const [symbol, ticker] of Object.entries(pool.tickers)) {
    if (Number.isFinite(ticker.price)) prices.set(normalizeSymbol(symbol), ticker.price);
  }
  for (const entry of [...pool.majors, ...pool.trending, ...pool.opportunity]) {
    if (Number.isFinite(entry.price)) prices.set(normalizeSymbol(entry.symbol), entry.price);
  }
  return prices;
}

function isStrategyRecord(record: StrategyDecisionRecord) {
  return Boolean(directionalTradeDecision(record.tradeDecision));
}

function directionalTradeDecision(
  decision: TradeDecision | null | undefined,
): TradeDecision | null {
  if (!decision) return null;
  return decision.direction === "long" || decision.direction === "short" ? decision : null;
}

function countRecent(items: Array<{ createdAt?: string }>, now: number) {
  const cutoff = now - 60 * 60_000;
  return items.filter((item) => {
    const createdAt = parseIsoMs(item.createdAt ?? null);
    return createdAt !== null && createdAt >= cutoff;
  }).length;
}

function latestIso(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => typeof value === "string")
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  );
}

function publicIndexIdForRecord(record: StrategyDecisionRecord) {
  return `pm-decision:${record.id}`;
}

function parseIsoMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(value: string) {
  return value
    .trim()
    .replace(/^\$+/, "")
    .replace(/_?USDT$/i, "")
    .toUpperCase();
}

async function settle<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
