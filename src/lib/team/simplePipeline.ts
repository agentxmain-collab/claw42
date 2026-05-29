import { generateText } from "@/lib/llm/generateText";
import { parseJsonObjectWithRepair } from "@/lib/llm/jsonRepair";
import { callExactProvider, mapTeamProviderToProviderId } from "@/lib/llm/providers";
import type { LLMAttemptDiagnostic } from "@/lib/llm/providers";
import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { appendDecisionRecord } from "@/lib/team/decisionRecordStore";
import type {
  AnalystInputRecord,
  AnalystDirection,
  DecisionStageTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import { TEAM_MEMBER_REGISTRY, type TeamMemberId } from "@/lib/team/teamRegistry";
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
  llmDiagnostics: LLMAttemptDiagnostic[];
}

type SimplePipelineDecision = {
  localizedNewsTitle: string;
  newsIntro: string;
  analysisSummary: string;
  rationale: string;
  newsBrief: string;
  symbolThesis: string;
  bullCase: string;
  bearCase: string;
  tradePlanRationale: string;
  riskReview: string;
  invalidationWatch: string;
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
const SIMPLE_PIPELINE_VALIDATION_PROVIDER = "minimax";
const SIMPLE_PIPELINE_VALIDATION_MODEL = "MiniMax-Text-01";
const SIMPLE_PIPELINE_STAGE_LABELS: Record<DecisionStageTraceEntry["stageId"], string> = {
  analyst_inputs: "Information collection",
  research_lead: "Research synthesis",
  trade_decision: "Trade plan",
  risk_lead: "Risk review",
  record_write: "Record write",
  public_timeline: "Public timeline",
};

export async function runSimplePipeline(input: SimplePipelineInput): Promise<SimplePipelineResult> {
  const candidateInputs = selectSimpleInputsWithSymbolDiversity(
    dedupeByCanonicalNewsItem(input.newsDrivenCandidates ?? []),
  );
  const generatedRecords: StrategyDecisionRecord[] = [];
  const skippedCandidates: SimplePipelineResult["skippedCandidates"] = [];
  const llmDiagnostics: LLMAttemptDiagnostic[] = [];

  for (let index = 0; index < candidateInputs.length; index += SIMPLE_PIPELINE_LLM_CONCURRENCY) {
    const batch = candidateInputs.slice(index, index + SIMPLE_PIPELINE_LLM_CONCURRENCY);
    const results = await Promise.all(
      batch.map((candidateInput) => runSimpleCandidate(input, candidateInput, llmDiagnostics)),
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
    llmDiagnostics,
  };
}

async function runSimpleCandidate(
  input: SimplePipelineInput,
  candidateInput: { candidate: DecisionCandidate; newsItem: NewsItem },
  llmDiagnostics: LLMAttemptDiagnostic[],
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
  const provisionalEvidence = newsItemToEvidence(newsItem, createdAt);
  const evidenceIds = [provisionalEvidence.id];
  const symbol = recordSymbol(candidate);
  let decision = await generateSimpleDecision({
    ...input,
    candidate,
    newsItem,
    llmDiagnostics,
  });
  let tradeDecision = tradeDecisionFromSimpleDecision({
    decision,
    candidate,
    symbol,
    locale: input.locale,
    createdAt,
    evidenceIds,
  });

  if (!tradeDecision) {
    decision = await generateSimpleDecision({
      ...input,
      candidate,
      newsItem,
      llmDiagnostics,
      retryForTradePlan: true,
    });
    tradeDecision = tradeDecisionFromSimpleDecision({
      decision,
      candidate,
      symbol,
      locale: input.locale,
      createdAt,
      evidenceIds,
    });
  }

  if (!tradeDecision) {
    const validationDecision = await generateMinimaxValidationDecision({
      ...input,
      candidate,
      newsItem,
      llmDiagnostics,
    }).catch(() => null);
    if (validationDecision) {
      decision = validationDecision;
      tradeDecision = tradeDecisionFromSimpleDecision({
        decision,
        candidate,
        symbol,
        locale: input.locale,
        createdAt,
        evidenceIds,
      });
    }
  }

  if (!tradeDecision) {
    return {
      skipped: {
        candidateKey: candidate.candidateKey,
        reason: "no_strategy" as const,
      },
    };
  }

  const savedEvidence = await saveNewsEvidence(
    newsEvidenceFromSimpleDecision(newsItem, decision, createdAt),
  );
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
  llmDiagnostics,
  retryForTradePlan = false,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  newsItem: NewsItem;
  llmDiagnostics: LLMAttemptDiagnostic[];
  retryForTradePlan?: boolean;
}): Promise<SimplePipelineDecision> {
  const raw = await generateText(
    simpleDecisionPrompt({ locale, now, pool, newsItems, candidate, newsItem, retryForTradePlan }),
    {
      taskTag: `watch:simple-pipeline:${candidate.candidateType}:${locale}`,
      temperature: 0.25,
      maxTokens: 1500,
      enableGuardrails: false,
      providerOverride: mapTeamProviderToProviderId(TEAM_MEMBER_REGISTRY.pm.defaultProvider),
      thinkingMode: "disabled",
      responseFormat: "json_object",
      timeoutMs: 30_000,
      diagnosticsCollector: (diagnostic) => llmDiagnostics.push(diagnostic),
    },
  );
  return normalizeDecision(parseJsonObjectWithRepair(raw));
}

async function generateMinimaxValidationDecision({
  locale,
  now,
  pool,
  newsItems,
  candidate,
  newsItem,
  llmDiagnostics,
}: SimplePipelineInput & {
  candidate: DecisionCandidate;
  newsItem: NewsItem;
  llmDiagnostics: LLMAttemptDiagnostic[];
}): Promise<SimplePipelineDecision> {
  const output = await callExactProvider(
    {
      prompt: simpleDecisionPrompt({
        locale,
        now,
        pool,
        newsItems,
        candidate,
        newsItem,
        retryForTradePlan: true,
      }),
      taskTag: `watch:simple-pipeline-validation:${candidate.candidateType}:${locale}`,
      temperature: 0.25,
      maxTokens: 1500,
      providerOverride: SIMPLE_PIPELINE_VALIDATION_PROVIDER,
      modelOverride: SIMPLE_PIPELINE_VALIDATION_MODEL,
      timeoutMs: 30_000,
      diagnosticsCollector: (diagnostic) => llmDiagnostics.push(diagnostic),
    },
    SIMPLE_PIPELINE_VALIDATION_PROVIDER,
  );
  return normalizeDecision(parseJsonObjectWithRepair(output.text));
}

function simpleDecisionPrompt({
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
}) {
  return [
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
    "Required JSON keys: localizedNewsTitle, newsIntro, analysisSummary, rationale, newsBrief, symbolThesis, bullCase, bearCase, tradePlanRationale, riskReview, invalidationWatch, direction, confidence, entryPrice, stopLoss, takeProfit, positionSizing, riskNote, invalidatesIf.",
    "localizedNewsTitle and newsIntro must be localized to locale. newsIntro is one concise sentence: what happened and why it matters for this symbol.",
    "newsBrief, symbolThesis, bullCase, bearCase, tradePlanRationale, riskReview, invalidationWatch must be non-empty, mutually distinct, and localized to locale.",
    "direction must be long or short for this executable CoinW symbol card.",
    "entryPrice must be a JSON number near the current price; stopLoss must be a JSON number; takeProfit must be an array of one or more JSON numbers; positionSizing must be a JSON number from 0.03 to 0.5.",
    "Use conservative levels when the signal is mixed, but still return a complete executable plan.",
    retryForTradePlan
      ? "Previous response did not include a complete trade plan. Return long or short only when supportable, and ensure entryPrice, stopLoss, and takeProfit are filled."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
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
    contributorIds: [
      "news_analyst",
      "research_lead",
      "bullish_researcher",
      "bearish_researcher",
      "trader",
      "risk_lead",
      "pm",
    ],
    analystInputs: simpleAnalystInputs({ decision, evidenceIds, createdAt }),
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
  locale,
  createdAt,
  evidenceIds,
}: {
  decision: SimplePipelineDecision;
  candidate: DecisionCandidate;
  symbol: string;
  locale: Locale;
  createdAt: string;
  evidenceIds: string[];
}): TradeDecision | null {
  if (candidate.candidateType !== "symbol" || candidate.executable === false) return null;
  if (decision.direction !== "long" && decision.direction !== "short") return null;
  if (!hasValidSimpleDecisionSections(decision, locale)) return null;
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
    memberIds: stageMembersForSimplePipeline(stageId),
    modelProvider: SIMPLE_PIPELINE_PROVIDER,
    promptVersion: SIMPLE_PIPELINE_PROMPT_VERSION,
  }));
}

