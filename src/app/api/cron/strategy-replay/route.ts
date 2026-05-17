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
import { enqueuePmDecisionJob } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";
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
  const resolvedPmDecisions = await resolveOpenPmDecisions(pool, locale, now);
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
  const pmDecisionJob = await enqueuePmDecisionJob({
    kind: trigger === "now" ? "once" : "batch",
    triggerSource: trigger === "now" ? "user_visit_trigger" : "cron",
    locale,
    now,
  });
  const pmDecisionQueueResult =
    trigger === "now"
      ? ({ mode: "disabled" } as const)
      : await publishPmDecisionJobToQueue(pmDecisionJob, { now });
  const pmDecisionJobResult =
    pmDecisionQueueResult.mode === "queue"
      ? null
      : await runPmDecisionJob(pmDecisionJob, {
          pool,
          newsItems: normalizedItems,
          now,
          partialStageUpdates: pmPartialStageUpdates,
          onAudit: (event) => pmDecisionAudit.push(event),
        });
  const pmDecisionOutputs = pmDecisionJobResult?.outputs ?? [];
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
    pmDecisionJobId: pmDecisionJob.id,
    pmDecisionJobStatus: pmDecisionJobResult?.job.status ?? pmDecisionJob.status,
    pmDecisionQueueMode: pmDecisionQueueResult.mode,
    pmDecisionQueueMessageId:
      pmDecisionQueueResult.mode === "queue" ? pmDecisionQueueResult.messageId : undefined,
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

async function resolveOpenPmDecisions(
  pool: Awaited<ReturnType<typeof getCoinPool>>,
  locale: ReturnType<typeof localeFromRequestUrl>,
  now: number,
) {
  try {
    const priceBySymbol = new Map(
      [...pool.majors, ...pool.trending, ...pool.opportunity].flatMap((item) => {
        const symbol = normalizeResolutionSymbol(item.symbol);
        return symbol ? ([[symbol, item.price]] as const) : [];
      }),
    );
    const records = await readAllDecisionRecords(PM_RESOLUTION_RECORD_LIMIT, locale);
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
