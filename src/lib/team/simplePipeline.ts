import { generateText } from "@/lib/llm/generateText";
import { parseJsonObjectWithRepair } from "@/lib/llm/jsonRepair";
import { mapTeamProviderToProviderId } from "@/lib/llm/providers";
import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { appendDecisionRecord } from "@/lib/team/decisionRecordStore";
import type {
  AnalystDirection,
  DecisionStageTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import { TEAM_MEMBER_REGISTRY } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { NewsDrivenCandidate } from "@/lib/news/symbolExtractor";
import type { Locale } from "@/i18n/types";
import type { NewsItem } from "@/lib/types";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";

export const SIMPLE_PIPELINE_CARDS_PER_RUN = 5;
export const SIMPLE_PIPELINE_LLM_CONCURRENCY = 2;
export const MIN_TITLE_DEDUPE_LENGTH = 24;
export const MIN_TITLE_DEDUPE_CJK_LENGTH = 12;

export interface SimplePipelineInput {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems: NewsItem[];
  newsDrivenCandidates?: NewsDrivenCandidate[];
}

export interface SimplePipelineResult {
  mode: "simple";
  generatedRecords: StrategyDecisionRecord[];
  skippedCandidates: Array<{
    candidateKey: string;
    reason: "non_executable_symbol" | "no_strategy";
  }>;
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
  const candidateInputs = dedupeByCanonicalNewsItem(input.newsDrivenCandidates ?? []);
  const generatedRecords: StrategyDecisionRecord[] = [];
  const skippedCandidates: SimplePipelineResult["skippedCandidates"] = [];

  for (let index = 0; index < candidateInputs.length; index += SIMPLE_PIPELINE_LLM_CONCURRENCY) {
    const batch = candidateInputs.slice(index, index + SIMPLE_PIPELINE_LLM_CONCURRENCY);
    const results = await Promise.all(
      batch.map((candidateInput) => runSimpleCandidate(input, candidateInput)),
    );

    for (const result of results) {
      if (result.record) generatedRecords.push(result.record);
      if (result.skipped) skippedCandidates.push(result.skipped);
    }
  }

  return {
    mode: "simple",
    generatedRecords,
    skippedCandidates,
    candidateKeys: candidateInputs.map(({ candidate }) => candidate.candidateKey),
  };
}

async function runSimpleCandidate(
  input: SimplePipelineInput,
  candidateInput: { candidate: DecisionCandidate; newsItem: NewsItem },
) {
  const { candidate, newsItem } = candidateInput;
  if (candidate.candidateType !== "symbol" || candidate.executable === false) {
    return {
      skipped: {
        candidateKey: candidate.candidateKey,
        reason: "non_executable_symbol" as const,
      },
    };
  }

  const createdAt = new Date(input.now).toISOString();
  const evidence = newsItemToEvidence(newsItem, createdAt);
  const evidenceIds = [evidence.id];
  const symbol = recordSymbol(candidate);
  let decision = await generateSimpleDecision({
    ...input,
    candidate,
    newsItem,
  });
  let tradeDecision = tradeDecisionFromSimpleDecision({
    decision,
    candidate,
    symbol,
    createdAt,
    evidenceIds,
  });

  if (!tradeDecision) {
    decision = await generateSimpleDecision({
      ...input,
      candidate,
      newsItem,
      retryForTradePlan: true,
    });
    tradeDecision = tradeDecisionFromSimpleDecision({
      decision,
      candidate,
      symbol,
      createdAt,
      evidenceIds,
    });
  }

  if (!tradeDecision) {
    return {
      skipped: {
        candidateKey: candidate.candidateKey,
        reason: "no_strategy" as const,
      },
    };
  }

  const savedEvidence = await saveNewsEvidence(evidence);
  const record = buildSimpleDecisionRecord({
    ...input,
    candidate,
    decision,
    createdAt,
    evidenceIds: [savedEvidence.id],
    tradeDecision: {
      ...tradeDecision,
      evidenceIds: [savedEvidence.id],
    },
  });
  await appendDecisionRecord(record);
  return { record };
}

async function generateSimpleDecision({
  locale,
  now,
  pool,
  newsItems,
  candidate,
  newsItem,
  retryForTradePlan = false,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  newsItem: NewsItem;
  retryForTradePlan?: boolean;
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
      "This is a CoinW executable symbol card. Include concrete entryPrice, stopLoss, takeProfit, positionSizing, riskNote, invalidatesIf.",
      retryForTradePlan
        ? "Previous response did not include a complete trade plan. Return long or short only when supportable, and ensure entryPrice, stopLoss, and takeProfit are filled."
        : null,
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
  createdAt,
  evidenceIds,
  tradeDecision,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  decision: SimplePipelineDecision;
  createdAt: string;
  evidenceIds: string[];
  tradeDecision: TradeDecision;
}): StrategyDecisionRecord {
  const symbol = recordSymbol(candidate);

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
    evaluationWindowEndsAt: new Date(now + 6 * 60 * 60_000).toISOString(),
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

export function normalizedUrlKey(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/[#?].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function normalizedTitleKey(title: string | null | undefined): string | null {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/\s+/g, " ")
    .replace(/[^一-鿿\w\s]/g, "")
    .toLowerCase()
    .slice(0, 80);
  const cjkChars = (normalized.match(/[一-鿿]/g) ?? []).length;
  if (cjkChars >= MIN_TITLE_DEDUPE_CJK_LENGTH || normalized.length >= MIN_TITLE_DEDUPE_LENGTH) {
    return normalized;
  }
  return null;
}

export function canonicalDedupeKeys(newsItem: NewsItem): string[] {
  const keys: string[] = [];
  const urlKey = normalizedUrlKey(newsItem.url);
  if (urlKey) keys.push(`url:${urlKey}`);
  const titleKey = normalizedTitleKey(newsItem.title);
  if (titleKey) keys.push(`title:${titleKey}`);
  return keys;
}

export function dedupeByCanonicalNewsItem(inputs: NewsDrivenCandidate[]) {
  const seen = new Set<string>();
  const deduped: Array<{ candidate: DecisionCandidate; newsItem: NewsItem }> = [];
  for (const { candidate, newsItem } of inputs) {
    const keys = canonicalDedupeKeys(newsItem);
    if (keys.length === 0) continue;
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    deduped.push({ candidate, newsItem });
  }
  return deduped;
}

function recordSymbol(candidate: DecisionCandidate) {
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