function stageMembersForSimplePipeline(
  stageId: DecisionStageTraceEntry["stageId"],
): TeamMemberId[] {
  if (stageId === "analyst_inputs") return ["news_analyst"];
  if (stageId === "research_lead")
    return ["research_lead", "bullish_researcher", "bearish_researcher"];
  if (stageId === "trade_decision") return ["trader"];
  if (stageId === "risk_lead") return ["risk_lead"];
  return ["pm"];
}

function simpleAnalystInputs({
  decision,
  evidenceIds,
  createdAt,
}: {
  decision: SimplePipelineDecision;
  evidenceIds: string[];
  createdAt: string;
}): AnalystInputRecord[] {
  return [
    simpleAnalystInput(
      "news_analyst",
      decision.newsBrief,
      decision.direction,
      decision.confidence,
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "research_lead",
      decision.symbolThesis,
      decision.direction,
      decision.confidence,
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "bullish_researcher",
      decision.bullCase,
      "long",
      0.5,
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "bearish_researcher",
      decision.bearCase,
      "short",
      0.5,
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "trader",
      decision.tradePlanRationale,
      decision.direction,
      decision.confidence,
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "risk_lead",
      decision.riskReview,
      "neutral",
      Math.min(decision.confidence, 0.7),
      evidenceIds,
      createdAt,
    ),
    simpleAnalystInput(
      "pm",
      decision.invalidationWatch,
      decision.direction,
      decision.confidence,
      evidenceIds,
      createdAt,
    ),
  ];
}

