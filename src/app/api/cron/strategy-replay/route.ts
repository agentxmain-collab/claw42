import { NextResponse, type NextRequest } from "next/server";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { getNewsSourceHealthSnapshot } from "@/lib/news/sourceHealth";
import { tryOrchestrateNewsDebate, listNewsDebates } from "@/lib/debateOrchestrator";
import { getCoinPool } from "@/lib/marketDataCache";
import { adjustDebtFromReplays } from "@/lib/agentRelationship";
import { evaluateStrategy, recordStrategyReplay } from "@/lib/strategyHistory";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { resolveDecisionRecordFromPrice } from "@/lib/team/decisionResolution";
import {
  summarizeProviderTelemetry,
  warnIfSingleProviderConcentration,
} from "@/lib/team/providerTelemetry";
import { publishPmDecisionJobToQueue } from "@/lib/team/pmDecisionJobQueue";
import { runPmDecisionJob } from "@/lib/team/pmDecisionJobRunner";
import type { PmDecisionTriggerAuditEvent } from "@/lib/team/pmDecisionTrigger";
import { enqueuePmDecisionJob, readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { residentPrewarmPlan } from "@/lib/watch/residentPrewarm";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRATEGY_REPLAY_TRIGGER_LOCK_KEY = "cron:strategy-replay:trigger-now";
const STRATEGY_REPLAY_TRIGGER_LOCK_MS = 5 * 60_000;
const PM_RESOLUTION_RECORD_LIMIT = 100;

function isAuthorized(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const trigger = request.nextUrl.searchParams.get("trigger");
  const locale = localeFromRequestUrl(request.nextUrl, request.headers.get("accept-language"));
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
  const { items, servedBy, fellBackFrom } = await fetchNewsWithChain({ limit: 8 });
  const debates = [];
  const normalizedItems: NewsItem[] = [];

  for (const item of items) {
    const normalizedItem = await normalizeNewsItem(item, servedBy);
    normalizedItems.push(normalizedItem);
    const debate = await tryOrchestrateNewsDebate(normalizedItem, now + debates.length * 1000);
    if (!debate) continue;
    debates.push(debate);
    if (debates.length >= 2) break;
  }

  const pool = await getCoinPool();
  const decisionRecordRead = await readCronDecisionRecords(locale);
  const decisionRecords = decisionRecordRead.records;
  const pmDecisionJobs = await readPmDecisionJobs({ locale, limit: 100 }).catch(() => []);
  const resolvedPmDecisions = await resolveOpenPmDecisions(pool, decisionRecords, now);
  const replayed = [];

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
  const pmDecisionAudit: PmDecisionTriggerAuditEvent[] = [];
  const pmPartialStageUpdates = true;

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
  const residentPrewarmResults = [];
  for (const candidate of residentCandidates) {
    residentPrewarmResults.push(
      await dispatchPmDecisionJob({
        kind: "once",
        triggerSource: "cron",
        locale,
        now,
        candidate,
        pool,
        newsItems: normalizedItems,
        partialStageUpdates: pmPartialStageUpdates,
        useQueue: trigger !== "now",
        onAudit: (event) => pmDecisionAudit.push(event),
      }),
    );
  }

  const batchResult = await dispatchPmDecisionJob({
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
  const pmDecisionOutputs = [
    ...residentPrewarmResults.flatMap((result) => result.outputs),
    ...batchResult.outputs,
  ];
  const providerTelemetry = summarizeProviderTelemetry({ since: now });
  await warnIfSingleProviderConcentration(providerTelemetry);

  return NextResponse.json({
    ok: true,
    servedBy,
    fellBackFrom,
    generatedDebates: debates.length,
    locale,
    pmDecisionGenerated: pmDecisionOutputs.length > 0,
    generatedPmDecisions: pmDecisionOutputs.length,
    pmPartialStageUpdates,
    pmDecisionJobId: batchResult.job.id,
    pmDecisionJobStatus: batchResult.jobResult?.job.status ?? batchResult.job.status,
    pmDecisionQueueMode: batchResult.queueResult.mode,
    pmDecisionQueueMessageId:
      batchResult.queueResult.mode === "queue" ? batchResult.queueResult.messageId : undefined,
    residentPrewarmCandidates: residentCandidates.map((candidate) => candidate.candidateKey),
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
      (total, result) => total + result.outputs.length,
      0,
    ),
    residentPrewarmQueued: residentPrewarmResults.filter(
      (result) => result.queueResult.mode === "queue",
    ).length,
    residentPrewarmJobIds: residentPrewarmResults.map((result) => result.job.id),
    pmDecisionAudit: trigger === "now" ? pmDecisionAudit : undefined,
    providerTelemetry: trigger === "now" ? providerTelemetry : undefined,
    newsSourceHealth: trigger === "now" ? getNewsSourceHealthSnapshot() : undefined,
    resolvedPmDecisions,
    replayed: replayed.length,
    trigger,
    triggerLockAcquiredAt: triggerLock?.acquiredAt ?? null,
    servedAt: now,
  });
}

async function dispatchPmDecisionJob({
  kind,
  triggerSource,
  locale,
  now,
  candidate,
  pool,
  newsItems,
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
  partialStageUpdates: boolean;
  useQueue: boolean;
  onAudit: (event: PmDecisionTriggerAuditEvent) => void;
}) {
  const job = await enqueuePmDecisionJob({
    kind,
    triggerSource,
    locale,
    ...(candidate ? { candidate } : {}),
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

async function resolveOpenPmDecisions(
  pool: Awaited<ReturnType<typeof getCoinPool>>,
  records: Awaited<ReturnType<typeof readAllDecisionRecords>>,
  now: number,
) {
  try {
    const priceBySymbol = new Map(
      [...pool.majors, ...pool.trending, ...pool.opportunity].flatMap((item) => {
        const symbol = normalizeResolutionSymbol(item.symbol);
        return symbol ? ([[symbol, item.price]] as const) : [];
      }),
    );
    let resolved = 0;

    for (const record of records) {
      if (record.resolvedOutcome === "manual_close") continue;
      if (record.resolvedOutcome || !record.tradeDecision) continue;
      const symbol =
        normalizeResolutionSymbol(record.symbol) ??
        normalizeResolutionSymbol(record.tradeDecision.symbol);
      if (!symbol) continue;
      const price = priceBySymbol.get(symbol);
      if (typeof price !== "number" || !Number.isFinite(price)) continue;
      try {
        const result = await resolveDecisionRecordFromPrice(
          record,
          price,
          now,
          undefined,
          pool.source,
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
