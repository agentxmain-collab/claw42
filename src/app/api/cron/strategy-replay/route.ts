import { NextResponse, type NextRequest } from "next/server";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsFromAllSources, fetchNewsWithChain } from "@/lib/news/sourceChain";
import { buildNewsDrivenCandidates } from "@/lib/news/symbolExtractor";
import { resolveCurrentPricesForOpenStrategies } from "@/lib/coinw/futuresPrices";
import { resolvePipelineMode } from "@/app/api/cron/strategy-replay/pipelineMode";
import { getNewsSourceHealthSnapshot } from "@/lib/news/sourceHealth";
import { tryOrchestrateNewsDebate, listNewsDebates } from "@/lib/debateOrchestrator";
import { getCoinPool } from "@/lib/marketDataCache";
import { adjustDebtFromReplays } from "@/lib/agentRelationship";
import { evaluateStrategy, recordStrategyReplay } from "@/lib/strategyHistory";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import {
  getDecisionRecordStoreDiagnostics,
  getLastDecisionRecordWriteDiagnostics,
  readAllDecisionRecords,
} from "@/lib/team/decisionRecordStore";
import { readDecisionRuns } from "@/lib/team/decisionRunLedger";
import { resolveDecisionRecordFromPrice } from "@/lib/team/decisionResolution";
import {
  summarizeProviderTelemetry,
  warnIfSingleProviderConcentration,
} from "@/lib/team/providerTelemetry";
import { publishPmDecisionJobToQueue } from "@/lib/team/pmDecisionJobQueue";
import { runPmDecisionJob } from "@/lib/team/pmDecisionJobRunner";
import { runSimplePipeline, SIMPLE_PIPELINE_CARDS_PER_RUN } from "@/lib/team/simplePipeline";
import {
  CRON_MAX_SYMBOL_CARDS_PER_RUN,
  type PmDecisionTriggerAuditEvent,
} from "@/lib/team/pmDecisionTrigger";
import { enqueuePmDecisionJob, readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { residentPrewarmPlan } from "@/lib/watch/residentPrewarm";
import { LEGACY_WATCH_LOCALE, localeFromRequestUrl } from "@/lib/watch/locale";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import { isPublicDisplayablePmDecisionEvent } from "@/lib/watch/publicPmDecisionDisplay";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const STRATEGY_REPLAY_TRIGGER_LOCK_KEY = "cron:strategy-replay:trigger-now";
const STRATEGY_REPLAY_TRIGGER_LOCK_MS = 5 * 60_000;
const PM_RESOLUTION_RECORD_LIMIT = 100;
const INLINE_PM_DECISION_JOB_LIMIT = CRON_MAX_SYMBOL_CARDS_PER_RUN;
const MANUAL_TRIGGER_INLINE_PM_DECISION_JOB_LIMIT = 1;
const STRATEGY_REPLAY_DEFAULT_LOCALE = LEGACY_WATCH_LOCALE;

function isAuthorized(request: NextRequest) {
  if (process.env.VERCEL_ENV === "preview") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

function normalizeResolutionSymbol(symbol: unknown) {
  if (typeof symbol !== "string") return null;
  const normalized = normalizeMarketSymbol(symbol);
  return normalized && normalized !== "UNKNOWN" ? normalized : null;
}

function localeFromStrategyReplayRequest(request: NextRequest) {
  if (request.nextUrl.searchParams.has("locale")) {
    return localeFromRequestUrl(request.nextUrl, request.headers.get("accept-language"));
  }
  return STRATEGY_REPLAY_DEFAULT_LOCALE;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const trigger = request.nextUrl.searchParams.get("trigger");
  const locale = localeFromStrategyReplayRequest(request);
  const triggerLockKey = `${STRATEGY_REPLAY_TRIGGER_LOCK_KEY}:${locale}`;
  const triggerLock =
    trigger === "now"
      ? await tryAcquireLock(triggerLockKey, {
          ttlMs: STRATEGY_REPLAY_TRIGGER_LOCK_MS,
          waitMs: 0,
        })
      : null;
  if (trigger === "now" && !triggerLock) {
    return NextResponse.json({
      ok: true,
      skipped: "strategy-replay trigger already ran within 5 minutes",
      trigger,
      servedAt: Date.now(),
    });
  }

  const now = Date.now();
  const pipelineMode = resolvePipelineMode();
  const { items, servedBy, fellBackFrom } = await fetchNewsWithChain({ limit: 8 });
  const newsDrivenSourceResult = await fetchNewsFromAllSources({ limitPerSource: 4 }).catch(() => ({
    items: [],
    fellBackFrom: [],
  }));
  const debates = [];
  const normalizedItems: NewsItem[] = [];

  for (const item of items) {
    const normalizedItem = await normalizeNewsItem(item, servedBy);
    normalizedItems.push(normalizedItem);
    if (pipelineMode !== "full") continue;
    let debate: Awaited<ReturnType<typeof tryOrchestrateNewsDebate>> = null;
    try {
      debate = await tryOrchestrateNewsDebate(normalizedItem, now + debates.length * 1000);
    } catch (error) {
      console.warn("[claw42] news debate orchestration skipped", {
        newsId: normalizedItem.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (!debate) continue;
    debates.push(debate);
    if (debates.length >= 2) break;
  }
  const normalizedNewsDrivenItems =
    newsDrivenSourceResult.items.length > 0
      ? await Promise.all(
          newsDrivenSourceResult.items.map(({ item, sourceId }) =>
            normalizeNewsItem(item, sourceId).catch(() => item),
          ),
        )
      : [];

  const pool = await getCoinPool();
  const decisionRecordRead = await readCronDecisionRecords(locale);
  const decisionRecords = decisionRecordRead.records;
  const pmDecisionJobs = await readPmDecisionJobs({ locale, limit: 100 }).catch(() => []);
  const resolvedPmDecisions = await resolveOpenPmDecisions(pool, decisionRecords, now);
  const replayed = [];

  if (pipelineMode === "full") {
    for (const debate of listNewsDebates(20)) {
      const strategy = debate.finalStrategy;
      if (!strategy || strategy.direction === "wait") continue;
      const ticker = [...pool.majors, ...pool.trending, ...pool.opportunity].find(
        (item) => item.symbol.toUpperCase() === strategy.symbol.toUpperCase(),
      );
      if (!ticker) continue;
      const entryPrice =
        strategy.stopLoss > 0 ? (strategy.stopLoss + ticker.price) / 2 : ticker.price;
      const replay = evaluateStrategy(strategy, entryPrice, ticker.price, now);
      await recordStrategyReplay(replay);
      replayed.push(replay);
    }
    await adjustDebtFromReplays(replayed, now).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] relationship debt adjustment skipped", error);
      }
    });
  }
  const pmDecisionAudit: PmDecisionTriggerAuditEvent[] = [];
  const pmPartialStageUpdates = true;
  const newsDrivenCandidates = await buildNewsDrivenCandidates({
    newsItems: normalizedNewsDrivenItems,
    now,
    limit: pipelineMode === "simple" ? SIMPLE_PIPELINE_CARDS_PER_RUN : INLINE_PM_DECISION_JOB_LIMIT,
  });

  if (pipelineMode === "simple") {
    const simpleResult = await runSimplePipeline({
      locale,
      now,
      pool,
      newsItems: normalizedItems,
      newsDrivenCandidates,
    });
    return NextResponse.json({
      ok: true,
      pipelineMode,
      servedBy,
      fellBackFrom,
      generatedDebates: debates.length,
      locale,
      simplePipeline: {
        generatedRecords: simpleResult.generatedRecords.length,
        skippedCandidates: simpleResult.skippedCandidates.length,
        candidateKeys: simpleResult.candidateKeys,
        llmDiagnostics: shouldExposeSimplePipelineDiagnostics(trigger)
          ? simpleResult.llmDiagnostics
          : undefined,
      },
      newsDriven: {
        attemptedCandidateKeys: newsDrivenCandidates.map((item) => item.candidate.candidateKey),
        generated: simpleResult.generatedRecords.filter(
          (record) => record.candidate?.candidateType === "symbol",
        ).length,
        queued: 0,
        sourceItemCount: newsDrivenSourceResult.items.length,
        sourceFallbacks: newsDrivenSourceResult.fellBackFrom,
      },
      resolvedPmDecisions,
      replayed: replayed.length,
      trigger,
      triggerLockAcquiredAt: triggerLock?.acquiredAt ?? null,
      servedAt: now,
    });
  }

  const residentPlan = residentPrewarmPlan({
    locale,
    now,
    pool,
    newsItems: normalizedItems,
    force: trigger === "now",
    records: decisionRecords,
    jobs: pmDecisionJobs,
    allowFirstFillBackfill: decisionRecordRead.readable,
  });
  const residentCandidates = residentPlan.candidates;
  const newsDrivenResults = [];
  const residentPrewarmResults = [];
  const inlineDeferredCandidateKeys: string[] = [];
  let inlinePmDecisionJobs = 0;
  const inlineJobLimit =
    trigger === "now" ? MANUAL_TRIGGER_INLINE_PM_DECISION_JOB_LIMIT : INLINE_PM_DECISION_JOB_LIMIT;
  const inlineLimitReached = () => inlinePmDecisionJobs >= inlineJobLimit;
  const trackInlineUsage = (result: DispatchPmDecisionJobResult) => {
    if (shouldSpendInlineSlot(result)) {
      inlinePmDecisionJobs += 1;
    }
  };
  type DispatchPlanItem =
    | { kind: "news-driven"; candidate: DecisionCandidate; newsItem: NewsItem }
    | { kind: "resident-prewarm"; candidate: DecisionCandidate };
  const newsDrivenDispatchPlan: DispatchPlanItem[] = newsDrivenCandidates.map(
    ({ candidate, newsItem }) => ({
      kind: "news-driven",
      candidate,
      newsItem,
    }),
  );
  const residentPrewarmDispatchPlan: DispatchPlanItem[] = residentCandidates.map((candidate) => ({
    kind: "resident-prewarm",
    candidate,
  }));
  // Scheduled cron remains news-first. Manual preview verification is resident-first and bounded
  // so one trigger cannot spend the full serverless window on many sequential PM jobs.
  const dispatchPlan =
    trigger === "now"
      ? [...residentPrewarmDispatchPlan, ...newsDrivenDispatchPlan]
      : [...newsDrivenDispatchPlan, ...residentPrewarmDispatchPlan];

  for (const item of dispatchPlan) {
    if (inlineLimitReached()) {
      inlineDeferredCandidateKeys.push(item.candidate.candidateKey);
      continue;
    }
    const result =
      item.kind === "news-driven"
        ? await dispatchPmDecisionJob({
            kind: "once",
            triggerSource: "cron",
            locale,
            now,
            candidate: item.candidate,
            pool,
            newsItems: [item.newsItem],
            persistNewsItems: [item.newsItem],
            partialStageUpdates: pmPartialStageUpdates,
            useQueue: trigger !== "now",
            onAudit: (event) => pmDecisionAudit.push(event),
          })
        : await dispatchPmDecisionJob({
            kind: "once",
            triggerSource: "cron",
            locale,
            now,
            candidate: item.candidate,
            pool,
            newsItems: normalizedItems,
            partialStageUpdates: pmPartialStageUpdates,
            useQueue: trigger !== "now",
            onAudit: (event) => pmDecisionAudit.push(event),
          });
    if (item.kind === "news-driven") {
      newsDrivenResults.push(result);
    } else {
      residentPrewarmResults.push(result);
    }
    trackInlineUsage(result);
  }

  const batchResult = inlineLimitReached()
    ? null
    : await dispatchPmDecisionJob({
        kind: trigger === "now" ? "once" : "batch",
        triggerSource: trigger === "now" ? "user_visit_trigger" : "cron",
        locale,
        now,
        pool,
        newsItems: normalizedItems,
        partialStageUpdates: pmPartialStageUpdates,
        useQueue: trigger !== "now",
        onAudit: (event) => pmDecisionAudit.push(event),
      });
  if (batchResult) trackInlineUsage(batchResult);
  const pmDecisionOutputs = [
    ...newsDrivenResults.flatMap((result) => result.outputs),
    ...residentPrewarmResults.flatMap((result) => result.outputs),
    ...(batchResult?.outputs ?? []),
  ];
  const visiblePmDecisionOutputs = pmDecisionOutputs.filter(isPublicPmDecisionOutput);
  const hiddenPmDecisionOutputs = pmDecisionOutputs.length - visiblePmDecisionOutputs.length;
  const providerTelemetry = summarizeProviderTelemetry({ since: now });
  await warnIfSingleProviderConcentration(providerTelemetry);
  const decisionRecordDiagnostics = await buildCronDecisionRecordDiagnostics(
    locale,
    pmDecisionOutputs,
  );
  const decisionRunDiagnostics =
    trigger === "now" ? await buildCronDecisionRunDiagnostics(locale) : undefined;

  return NextResponse.json({
    ok: true,
    pipelineMode,
    servedBy,
    fellBackFrom,
    generatedDebates: debates.length,
    locale,
    pmDecisionGenerated: visiblePmDecisionOutputs.length > 0,
    generatedPmDecisions: visiblePmDecisionOutputs.length,
    generatedHiddenPmDecisions: hiddenPmDecisionOutputs,
    pmPartialStageUpdates,
    pmDecisionJobId: batchResult?.job.id ?? null,
    pmDecisionJobStatus: batchResult?.jobResult?.job.status ?? batchResult?.job.status ?? null,
    pmDecisionQueueMode: batchResult?.queueResult.mode ?? "deferred_inline_limit",
    pmDecisionQueueMessageId:
      batchResult?.queueResult.mode === "queue" ? batchResult.queueResult.messageId : undefined,
    pmDecisionInlineLimit: {
      limit: inlineJobLimit,
      used: inlinePmDecisionJobs,
      deferredResidentCandidateKeys: inlineDeferredCandidateKeys,
      deferredBatch: batchResult === null,
    },
    newsDriven: {
      attemptedCandidateKeys: newsDrivenCandidates.map((item) => item.candidate.candidateKey),
      generated: newsDrivenResults.reduce(
        (total, result) => total + result.outputs.filter(isPublicPmDecisionOutput).length,
        0,
      ),
      queued: newsDrivenResults.filter((result) => result.queueResult.mode === "queue").length,
      sourceItemCount: newsDrivenSourceResult.items.length,
      sourceFallbacks: newsDrivenSourceResult.fellBackFrom,
    },
    residentPrewarmCandidates: residentCandidates.map((candidate) => candidate.candidateKey),
    residentPrewarmAttempts: residentPrewarmResults.map((result) =>
      residentPrewarmAttemptTelemetry(result, residentPlan, locale),
    ),
    residentPrewarmFixedCadenceCandidates: residentPlan.fixedCadenceCandidateKeys,
    residentPrewarmBackfillCandidates: residentPlan.backfillCandidateKeys,
    residentPrewarmBurst: {
      threshold: residentPlan.burstThreshold,
      candidateKey: residentPlan.burstCandidateKey,
      score: residentPlan.burstScore,
      triggered: residentPlan.burstCandidateKey !== null,
    },
    residentPrewarmSla: residentPlan.residentStatus,
    residentPrewarmGenerated: residentPrewarmResults.reduce(
      (total, result) => total + result.outputs.filter(isPublicPmDecisionOutput).length,
      0,
    ),
    residentPrewarmQueued: residentPrewarmResults.filter(
      (result) => result.queueResult.mode === "queue",
    ).length,
    residentPrewarmJobIds: residentPrewarmResults.map((result) => result.job.id),
    pmDecisionAudit: trigger === "now" ? pmDecisionAudit : undefined,
    providerTelemetry: trigger === "now" ? providerTelemetry : undefined,
    newsSourceHealth: trigger === "now" ? getNewsSourceHealthSnapshot() : undefined,
    decisionRecordDiagnostics,
    decisionRunDiagnostics,
    resolvedPmDecisions,
    replayed: replayed.length,
    trigger,
    triggerLockAcquiredAt: triggerLock?.acquiredAt ?? null,
    servedAt: now,
  });
}

function shouldExposeSimplePipelineDiagnostics(trigger: string | null) {
  return trigger === "now" && process.env.VERCEL_ENV !== "production";
}

async function buildCronDecisionRunDiagnostics(locale: ReturnType<typeof localeFromRequestUrl>) {
  try {
    const runs = await readDecisionRuns({ locale, limit: 8 });
    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      triggerSource: run.triggerSource,
      candidateType: run.candidate?.candidateType ?? null,
      candidateKey: run.candidate?.candidateKey ?? null,
      symbol: run.symbol,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      skipReason: run.skipReason ?? null,
      error: redactDecisionRunError(run.error),
      stageStatus: run.stageStatus,
      analystRoundCount: run.analystRoundCount,
      decisionRecordId: run.decisionRecordId ?? null,
      publicTimelineEventId: run.publicTimelineEventId ?? null,
      quality: run.quality
        ? {
            score: run.quality.score,
            publishable: run.quality.publishable,
            warnings: run.quality.warnings,
            blockingWarnings: run.quality.blockingWarnings,
          }
        : null,
    }));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function redactDecisionRunError(error: string | null | undefined) {
  if (!error) return null;
  return error
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, "sk-[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b((?:api[_-]?key|token|secret)=)[^\s&]+/gi, "$1[redacted]")
    .slice(0, 320);
}