function simpleAnalystInput(
  memberId: TeamMemberId,
  rationale: string,
  direction: AnalystDirection,
  confidence: number,
  evidenceIds: string[],
  observedAt: string,
): AnalystInputRecord {
  const oneLineSummary = oneLine(rationale);
  return {
    memberId,
    direction,
    confidence,
    rationale,
    oneLineSummary,
    detailedRationale: rationale,
    dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
    evidenceIds,
    rounds: [
      {
        round: 1,
        direction,
        confidence,
        rationale,
        oneLineSummary,
        detailedRationale: rationale,
        dataStatus: evidenceIds.length > 0 ? "ok" : "partial",
        evidenceIds,
        observedAt,
      },
    ],
  };
}

function newsEvidenceFromSimpleDecision(
  newsItem: NewsItem,
  decision: SimplePipelineDecision,
  fetchedAt: string,
) {
  const evidence = newsItemToEvidence(
    {
      ...newsItem,
      title: decision.localizedNewsTitle || newsItem.title,
    },
    fetchedAt,
  );
  return {
    ...evidence,
    summary: decision.newsIntro || decision.newsBrief || evidence.summary,
  };
}

function hasValidSimpleDecisionSections(decision: SimplePipelineDecision, locale: Locale) {
  const sections = [
    decision.localizedNewsTitle,
    decision.newsIntro,
    decision.newsBrief,
    decision.symbolThesis,
    decision.bullCase,
    decision.bearCase,
    decision.tradePlanRationale,
    decision.riskReview,
    decision.invalidationWatch,
  ];
  if (sections.some((section) => section.trim().length < 6)) return false;
  const sectionKeys = sections.map(compactSectionKey);
  if (new Set(sectionKeys).size !== sectionKeys.length) return false;
  if (String(locale).startsWith("zh")) {
    return sections.some((section) => /[\u4e00-\u9fff]/.test(section));
  }
  return true;
}

function compactSectionKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\u4e00-\u9fff]/g, "")
    .toLowerCase();
}

function normalizeDecision(parsed: Record<string, unknown>): SimplePipelineDecision {
  const rationale = text(parsed.rationale) || text(parsed.analysisSummary);
  const analysisSummary = text(parsed.analysisSummary) || oneLine(rationale);
  return {
    localizedNewsTitle: text(parsed.localizedNewsTitle),
    newsIntro: text(parsed.newsIntro),
    analysisSummary,
    rationale: rationale || analysisSummary,
    newsBrief: text(parsed.newsBrief),
    symbolThesis: text(parsed.symbolThesis),
    bullCase: text(parsed.bullCase),
    bearCase: text(parsed.bearCase),
    tradePlanRationale: text(parsed.tradePlanRationale),
    riskReview: text(parsed.riskReview),
    invalidationWatch: text(parsed.invalidationWatch),
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

function selectSimpleInputsWithSymbolDiversity(
  inputs: Array<{ candidate: DecisionCandidate; newsItem: NewsItem }>,
) {
  if (inputs.length <= 1) return inputs;
  const buckets = new Map<string, Array<{ candidate: DecisionCandidate; newsItem: NewsItem }>>();
  for (const input of inputs) {
    const symbol = recordSymbol(input.candidate);
    const bucket = buckets.get(symbol);
    if (bucket) bucket.push(input);
    else buckets.set(symbol, [input]);
  }

  if (buckets.size <= 1) {
    console.info(
      JSON.stringify({
        type: "claw42_watch_event",
        event: "same_symbol_diversification_unavailable",
        symbol: recordSymbol(inputs[0]!.candidate),
        input_count: inputs.length,
        output_count: 1,
      }),
    );
    return inputs.slice(0, 1);
  }

  const selected: typeof inputs = [];
  while (selected.length < inputs.length) {
    let added = false;
    for (const bucket of Array.from(buckets.values())) {
      const next = bucket.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
    }
    if (!added) break;
  }
  return selected;
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
