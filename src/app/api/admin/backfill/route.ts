import { NextResponse, type NextRequest } from "next/server";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { getCoinPool } from "@/lib/marketDataCache";
import { triggerPmDecisionPipelineOnce } from "@/lib/team/pmDecisionTrigger";
import { hotspotDecisionCandidate, marketOverviewCandidate } from "@/lib/watch/residentCandidate";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type {
  DecisionStageTraceEntry,
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SUPPORTED_CANDIDATE_TYPES = new Set(["market_overview", "hotspot"]);

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const trigger = request.nextUrl.searchParams.get("trigger");
  if (trigger !== "force") {
    return NextResponse.json(
      { ok: false, error: "invalid_trigger", expected: "force" },
      { status: 400 },
    );
  }

  const candidateType = request.nextUrl.searchParams.get("candidateType") ?? "market_overview";
  if (!SUPPORTED_CANDIDATE_TYPES.has(candidateType)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_candidate_type", candidateType },
      { status: 400 },
    );
  }

  const locale = normalizeWatchLocale(request.nextUrl.searchParams.get("locale") ?? "zh_CN");
  const now = Date.now();
  const { items, servedBy, fellBackFrom } = await fetchNewsWithChain({ limit: 8 });
  const newsItems = [];
  for (const item of items) {
    newsItems.push(await normalizeNewsItem(item, servedBy));
  }
  const pool = await getCoinPool();
  const candidate = backfillCandidate(candidateType, { locale, now });
  const result = await triggerPmDecisionPipelineOnce({
    triggerSource: "cron",
    locale,
    now,
    pool,
    newsItems,
    candidate,
    partialStageUpdates: true,
    bypassLock: true,
  });

  if (!result) {
    return NextResponse.json({
      ok: false,
      reason: "pm_pipeline_no_output",
      candidateType: candidate.candidateType,
      candidateKey: candidate.candidateKey,
      locale,
      servedBy,
      fellBackFrom,
      servedAt: now,
    });
  }

  return NextResponse.json({
    ok: true,
    recordId: result.record.id,
    candidateType: candidate.candidateType,
    candidateKey: candidate.candidateKey,
    locale,
    stageTrace: stageTraceSummary(result.record.stageTrace),
    publicTimelineEventId: result.publicTimelineEntry.id,
    servedBy,
    fellBackFrom,
    servedAt: now,
  });
}

function backfillCandidate(
  candidateType: string,
  { locale, now }: { locale: ReturnType<typeof normalizeWatchLocale>; now: number },
): DecisionCandidate {
  return candidateType === "hotspot"
    ? hotspotDecisionCandidate({ locale, now })
    : marketOverviewCandidate({ locale, now });
}

function stageTraceSummary(trace: DecisionStageTraceEntry[] | undefined) {
  const summary: Partial<Record<DecisionStageTraceId, DecisionStageTraceStatus>> = {};
  for (const stage of trace ?? []) {
    summary[stage.stageId] = stage.status;
  }
  return summary;
}