async function buildCronDecisionRecordDiagnostics(
  locale: ReturnType<typeof localeFromRequestUrl>,
  outputs: DispatchPmDecisionJobResult["outputs"],
) {
  try {
    const recordIds = outputs.map((output) => output.record.id).filter(Boolean);
    const symbols = outputs
      .flatMap((output) => [
        output.record.symbol,
        output.publicTimelineEntry.payload.kind === "pm_decision"
          ? output.publicTimelineEntry.payload.symbol
          : null,
      ])
      .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0);
    return {
      ...(await getDecisionRecordStoreDiagnostics({
        locale,
        symbols,
        recordIds,
        limit: 20,
      })),
      decisionRecordWriteResult: getLastDecisionRecordWriteDiagnostics(),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      decisionRecordWriteResult: getLastDecisionRecordWriteDiagnostics(),
    };
  }
}

async function dispatchPmDecisionJob({
  kind,
  triggerSource,
  locale,
  now,
  candidate,
  pool,
  newsItems,
  persistNewsItems,
  partialStageUpdates,
  useQueue,
  onAudit,
}: {
  kind: "once" | "batch";
  triggerSource: "cron" | "user_visit_trigger";
  locale: ReturnType<typeof localeFromRequestUrl>;
  now: number;
  candidate?: DecisionCandidate;
  pool: Awaited<ReturnType<typeof getCoinPool>>;
  newsItems: NewsItem[];
  persistNewsItems?: NewsItem[];
  partialStageUpdates: boolean;
  useQueue: boolean;
  onAudit: (event: PmDecisionTriggerAuditEvent) => void;
}) {
  const job = await enqueuePmDecisionJob({
    kind,
    triggerSource,
    locale,
    ...(candidate ? { candidate } : {}),
    ...(persistNewsItems?.length ? { newsItems: persistNewsItems } : {}),
    now,
  });
  const queueResult = useQueue
    ? await publishPmDecisionJobToQueue(job, { now })
    : ({ mode: "disabled" } as const);
  const jobResult =
    queueResult.mode === "queue"
      ? null
      : await runPmDecisionJob(job, {
          pool,
          newsItems,
          now,
          partialStageUpdates,
          onAudit,
        });

  return {
    job,
    queueResult,
    jobResult,
    outputs: jobResult?.outputs ?? [],
  };
}

