import { generateText } from "@/lib/llm/generateText";
import { parseJsonObjectWithRepair } from "@/lib/llm/jsonRepair";
import { mapTeamProviderToProviderId } from "@/lib/llm/providers";
import { appendDecisionRecord } from "@/lib/team/decisionRecordStore";
import type {
  AnalystDirection,
  DecisionStageTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import { TEAM_MEMBER_REGISTRY } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { residentPrewarmCandidates } from "@/lib/watch/residentPrewarm";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { NewsDrivenCandidate } from "@/lib/news/symbolExtractor";
import type { Locale } from "@/i18n/types";
import type { NewsItem } from "@/lib/types";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";

export interface SimplePipelineInput {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems: NewsItem[];
  residentCandidates?: DecisionCandidate[];
  newsDrivenCandidates?: NewsDrivenCandidate[];
}

export interface SimplePipelineResult {
  mode: "simple";
  generatedRecords: StrategyDecisionRecord[];
  skippedCandidates: Array<{ candidateKey: string; reason: "non_executable_symbol" }>;
  candidateKeys: string[];
}

type SimplePipelineDecision = {
  analysisSummary: string;
  rationale: string;
  direction: AnalystDirection;
  confidence: number;
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number[];
  positionSizing?: number;
  riskNote?: string;
  invalidatesIf?: string;
};

const SIMPLE_PIPELINE_PROMPT_VERSION = "simple-pipeline:v1";
const SIMPLE_PIPELINE_PROVIDER = "simple-pipeline";
const SIMPLE_PIPELINE_STAGE_LABELS: Record<DecisionStageTraceEntry["stageId"], string> = {
  analyst_inputs: "Information collection",
  research_lead: "Research synthesis",
  trade_decision: "Trade plan",
  risk_lead: "Risk review",
  record_write: "Record write",
  public_timeline: "Public timeline",
};

export async function runSimplePipeline(input: SimplePipelineInput): Promise<SimplePipelineResult> {
  const residentCandidates =
    input.residentCandidates ??
    residentPrewarmCandidates({
      locale: input.locale,
      now: input.now,
      pool: input.pool,
      newsItems: input.newsItems,
      force: true,
    });
  const candidateInputs = dedupeCandidateInputs([
    ...residentCandidates.map((candidate) => ({ candidate, newsItem: null })),
    ...(input.newsDrivenCandidates ?? []).map(({ candidate, newsItem }) => ({
      candidate,
      newsItem,
    })),
  ]);
  const generatedRecords: StrategyDecisionRecord[] = [];
  const skippedCandidates: SimplePipelineResult["skippedCandidates"] = [];

  for (const candidateInput of candidateInputs) {
    const { candidate, newsItem } = candidateInput;
    if (candidate.candidateType === "symbol" && candidate.executable === false) {
      skippedCandidates.push({
        candidateKey: candidate.candidateKey,
        reason: "non_executable_symbol",
      });
      continue;
    }

    const decision = await generateSimpleDecision({
      ...input,
      candidate,
      newsItem,
    });
    const record = buildSimpleDecisionRecord({
      ...input,
      candidate,
      decision,
      newsItem,
    });
    await appendDecisionRecord(record);
    generatedRecords.push(record);
  }

  return {
    mode: "simple",
    generatedRecords,
    skippedCandidates,
    candidateKeys: candidateInputs.map(({ candidate }) => candidate.candidateKey),
  };
}

async function generateSimpleDecision({
  locale,
  now,
  pool,
  newsItems,
  candidate,
  newsItem,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  newsItem: NewsItem | null;
}): Promise<SimplePipelineDecision> {
  const raw = await generateText(
    [
      "Return JSON only for a public market analysis card.",
      `locale=${locale}`,
      `generatedAt=${new Date(now).toISOString()}`,
      `candidateType=${candidate.candidateType}`,
      `candidateKey=${candidate.candidateKey}`,
      candidate.symbol ? `symbol=${candidate.symbol}` : null,
      `displayTitle=${candidate.displayTitle}`,
      `executable=${candidate.executable ? "true" : "false"}`,
      priceContext(candidate, pool),
      newsContext(newsItem ? [newsItem] : newsItems),
      "Fields: analysisSummary, rationale, direction(long|short|neutral|wait), confidence(0-1).",
      "For executable symbol cards only, include entryPrice, stopLoss, takeProfit, positionSizing, riskNote, invalidatesIf when a concrete trade plan exists.",
      "For market_overview or hotspot cards, do not include entryPrice, stopLoss, takeProfit, or positionSizing.",
    ]
      .filter(Boolean)
      .join("\n"),
    {
      taskTag: `watch:simple-pipeline:${candidate.candidateType}:${locale}`,
      temperature: 0.25,
      maxTokens: 700,
      enableGuardrails: false,
      providerOverride: mapTeamProviderToProviderId(TEAM_MEMBER_REGISTRY.pm.defaultProvider),
      timeoutMs: 30_000,
    },
  );
  return normalizeDecision(parseJsonObjectWithRepair(raw));
}

function buildSimpleDecisionRecord({
  locale,
  now,
  candidate,
  decision,
  newsItem,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  decision: SimplePipelineDecision;
  newsItem: NewsItem | null;
}): StrategyDecisionRecord {
  const createdAt = new Date(now).toISOString();
  const symbol = recordSymbol(candidate);
  const evidenceIds = newsItem ? [`news:${newsItem.id}`] : evidenceIdsFromCandidate(candidate);
  const tradeDecision = tradeDecisionFromSimpleDecision({
    decision,
    candidate,
    symbol,
    createdAt,
    evidenceIds,
  });

  return {
    id: simpleRecordId(candidate, now),
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    candidate,
    analysisSummary: decision.analysisSummary,
    locale,
    decisionOwnerId: "pm",
    contributorIds: ["news_analyst", "pm"],
    analystInputs: [
      {
        memberId: "news_analyst",
        direction: decision.direction,
        confidence: decision.confidence,
        rationale: decision.rationale,
        oneLineSummary: oneLine(decision.analysisSummary || decision.rationale),
        detailedRationale: decision.rationale,
        dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
        evidenceIds,
        rounds: [
          {
            round: 1,
            direction: decision.direction,
            confidence: decision.confidence,
            rationale: decision.rationale,
            oneLineSummary: oneLine(decision.analysisSummary || decision.rationale),
            detailedRationale: decision.rationale,
            dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
            evidenceIds,
            observedAt: createdAt,
          },
        ],
      },
      {
        memberId: "pm",
        direction: decision.direction,
        confidence: decision.confidence,
        rationale: decision.rationale,
        oneLineSummary: oneLine(decision.analysisSummary || decision.rationale),
        detailedRationale: decision.rationale,
        dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
        evidenceIds,
        rounds: [
          {
            round: 1,
            direction: decision.direction,
            confidence: decision.confidence,
            rationale: decision.rationale,
            oneLineSummary: oneLine(decision.analysisSummary || decision.rationale),
            detailedRationale: decision.rationale,
            dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
            evidenceIds,
            observedAt: createdAt,
          },
        ],
      },
    ],
    stageTrace: buildCompletedStageTrace(createdAt),
    sourceThreadId: null,
    tradeDecision,
    createdAt,
    evaluationWindowEndsAt: tradeDecision ? new Date(now + 6 * 60 * 60_000).toISOString() : null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: SIMPLE_PIPELINE_PROMPT_VERSION,
    modelProvider: SIMPLE_PIPELINE_PROVIDER,
    legacyFactionId: null,
  };
}

function tradeDecisionFromSimpleDecision({
  decision,
  candidate,
  symbol,
  createdAt,
  evidenceIds,
}: {
  decision: SimplePipelineDecision;
  candidate: DecisionCandidate;
  symbol: string;
  createdAt: string;
  evidenceIds: string[];
}): TradeDecision | null {
  if (candidate.candidateType !== "symbol" || candidate.executable === false) return null;
  if (decision.direction !== "long" && decision.direction !== "short") return null;
  const entryPrice = finitePositive(decision.entryPrice);
  const stopLoss = finitePositive(decision.stopLoss);
  const takeProfit = Array.isArray(decision.takeProfit)
    ? decision.takeProfit.map(finitePositive).filter((value): value is number => value !== null)
    : [];
  if (entryPrice === null || stopLoss === null || takeProfit.length === 0) return null;

  return {
    id: `trade:${symbol}:${Date.parse(createdAt)}`,
    schemaVersion: 1,
    symbol,
    generatedBy: "pm",
    generatedAt: createdAt,
    direction: decision.direction,
    entryType: "market",
    entryPrice,
    entryRange: null,
    stopLoss,
    takeProfit,
    positionSizing: clampNumber(decision.positionSizing, 0.03, 0.5),
    timeHorizon: "intraday",
    rating: confidenceToRating(decision.confidence),
    confidence: decision.confidence,
    evidenceIds,
    riskNote: decision.riskNote?.trim() || "Risk invalidation follows the stop-loss level.",
    invalidatesIf: decision.invalidatesIf?.trim() || "The setup is invalidated at stop loss.",
    promptVersion: SIMPLE_PIPELINE_PROMPT_VERSION,
    modelProvider: SIMPLE_PIPELINE_PROVIDER,
    severity: decision.confidence >= 0.75 ? "high" : "medium",
  };
}

function buildCompletedStageTrace(observedAt: string): DecisionStageTraceEntry[] {
  return (
    [
      "analyst_inputs",
      "research_lead",
      "trade_decision",
      "risk_lead",
      "record_write",
      "public_timeline",
    ] as const
  ).map((stageId) => ({
    stageId,
    label: SIMPLE_PIPELINE_STAGE_LABELS[stageId],
    status: "done",
    observedAt,
    startedAt: observedAt,
    completedAt: observedAt,
    memberIds: stageId === "analyst_inputs" ? ["news_analyst"] : ["pm"],
    modelProvider: SIMPLE_PIPELINE_PROVIDER,
    promptVersion: SIMPLE_PIPELINE_PROMPT_VERSION,
  }));
}

function normalizeDecision(parsed: Record<string, unknown>): SimplePipelineDecision {
  const rationale = text(parsed.rationale) || text(parsed.analysisSummary);
  const analysisSummary = text(parsed.analysisSummary) || oneLine(rationale);
  return {
    analysisSummary,
    rationale: rationale || analysisSummary,
    direction: normalizeDirection(parsed.direction),
    confidence: normalizeConfidence(parsed.confidence),
    entryPrice: numberOrNull(parsed.entryPrice),
    stopLoss: numberOrNull(parsed.stopLoss),
    takeProfit: Array.isArray(parsed.takeProfit)
      ? parsed.takeProfit.map(numberOrNull).filter((value): value is number => value !== null)
      : undefined,
    positionSizing:
      typeof parsed.positionSizing === "number" && Number.isFinite(parsed.positionSizing)
        ? parsed.positionSizing
        : undefined,
    riskNote: text(parsed.riskNote),
    invalidatesIf: text(parsed.invalidatesIf),
  };
}

function dedupeCandidateInputs(
  inputs: Array<{ candidate: DecisionCandidate; newsItem: NewsItem | null }>,
) {
  const seen = new Set<string>();
  const deduped: Array<{ candidate: DecisionCandidate; newsItem: NewsItem | null }> = [];
  for (const input of inputs) {
    if (seen.has(input.candidate.candidateKey)) continue;
    seen.add(input.candidate.candidateKey);
    deduped.push(input);
  }
  return deduped;
}

function recordSymbol(candidate: DecisionCandidate) {
  if (candidate.candidateType === "market_overview") return "MARKET";
  if (candidate.candidateType === "hotspot") return "HOTSPOT";
  return candidate.symbol?.trim().replace(/^\$+/, "").toUpperCase() || "UNKNOWN";
}

function simpleRecordId(candidate: DecisionCandidate, now: number) {
  return `pm:${recordSymbol(candidate)}:${candidate.candidateKey.replace(/[^a-zA-Z0-9:-]/g, "-")}:${now}`;
}

function priceContext(candidate: DecisionCandidate, pool?: CoinPoolPayload) {
  if (!pool || candidate.candidateType !== "symbol" || !candidate.symbol) return "";
  const symbol = candidate.symbol.toUpperCase();
  const entry = [...pool.majors, ...pool.trending, ...pool.opportunity].find(
    (item) => item.symbol.toUpperCase() === symbol,
  );
  if (!entry) return "";
  return `price=${entry.price}\nchange24h=${entry.change24h}`;
}

function newsContext(items: NewsItem[]) {
  return items
    .slice(0, 4)
    .map((item) => `news=${item.title} (${item.source})`)
    .join("\n");
}

function evidenceIdsFromCandidate(candidate: DecisionCandidate) {
  return candidate.reasons
    .map((reason) => `${reason.kind}:${reason.label}`)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function oneLine(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 79).trim()}…` : compact;
}

function normalizeDirection(value: unknown): AnalystDirection {
  if (value === "long" || value === "short" || value === "neutral" || value === "wait") {
    return value;
  }
  return "wait";
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function clampNumber(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, value));
}

function confidenceToRating(confidence: number): 1 | 2 | 3 | 4 | 5 {
  if (confidence >= 0.85) return 5;
  if (confidence >= 0.7) return 4;
  if (confidence >= 0.55) return 3;
  if (confidence >= 0.35) return 2;
  return 1;
}
