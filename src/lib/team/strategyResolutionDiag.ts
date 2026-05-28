import { getCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import { getCoinPool } from "@/lib/marketDataCache";
import {
  getNewsSourceHealthSnapshot,
  type NewsSourceHealthSnapshot,
} from "@/lib/news/sourceHealth";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { readDecisionRuns, type DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import { evaluateDecisionResolution } from "@/lib/team/decisionResolution";
import {
  readProviderTelemetryCalls,
  type ProviderCallTelemetry,
} from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { checkLock, type LockSnapshot } from "@/lib/storage/kv-lock";
import { readPmDecisionJobs, type PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import {
  readPublicCardIndexPage,
  readPublicCardIndexWriteFailureMarkers,
  type PublicCardIndexPage,
  type PublicCardIndexWriteFailureMarker,
} from "@/lib/watch/publicCardIndex";
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

export interface StrategyCronHealthTrace {
  lastCronInvocations: Array<{
    source: "pm_job" | "decision_run" | "strategy_record";
    id: string;
    status: string;
    observedAt: string;
    completedAt: string | null;
    candidateKey: string | null;
    symbol: string | null;
    outputCount: number | null;
    error: string | null;
  }>;
  providerHealthLast24h: {
    totalCalls: number;
    simplePipelineCalls: number;
    successCalls: number;
    failureCalls: number;
    latestAt: string | null;
    providerCounts: Record<string, number>;
    attemptedProviderCounts: Record<string, number>;
    errorSamples: string[];
  };
  klinePipelineHealth: {
    poolSource: string | null;
    poolIsStale: boolean;
    poolError: string | null;
    poolAgeMs: number | null;
    tickerCount: number;
    signalSymbols: string[];
    signalSymbolCount: number;
    poolSymbolCount: number;
    recordsMissingPrice: number;
    topMissingPriceSymbols: Array<{ symbol: string; count: number }>;
  };
  newsInputHealth: {
    configuredSources: number;
    availableSources: number;
    activeFetchChainSources: string[];
    missingEnvSources: string[];
    recentJobNewsItemCount: number;
    recentJobNewsDrivenCount: number;
  };
  stagesWriteRatio: {
    rawRecordCount: number;
    rawStrategyRecordCount: number;
    publicIndexEntryCount: number;
    rawRecordsLast1h: number;
    rawStrategyRecordsLast1h: number;
    publicIndexEntriesLast1h: number;
    rawStrategyToRawRatio: number;
    publicIndexToRawStrategyRatio: number;
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
  cronHealthTrace: StrategyCronHealthTrace;
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
  readIndexFailures?: (
    locale: Locale,
    options: { limit: number },
  ) => Promise<PublicCardIndexWriteFailureMarker[]>;
  readJobs?: (options: { locale: Locale; limit: number }) => Promise<PmDecisionJobRecord[]>;
  readRuns?: (options: { locale: Locale; limit: number }) => Promise<DecisionRunRecord[]>;
  readProviderCalls?: (options: {
    since?: number;
    limit?: number;
  }) => Promise<ProviderCallTelemetry[]>;
  getNewsHealth?: () => NewsSourceHealthSnapshot[];
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
  readIndexFailures = (targetLocale, options) =>
    readPublicCardIndexWriteFailureMarkers(targetLocale, options),
  readJobs = readPmDecisionJobs,
  readRuns = readDecisionRuns,
  readProviderCalls = readProviderTelemetryCalls,
  getNewsHealth = getNewsSourceHealthSnapshot,
  getInstrumentSet = getCoinWFuturesInstrumentSet,
  checkRuntimeLock = checkLock,
}: BuildStrategyResolutionDiagnosticOptions): Promise<StrategyResolutionDiagnosticResult> {
  const [
    poolResult,
    records,
    publicIndexPage,
    indexFailureMarkers,
    jobs,
    runs,
    providerCalls,
    newsHealth,
    instruments,
    triggerLock,
  ] = await Promise.all([
    settle(getPool),
    readRecords(readLimit, locale),
    readIndexPage(locale, { page: 1, pageSize: 100 }),
    readIndexFailures(locale, { limit: 100 }).catch(() => []),
    readJobs({ locale, limit: Math.min(readLimit, 100) }),
    readRuns({ locale, limit: Math.min(readLimit, 100) }).catch(() => []),
    readProviderCalls({ since: now - 24 * 60 * 60_000, limit: 500 }).catch(() => []),
    Promise.resolve()
      .then(getNewsHealth)
      .catch(() => []),
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
  const rawStrategyButNotIndexed = rawStrategyRecords.filter(
    (record) => !publicIndexIds.has(publicIndexIdForRecord(record)),
  );
  const indexFailureMarkerSample = indexFailureMarkers
    .map((marker) => marker.recordId)
    .filter(Boolean);
  const latestRawRecordCreatedAt = latestIso(records.map((record) => record.createdAt));
  const latestPublicIndexCreatedAt = latestIso(
    publicIndexPage.entries.map((entry) => entry.createdAt),
  );
  const rawRecordsLast1h = countRecent(records, now);
  const rawStrategyRecordsLast1h = countRecent(rawStrategyRecords, now);
  const publicIndexEntriesLast1h = countRecent(publicIndexPage.entries, now);
  const dryRun = buildDryRun(classified, instruments);

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
    rawRecordsLast1h,
    rawStrategyRecordsLast1h,
    publicIndexEntriesLast1h,
    rawStrategyButNotIndexedCount: rawStrategyButNotIndexed.length,
    indexWriteFailureSample: (indexFailureMarkerSample.length
      ? indexFailureMarkerSample
      : rawStrategyButNotIndexed.map((record) => record.id)
    ).slice(0, 10),
    latestRawRecordCreatedAt,
    latestPublicIndexCreatedAt,
    dryRun,
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
    cronHealthTrace: buildCronHealthTrace({
      records,
      rawStrategyRecords,
      publicIndexPage,
      rawRecordsLast1h,
      rawStrategyRecordsLast1h,
      publicIndexEntriesLast1h,
      jobs,
      runs,
      providerCalls,
      newsHealth,
      pool,
      poolResult,
      now,
      dryRun,
    }),
    readLimit,
    recordsRead: records.length,
    symbolsRead: new Set(records.map((record) => normalizeSymbol(record.symbol))).size,
    sampleRecordIds: records.slice(0, 10).map((record) => record.id),
  };
}

function buildCronHealthTrace({
  records,
  rawStrategyRecords,
  publicIndexPage,
  rawRecordsLast1h,
  rawStrategyRecordsLast1h,
  publicIndexEntriesLast1h,
  jobs,
  runs,
  providerCalls,
  newsHealth,
  pool,
  poolResult,
  now,
  dryRun,
}: {
  records: StrategyDecisionRecord[];
  rawStrategyRecords: StrategyDecisionRecord[];
  publicIndexPage: PublicCardIndexPage;
  rawRecordsLast1h: number;
  rawStrategyRecordsLast1h: number;
  publicIndexEntriesLast1h: number;
  jobs: PmDecisionJobRecord[];
  runs: DecisionRunRecord[];
  providerCalls: ProviderCallTelemetry[];
  newsHealth: NewsSourceHealthSnapshot[];
  pool: CoinPoolPayload | null;
  poolResult: { ok: true; value: CoinPoolPayload } | { ok: false; error: string };
  now: number;
  dryRun: ReturnType<typeof buildDryRun>;
}): StrategyCronHealthTrace {
  const simplePipelineCalls = providerCalls.filter((call) =>
    call.taskTag.startsWith("watch:simple-pipeline"),
  );
  const signalSymbols = Object.entries(pool?.signals ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([symbol]) => normalizeSymbol(symbol))
    .sort();
  const poolSymbols = new Set(
    [...(pool?.majors ?? []), ...(pool?.trending ?? []), ...(pool?.opportunity ?? [])].map(
      (entry) => normalizeSymbol(entry.symbol),
    ),
  );
  const recentJobs = jobs.filter((job) => countRecent([job], now) > 0);

  return {
    lastCronInvocations: buildLastCronInvocations({ jobs, runs, records }),
    providerHealthLast24h: {
      totalCalls: providerCalls.length,
      simplePipelineCalls: simplePipelineCalls.length,
      successCalls: providerCalls.filter((call) => call.success).length,
      failureCalls: providerCalls.filter((call) => !call.success).length,
      latestAt: latestIso(providerCalls.map((call) => new Date(call.ts).toISOString())),
      providerCounts: countStringValues(
        providerCalls.flatMap((call) => (call.finalProvider ? [call.finalProvider] : [])),
      ),
      attemptedProviderCounts: countStringValues(
        providerCalls.flatMap((call) => call.attemptedProviders),
      ),
      errorSamples: providerCalls
        .flatMap((call) => (call.error ? [redactDiagnosticError(call.error)] : []))
        .slice(0, 10),
    },
    klinePipelineHealth: {
      poolSource: pool?.source ?? null,
      poolIsStale: Boolean(pool?.isStale),
      poolError: poolResult.ok ? (pool?.error ?? null) : poolResult.error,
      poolAgeMs: pool ? Math.max(0, now - pool.ts) : null,
      tickerCount: Object.keys(pool?.tickers ?? {}).length,
      signalSymbols,
      signalSymbolCount: signalSymbols.length,
      poolSymbolCount: poolSymbols.size,
      recordsMissingPrice: dryRun.baselinePoolOnly.stillMissingPrice,
      topMissingPriceSymbols: dryRun.baselinePoolOnly.topMissingSymbols,
    },
    newsInputHealth: {
      configuredSources: newsHealth.length,
      availableSources: newsHealth.filter((source) => source.availableByConfig).length,
      activeFetchChainSources: newsHealth
        .filter((source) => source.inFetchChain)
        .sort((a, b) => (a.fetchChainRank ?? 999) - (b.fetchChainRank ?? 999))
        .map((source) => source.id),
      missingEnvSources: newsHealth
        .filter((source) => source.unavailableReason === "missing_env")
        .map((source) => source.id),
      recentJobNewsItemCount: recentJobs.reduce(
        (total, job) => total + (job.newsItems?.length ?? 0),
        0,
      ),
      recentJobNewsDrivenCount: recentJobs.filter((job) =>
        job.candidate?.candidateKey.startsWith("news-driven:"),
      ).length,
    },
    stagesWriteRatio: {
      rawRecordCount: records.length,
      rawStrategyRecordCount: rawStrategyRecords.length,
      publicIndexEntryCount: publicIndexPage.totalCount,
      rawRecordsLast1h,
      rawStrategyRecordsLast1h,
      publicIndexEntriesLast1h,
      rawStrategyToRawRatio: ratio(rawStrategyRecords.length, records.length),
      publicIndexToRawStrategyRatio: ratio(publicIndexPage.totalCount, rawStrategyRecords.length),
    },
  };
}

function buildLastCronInvocations({
  jobs,
  runs,
  records,
}: {
  jobs: PmDecisionJobRecord[];
  runs: DecisionRunRecord[];
  records: StrategyDecisionRecord[];
}): StrategyCronHealthTrace["lastCronInvocations"] {
  const invocations: StrategyCronHealthTrace["lastCronInvocations"] = [
    ...jobs
      .filter((job) => job.triggerSource === "cron")
      .map((job) => ({
        source: "pm_job" as const,
        id: job.id,
        status: job.status,
        observedAt: job.createdAt,
        completedAt: job.completedAt,
        candidateKey: job.candidate?.candidateKey ?? null,
        symbol: job.symbol ?? job.candidate?.symbol ?? null,
        outputCount: job.outputCount,
        error: job.lastError ? redactDiagnosticError(job.lastError) : null,
      })),
    ...runs
      .filter((run) => run.triggerSource === "cron")
      .map((run) => ({
        source: "decision_run" as const,
        id: run.id,
        status: run.status,
        observedAt: run.startedAt,
        completedAt: run.completedAt,
        candidateKey: run.candidate?.candidateKey ?? null,
        symbol: run.symbol ?? run.candidate?.symbol ?? null,
        outputCount: run.decisionRecordId ? 1 : 0,
        error: run.error ? redactDiagnosticError(run.error) : null,
      })),
    ...records.slice(0, 20).map((record) => ({
      source: "strategy_record" as const,
      id: record.id,
      status: isStrategyRecord(record) ? "strategy_record_written" : "raw_record_written",
      observedAt: record.createdAt,
      completedAt: record.resolvedAt ?? null,
      candidateKey: record.candidate?.candidateKey ?? null,
      symbol: record.symbol,
      outputCount: isStrategyRecord(record) ? 1 : 0,
      error: null,
    })),
  ];
  return invocations
    .filter((item) => Number.isFinite(Date.parse(item.observedAt)))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || a.id.localeCompare(b.id))
    .slice(0, 10);
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

function countStringValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function redactDiagnosticError(error: string) {
  return error
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, "sk-[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b((?:api[_-]?key|token|secret)=)[^\s&]+/gi, "$1[redacted]")
    .slice(0, 320);
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