type DispatchPmDecisionJobResult = Awaited<ReturnType<typeof dispatchPmDecisionJob>>;

function isPublicPmDecisionOutput(output: DispatchPmDecisionJobResult["outputs"][number]) {
  return isPublicDisplayablePmDecisionEvent(output.publicTimelineEntry);
}

function isLockedInlineSkip(result: DispatchPmDecisionJobResult) {
  if (result.outputs.length > 0) return false;
  const auditEvents = result.jobResult?.auditEvents ?? [];
  return auditEvents.some(
    (event) => event.type === "candidate_skipped" && event.reason === "locked",
  );
}

function shouldSpendInlineSlot(result: DispatchPmDecisionJobResult) {
  if (result.queueResult.mode === "queue") return false;
  if (isLockedInlineSkip(result)) return false;
  return result.outputs.length > 0 || Boolean(result.job.candidate);
}

function residentPrewarmAttemptTelemetry(
  result: DispatchPmDecisionJobResult,
  plan: ReturnType<typeof residentPrewarmPlan>,
  locale: ReturnType<typeof localeFromRequestUrl>,
) {
  const candidate = result.job.candidate;
  return {
    locale,
    candidateType: candidate?.candidateType ?? null,
    candidateKey: candidate?.candidateKey ?? null,
    why: candidate ? residentPrewarmWhy(candidate, plan) : "unknown",
    outputCount: result.outputs.length,
    queueMode: result.queueResult.mode,
    spentInlineSlot: shouldSpendInlineSlot(result),
    lockedSkip: isLockedInlineSkip(result),
  };
}

function residentPrewarmWhy(
  candidate: NonNullable<DispatchPmDecisionJobResult["job"]["candidate"]>,
  plan: ReturnType<typeof residentPrewarmPlan>,
) {
  if (plan.fixedCadenceCandidateKeys.includes(candidate.candidateKey)) return "fixed_cadence";
  if (plan.backfillCandidateKeys.includes(candidate.candidateKey)) return "sla_backfill";
  if (plan.burstCandidateKey === candidate.candidateKey) return "burst";
  return "resident_prewarm";
}

async function resolveOpenPmDecisions(
  pool: Awaited<ReturnType<typeof getCoinPool>>,
  records: Awaited<ReturnType<typeof readAllDecisionRecords>>,
  now: number,
) {
  try {
    const openRecords = records.flatMap((record) => {
      if (record.resolvedOutcome === "manual_close") return [];
      if (record.resolvedOutcome || !record.tradeDecision) return [];
      const symbol =
        normalizeResolutionSymbol(record.symbol) ??
        normalizeResolutionSymbol(record.tradeDecision.symbol);
      return symbol ? [{ record, symbol }] : [];
    });
    const prices = await resolveCurrentPricesForOpenStrategies({
      symbols: openRecords.map((entry) => entry.symbol),
      pool,
      now,
    });
    let resolved = 0;

    for (const { record, symbol } of openRecords) {
      const resolutionPrice = prices.get(symbol);
      if (!resolutionPrice || resolutionPrice.source === "missingCoinWPrice") continue;
      try {
        const result = await resolveDecisionRecordFromPrice(
          record,
          resolutionPrice.price,
          now,
          undefined,
          resolutionPrice.source,
        );
        if (result) resolved += 1;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] PM decision resolution record skipped", {
            recordId: record.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return resolved;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] PM decision resolution skipped", error);
    }
    return 0;
  }
}

async function readCronDecisionRecords(locale: ReturnType<typeof localeFromRequestUrl>) {
  try {
    return {
      records: await readAllDecisionRecords(PM_RESOLUTION_RECORD_LIMIT, locale),
      readable: true,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] PM decision records unavailable for cron diagnostics", error);
    }
    return {
      records: [],
      readable: false,
    };
  }
}
