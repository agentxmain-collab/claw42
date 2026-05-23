import { promises as fs } from "fs";
import path from "path";
import { generateText } from "@/lib/llm/generateText";
import {
  recordDecisionJudgeMetric,
  runDecisionJudge,
  type DecisionJudgeResult,
} from "@/lib/llm/decisionJudge";
import { mapTeamProviderToProviderId } from "@/lib/llm/providers";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { recordStrategyDecisionRecord } from "@/lib/strategyHistory";
import {
  upsertDecisionRun,
  type DecisionRunRecord,
  type DecisionRunStageStatus,
} from "@/lib/team/decisionRunLedger";
import { assessDecisionQuality, type DecisionQualityReport } from "@/lib/team/decisionQuality";
import { writeDecisionStagePartial } from "@/lib/team/decisionStageWriter";
import { upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import {
  buildEvidenceContextPack,
  dataStatusForMember,
  evidenceIdsForMember,
  formatRoleEvidenceContext,
  shouldAbstainMember,
  type EvidenceContextPack,
} from "@/lib/team/evidenceDispatcher";
import { buildRoleExecutionTrace } from "@/lib/team/roleExecutionPolicy";
import type {
  StrategyDecisionRecord,
  AnalystInputRecord,
  AnalystInputRoundRecord,
  AnalystDataStatus,
  AnalystDirection,
  DecisionStageTraceId,
  DecisionStageTraceStatus,
  DecisionStageTraceEntry,
  DispatchStageRoundRecord,
} from "@/lib/team/strategyDecisionRecord";
import {
  latestAnalystRoundByMember,
  PM_DECISION_ANALYST_ROUNDS,
  runMultiRoundAnalystDebate,
  type MultiRoundAnalystOutput,
} from "@/lib/team/multiRoundPipeline";
import {
  generateTradeDecision,
  type Severity,
  type TradeDecision,
} from "@/lib/team/tradeDecisionPromptBuilder";
import { TEAM_MEMBER_IDS, TEAM_MEMBER_REGISTRY, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  PublicTimelineEvent,
  PublicTimelineImportance,
} from "@/lib/watch/publicTimelineEvent";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import {
  normalizePublicTradeDecision,
  publicDecisionProcessFromRecord,
  publicStageTraceFromRecord,
} from "@/lib/watch/publicTimelineProjection";
import {
  isTradeDisabledCandidate,
  normalizePipelineSymbol,
  storageSymbolForCandidate,
  symbolDecisionCandidate,
} from "@/lib/watch/residentCandidate";
import { appendWatchHistoryEntry } from "@/lib/watchHistoryStore";
import {
  cleanPublicDecisionText,
  containsPublicContentLeak,
} from "@/lib/watch/publicContentGuardrails";
import type { Locale } from "@/i18n/types";
import {
  allTextMatchesLocale,
  buildLocaleInstruction,
  buildLocaleRetryInstruction,
  normalizeWatchLocale,
} from "@/lib/watch/locale";
import type { SignalRecord } from "@/modules/agent-watch/types";
import type { ChatThread } from "@/lib/types";

export type PmDecisionTriggerSource = "cron" | "user_visit_trigger";

const TEAM_LLM_TIMEOUT_MS = 25_000;

export interface PmDecisionPipelineInput {
  triggerSource: PmDecisionTriggerSource;
  candidate?: DecisionCandidate;
  recentMarketSignals: SignalRecord[];
  recentNewsEvidence: NewsEvidence[];
  importanceThreshold?: PublicTimelineImportance;
  locale?: Locale;
  now?: number;
  partialStageUpdates?: boolean;
}

export interface PmDecisionPipelineOutput {
  record: StrategyDecisionRecord;
  publicTimelineEntry: PublicTimelineEvent;
  tradeDecision: TradeDecision | null;
}

interface AnalystOutput {
  memberId: TeamMemberId;
  direction: AnalystDirection;
  confidence: number;
  rationale: string;
  oneLineSummary?: string;
  detailedRationale?: string;
  dataStatus?: AnalystDataStatus;
  citations: string[];
  abstained?: boolean;
}

interface LeadOutput {
  rationale: string;
  confidence: number;
}

interface PipelineDeps {
  saveNewsEvidence?: typeof saveNewsEvidence;
  generateAnalystOutput?: (memberId: TeamMemberId, prompt: string) => Promise<AnalystOutput>;
  generateLeadOutput?: (memberId: TeamMemberId, prompt: string) => Promise<LeadOutput>;
  generateTradeDecision?: typeof generateTradeDecision;
  recordStrategyDecisionRecord?: typeof recordStrategyDecisionRecord;
  updateDecisionRecord?: (record: StrategyDecisionRecord) => Promise<void>;
  runDecisionJudge?: typeof runDecisionJudge;
  writeDecisionStagePartial?: typeof writeDecisionStagePartial;
  appendWatchHistoryEntry?: typeof appendWatchHistoryEntry;
  loadPromptDoc?: (memberId: TeamMemberId) => Promise<string>;
  buildEvidenceContextPack?: typeof buildEvidenceContextPack;
  upsertDecisionRun?: typeof upsertDecisionRun;
}

interface StageAuditMark {
  startedAtMs: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  note?: string;
}

type StageAuditMap = Partial<Record<DecisionStageTraceId, StageAuditMark>>;

const CORE_ANALYST_IDS: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
];

const UPGRADED_MEMBER_IDS: TeamMemberId[] = [
  "bullish_researcher",
  "bearish_researcher",
  "trader",
  "aggressive_reviewer",
  "neutral_reviewer",
  "conservative_reviewer",
  "memory_loop",
];

const PIPELINE_INPUT_MEMBER_IDS: TeamMemberId[] = [...CORE_ANALYST_IDS, ...UPGRADED_MEMBER_IDS];

const PROMPT_VERSION = "pm-decision-pipeline-v2";

function importanceRank(value: PublicTimelineImportance) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[value];
}

function signalImportance(signal: SignalRecord): PublicTimelineImportance {
  if (signal.severity === "alert") return "high";
  if (signal.severity === "watch") return "medium";
  return "low";
}

function newsImportance(evidence: NewsEvidence): PublicTimelineImportance {
  if (evidence.impactSeverity === "high") return "high";
  if (evidence.impactSeverity === "medium") return "medium";
  return "low";
}

function shouldRunPipeline(input: PmDecisionPipelineInput) {
  const threshold = input.importanceThreshold ?? "high";
  return (
    input.recentMarketSignals.some(
      (signal) => importanceRank(signalImportance(signal)) >= importanceRank(threshold),
    ) ||
    input.recentNewsEvidence.some(
      (evidence) => importanceRank(newsImportance(evidence)) >= importanceRank(threshold),
    )
  );
}

async function defaultLoadPromptDoc(memberId: TeamMemberId): Promise<string> {
  const promptDocPath = TEAM_MEMBER_REGISTRY[memberId].promptDocPath;
  return fs.readFile(path.join(process.cwd(), promptDocPath), "utf8").catch(() => "");
}

function normalizeDirection(value: unknown): AnalystOutput["direction"] {
  if (value === "long" || value === "short") return value;
  if (value === "neutral" || value === "wait") return value;
  return "wait";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function normalizeCitations(value: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item))
    .filter((id) => allowedIds.has(id))
    .slice(0, 4);
}

function normalizeDataStatus(value: unknown, fallback: AnalystDataStatus): AnalystDataStatus {
  return value === "ok" || value === "partial" || value === "missing" ? value : fallback;
}

function tradeInputDirection(direction: AnalystDirection): "long" | "short" | "neutral" {
  return direction === "long" || direction === "short" ? direction : "neutral";
}

function publicDirectionForContext(direction: AnalystDirection) {
  if (direction === "wait") return "no-action";
  return direction;
}

function buildAnalysisSummary({
  candidate,
  analystOutputs,
  researchLead,
  riskLead,
}: {
  candidate: DecisionCandidate;
  analystOutputs: AnalystOutput[];
  researchLead: LeadOutput;
  riskLead: LeadOutput;
}) {
  const strongest = [...analystOutputs]
    .filter((output) => output.rationale)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2)
    .map((output) => output.oneLineSummary || oneLineSummaryFromRationale(output.rationale));
  return truncateText(
    [`${candidate.displayTitle}: ${researchLead.rationale}`, riskLead.rationale, ...strongest]
      .filter(Boolean)
      .join(" "),
    520,
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function oneLineSummaryFromRationale(rationale: string) {
  return truncateText(rationale.replace(/\s+/g, " "), 80);
}

function outputLeaksPublicContent(output: {
  rationale?: string;
  oneLineSummary?: string;
  detailedRationale?: string;
}) {
  return [output.rationale, output.oneLineSummary, output.detailedRationale].some((text) =>
    containsPublicContentLeak(text),
  );
}

function buildPublicRewriteRetryInstruction() {
  return [
    "The previous JSON used backstage wording that cannot appear in public output.",
    "Rewrite the public text as a market-facing decision note.",
    "Use only price action, risk/reward, consensus strength, and concrete invalidation levels.",
    "Do not mention connectors, dataset availability, future source updates, operational state, or internal participant identifiers.",
    "If there is no market-facing point to make, return an empty rationale and confidence 0.",
  ].join("\n");
}

function parseObject(text: string): Record<string, unknown> {
  const source = text.trim().match(/\{[\s\S]*\}/)?.[0] ?? text.trim();
  const parsed = JSON.parse(source) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM output must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function ensureLocaleText(locale: Locale, fields: string[], label: string) {
  if (!allTextMatchesLocale(locale, fields)) {
    throw new Error(`${label} output violated locale ${locale}`);
  }
}

async function defaultGenerateAnalystOutput(
  memberId: TeamMemberId,
  prompt: string,
  allowedEvidenceIds: Set<string>,
  locale: Locale,
  fallbackDataStatus: AnalystDataStatus,
): Promise<AnalystOutput> {
  let lastError: unknown = null;
  for (const attempt of ["first", "retry"] as const) {
    const text = await generateText(
      attempt === "first"
        ? prompt
        : `${prompt}\n\n${buildLocaleRetryInstruction(
            locale,
          )}\n\n${buildPublicRewriteRetryInstruction()}`,
      {
        taskTag: `watch:pm-decision:${memberId}:${locale}:${attempt}`,
        temperature: 0.35,
        maxTokens: 500,
        enableGuardrails: false,
        providerOverride: mapTeamProviderToProviderId(
          TEAM_MEMBER_REGISTRY[memberId].defaultProvider,
        ),
        timeoutMs: TEAM_LLM_TIMEOUT_MS,
      },
    );
    try {
      const parsed = parseObject(text);
      const detailedRationale = cleanText(parsed.detailedRationale ?? parsed.rationale);
      const rationale = detailedRationale;
      if (!rationale) throw new Error(`${memberId} missing rationale`);
      ensureLocaleText(locale, [rationale], `${memberId} analyst`);
      const oneLineSummary =
        cleanText(parsed.oneLineSummary) || oneLineSummaryFromRationale(rationale);
      const dataStatus = normalizeDataStatus(parsed.dataStatus, fallbackDataStatus);
      if (outputLeaksPublicContent({ rationale, oneLineSummary, detailedRationale })) {
        throw new Error(`${memberId} analyst output leaked backend/internal wording`);
      }
      return {
        memberId,
        direction: normalizeDirection(parsed.direction),
        confidence: normalizeConfidence(parsed.confidence),
        rationale,
        oneLineSummary,
        detailedRationale,
        dataStatus,
        citations: normalizeCitations(parsed.citations, allowedEvidenceIds),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${memberId} analyst generation failed`);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function abstainAnalystOutput(memberId: TeamMemberId, error: unknown): AnalystOutput {
  if (process.env.NODE_ENV !== "test") {
    console.warn("[claw42] PM analyst role abstained", {
      memberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return {
    memberId,
    direction: "wait",
    confidence: 0,
    rationale: "",
    oneLineSummary: "",
    detailedRationale: "",
    dataStatus: "missing",
    citations: [],
    abstained: true,
  };
}

async function generateAnalystWithFallback({
  memberId,
  prompt,
  generateAnalyst,
  locale,
}: {
  memberId: TeamMemberId;
  prompt: string;
  generateAnalyst: (memberId: TeamMemberId, prompt: string) => Promise<AnalystOutput>;
  locale: Locale;
}) {
  try {
    return await withTimeout(
      generateAnalyst(memberId, prompt),
      30_000,
      `PM analyst generation ${memberId}`,
    );
  } catch (error) {
    void locale;
    return abstainAnalystOutput(memberId, error);
  }
}

async function defaultGenerateLeadOutput(
  memberId: TeamMemberId,
  prompt: string,
  locale: Locale,
): Promise<LeadOutput> {
  let lastError: unknown = null;
  for (const attempt of ["first", "retry"] as const) {
    const text = await generateText(
      attempt === "first"
        ? prompt
        : `${prompt}\n\n${buildLocaleRetryInstruction(
            locale,
          )}\n\n${buildPublicRewriteRetryInstruction()}`,
      {
        taskTag: `watch:pm-decision:${memberId}:${locale}:${attempt}`,
        temperature: 0.25,
        maxTokens: 520,
        enableGuardrails: false,
        providerOverride: mapTeamProviderToProviderId(
          TEAM_MEMBER_REGISTRY[memberId].defaultProvider,
        ),
        timeoutMs: TEAM_LLM_TIMEOUT_MS,
      },
    );
    try {
      const parsed = parseObject(text);
      const rationale = String(parsed.rationale ?? parsed.thesis ?? parsed.rebuttal ?? "").trim();
      if (!rationale) throw new Error(`${memberId} missing rationale`);
      ensureLocaleText(locale, [rationale], `${memberId} lead`);
      if (containsPublicContentLeak(rationale)) {
        throw new Error(`${memberId} lead output leaked backend/internal wording`);
      }
      return {
        rationale,
        confidence: normalizeConfidence(parsed.confidence ?? parsed.consensusLevel),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${memberId} lead generation failed`);
}

function marketContext(input: PmDecisionPipelineInput) {
  return input.recentMarketSignals
    .map((signal) => {
      const parts = [
        `${signal.symbol} ${signal.type} ${signal.severity}`,
        signal.payload.priceLevel !== undefined ? `priceLevel=${signal.payload.priceLevel}` : null,
        signal.payload.change24h !== undefined ? `change24h=${signal.payload.change24h}` : null,
        signal.payload.description,
      ].filter(Boolean);
      return `- ${parts.join(" / ")}`;
    })
    .join("\n");
}

function newsContext(input: PmDecisionPipelineInput) {
  return input.recentNewsEvidence
    .map(
      (evidence) => `- ${evidence.id}: ${evidence.title} (${evidence.source}) ${evidence.summary}`,
    )
    .join("\n");
}

function candidateContext(candidate: DecisionCandidate) {
  return [
    `candidateType=${candidate.candidateType}`,
    `candidateKey=${candidate.candidateKey}`,
    candidate.symbol ? `symbol=${candidate.symbol}` : null,
    `displayTitle=${candidate.displayTitle}`,
    `executable=${candidate.executable ? "true" : "false"}`,
    `cadence=${candidate.cadence}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function tradeDisabledPromptRules(candidate: DecisionCandidate) {
  if (!isTradeDisabledCandidate(candidate)) return "";
  return `
## Analysis-only candidate
This candidate is not a follow-trade setup. Do not write entry, stop loss, take profit, position sizing, or order execution instructions.
Focus on market regime, narrative strength, risk boundaries, and what would change the read.
Use direction as market bias only: long/short/neutral/wait.`;
}

async function buildMemberPrompt(
  memberId: TeamMemberId,
  input: PmDecisionPipelineInput,
  deps: PipelineDeps,
  evidencePack: EvidenceContextPack,
  candidate: DecisionCandidate,
) {
  const promptDoc = await (deps.loadPromptDoc ?? defaultLoadPromptDoc)(memberId);
  return `${promptDoc}

You are participating in the Claw42 PM decision pipeline.
## Candidate
${candidateContext(candidate)}
${tradeDisabledPromptRules(candidate)}

Return JSON only:
{
  "direction": "long" | "short" | "neutral" | "wait",
  "confidence": 0.0_to_1.0,
  "oneLineSummary": "one sentence, <=80 Chinese chars or <=120 English chars",
  "detailedRationale": "concrete role-specific rationale with numbers when available, <=500 chars",
  "dataStatus": "ok" | "partial" | "missing",
  "rationale": "same meaning as detailedRationale for legacy compatibility",
  "citations": ["evidenceId"]
}

Rules:
- Stay inside your role mandate. Do not evaluate domains that are not listed in your role evidence context.
- Use available role evidence to form a stance when there is a concrete signal.
- If role evidence is thin, lower confidence, set internal "dataStatus" to "partial" or "missing", and explain the decision basis without mentioning backend data availability.
- Return "wait" only when your role evidence has no actionable signal. Do not invent a trade stance.
- Public fields oneLineSummary, detailedRationale, and rationale must describe market evidence only; never discuss backend operations, source coverage, future data arrival, process state, or internal participant identifiers.
- If you cannot make a professional public point from the shown evidence, return an empty rationale and confidence 0.

## Locale
${buildLocaleInstruction(normalizeWatchLocale(input.locale))}

${formatRoleEvidenceContext(memberId, evidencePack)}`;
}

async function buildLeadPrompt(
  memberId: TeamMemberId,
  input: PmDecisionPipelineInput,
  candidate: DecisionCandidate,
  analystOutputs: AnalystOutput[],
  previousLead?: LeadOutput,
  deps?: PipelineDeps,
) {
  const promptDoc = await (deps?.loadPromptDoc ?? defaultLoadPromptDoc)(memberId);
  return `${promptDoc}

Return JSON only:
{
  "rationale": "short concrete ${memberId === "risk_lead" ? "risk rebuttal" : "research thesis"}",
  "confidence": 0.0_to_1.0
}

## Locale
${buildLocaleInstruction(normalizeWatchLocale(input.locale))}

## Candidate
${candidateContext(candidate)}
${tradeDisabledPromptRules(candidate)}

## Analyst outputs
${analystOutputs
  .map(
    (output, index) =>
      `- decision view ${index + 1}: stance=${publicDirectionForContext(output.direction)} confidence=${output.confidence.toFixed(
        2,
      )} ${output.rationale}`,
  )
  .join("\n")}

## Previous lead
${previousLead?.rationale ?? "- none"}

## Market signals
${marketContext(input) || "- none"}

## News evidence
${newsContext(input) || "- none"}`;
}

function currentPriceFromSignals(signals: SignalRecord[]): number | null {
  const price = signals.find((signal) => typeof signal.payload.priceLevel === "number")?.payload
    .priceLevel;
  return price && price > 0 ? price : null;
}

function candidateFromInput(input: PmDecisionPipelineInput): DecisionCandidate | null {
  if (input.candidate) return input.candidate;
  const symbol =
    normalizePipelineSymbol(input.recentMarketSignals[0]?.symbol) ??
    normalizePipelineSymbol(
      input.recentNewsEvidence.find((evidence) => evidence.symbol[0])?.symbol[0],
    );
  return symbol ? symbolDecisionCandidate({ symbol }) : null;
}

function symbolFromCandidate(candidate: DecisionCandidate) {
  return storageSymbolForCandidate(candidate);
}

function toSeverity(input: PmDecisionPipelineInput): Severity {
  const hasHighNews = input.recentNewsEvidence.some(
    (evidence) => evidence.impactSeverity === "high",
  );
  const hasAlertSignal = input.recentMarketSignals.some((signal) => signal.severity === "alert");
  return hasHighNews || hasAlertSignal ? "high" : "medium";
}

function startStage(audit: StageAuditMap, stageId: DecisionStageTraceId) {
  const startedAtMs = Date.now();
  audit[stageId] = {
    startedAtMs,
    startedAt: new Date(startedAtMs).toISOString(),
  };
}

function completeStage(audit: StageAuditMap, stageId: DecisionStageTraceId, note?: string) {
  const completedAtMs = Date.now();
  const existing = audit[stageId] ?? {
    startedAtMs: completedAtMs,
    startedAt: new Date(completedAtMs).toISOString(),
  };
  audit[stageId] = {
    ...existing,
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: Math.max(0, completedAtMs - existing.startedAtMs),
    ...(note ? { note } : {}),
  };
}

function stageAuditFields(audit: StageAuditMap, stageId: DecisionStageTraceId) {
  const mark = audit[stageId];
  if (!mark) return {};
  return {
    startedAt: mark.startedAt,
    ...(mark.completedAt ? { completedAt: mark.completedAt } : {}),
    ...(mark.durationMs !== undefined ? { durationMs: mark.durationMs } : {}),
    ...(mark.note ? { note: mark.note } : {}),
  };
}

function analystRoundsForMember(
  memberId: TeamMemberId,
  outputs: readonly MultiRoundAnalystOutput[],
): AnalystInputRoundRecord[] {
  return outputs
    .filter((output) => output.memberId === memberId)
    .sort((a, b) => a.round - b.round)
    .map((output) => ({
      round: output.round,
      direction: output.direction,
      confidence: output.confidence,
      rationale: output.rationale,
      oneLineSummary: output.oneLineSummary,
      detailedRationale: output.detailedRationale,
      dataStatus: output.dataStatus,
      evidenceIds: output.citations,
      observedAt: output.observedAt,
    }));
}

function singleRoundRecord({
  direction,
  confidence,
  rationale,
  evidenceIds,
  observedAt,
  oneLineSummary,
  detailedRationale,
  dataStatus = "ok",
}: {
  direction: AnalystInputRoundRecord["direction"];
  confidence: number;
  rationale: string;
  evidenceIds: string[];
  observedAt: string;
  oneLineSummary?: string;
  detailedRationale?: string;
  dataStatus?: AnalystDataStatus;
}): AnalystInputRoundRecord[] {
  return [
    {
      round: PM_DECISION_ANALYST_ROUNDS,
      direction,
      confidence,
      rationale,
      oneLineSummary: oneLineSummary ?? oneLineSummaryFromRationale(rationale),
      detailedRationale: detailedRationale ?? rationale,
      dataStatus,
      evidenceIds,
      observedAt,
    },
  ];
}

function latestAnalystOutputsMemberIds(outputs: readonly AnalystOutput[]) {
  return outputs.map((output) => output.memberId);
}

function evidenceIdsFromAnalystOutputs(outputs: readonly AnalystOutput[]) {
  return Array.from(new Set(outputs.flatMap((output) => output.citations)));
}

function makeRecord({
  input,
  candidate,
  now,
  analystOutputs,
  analystRoundOutputs,
  researchLead,
  riskLead,
  tradeDecision,
  analysisSummary,
  stageAudit,
  evidencePack,
  abstainedInputMemberIds,
}: {
  input: PmDecisionPipelineInput;
  candidate: DecisionCandidate;
  now: number;
  analystOutputs: AnalystOutput[];
  analystRoundOutputs: MultiRoundAnalystOutput[];
  researchLead: LeadOutput;
  riskLead: LeadOutput;
  tradeDecision: TradeDecision | null;
  analysisSummary?: string;
  stageAudit: StageAuditMap;
  evidencePack: EvidenceContextPack;
  abstainedInputMemberIds: TeamMemberId[];
}): StrategyDecisionRecord {
  const symbol = symbolFromCandidate(candidate);
  const locale = normalizeWatchLocale(input.locale);
  const observedAt = new Date(now).toISOString();
  const pmRationale = tradeDecision
    ? `${tradeDecision.riskNote} ${tradeDecision.invalidatesIf}`.trim()
    : (analysisSummary ?? "Analysis-only summary generated.");
  const analystInputs: AnalystInputRecord[] = [
    ...analystOutputs.map((output) => ({
      memberId: output.memberId,
      direction: output.direction,
      confidence: output.confidence,
      rationale: output.rationale,
      oneLineSummary: output.oneLineSummary,
      detailedRationale: output.detailedRationale,
      dataStatus: output.dataStatus,
      evidenceIds: output.citations,
      rounds: analystRoundsForMember(output.memberId, analystRoundOutputs),
    })),
    {
      memberId: "research_lead",
      direction: "neutral",
      confidence: researchLead.confidence,
      rationale: researchLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
      rounds: singleRoundRecord({
        direction: "neutral",
        confidence: researchLead.confidence,
        rationale: researchLead.rationale,
        evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
        observedAt,
      }),
    },
    {
      memberId: "risk_lead",
      direction: "neutral",
      confidence: riskLead.confidence,
      rationale: riskLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
      rounds: singleRoundRecord({
        direction: "neutral",
        confidence: riskLead.confidence,
        rationale: riskLead.rationale,
        evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
        observedAt,
      }),
    },
    {
      memberId: "pm",
      direction:
        tradeDecision?.direction === "long" || tradeDecision?.direction === "short"
          ? tradeDecision.direction
          : "neutral",
      confidence: tradeDecision?.confidence ?? 0.5,
      rationale: pmRationale,
      oneLineSummary: tradeDecision
        ? oneLineSummaryFromRationale(tradeDecision.riskNote)
        : oneLineSummaryFromRationale(pmRationale),
      detailedRationale: pmRationale,
      dataStatus: "ok",
      evidenceIds: tradeDecision?.evidenceIds ?? [],
      rounds: singleRoundRecord({
        direction:
          tradeDecision?.direction === "long" || tradeDecision?.direction === "short"
            ? tradeDecision.direction
            : "neutral",
        confidence: tradeDecision?.confidence ?? 0.5,
        rationale: pmRationale,
        oneLineSummary: tradeDecision
          ? oneLineSummaryFromRationale(tradeDecision.riskNote)
          : oneLineSummaryFromRationale(pmRationale),
        detailedRationale: pmRationale,
        dataStatus: "ok",
        evidenceIds: tradeDecision?.evidenceIds ?? [],
        observedAt,
      }),
    },
  ];

  return {
    id: `pm:${symbol}:${now}`,
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    candidate,
    ...(analysisSummary ? { analysisSummary } : {}),
    locale,
    decisionOwnerId: "pm",
    contributorIds: TEAM_MEMBER_IDS,
    analystInputs,
    stageTrace: makeStageTrace(observedAt, tradeDecision, stageAudit, analystRoundOutputs),
    roleExecutionTrace: buildRoleExecutionTrace({
      evidencePack,
      activeInputMemberIds: PIPELINE_INPUT_MEMBER_IDS.filter(
        (memberId) => !shouldAbstainMember(memberId, evidencePack),
      ),
      executedInputMemberIds: latestAnalystOutputsMemberIds(analystOutputs),
      abstainedInputMemberIds,
      materialContributorIds: [
        ...latestAnalystOutputsMemberIds(analystOutputs),
        "research_lead",
        "risk_lead",
        "pm",
      ],
      warningMemberIds: ["risk_lead"],
      pmEvidenceIds: tradeDecision?.evidenceIds ?? evidenceIdsFromAnalystOutputs(analystOutputs),
      leadEvidenceIds: [
        ...input.recentNewsEvidence.map((evidence) => evidence.id),
        ...evidenceIdsFromAnalystOutputs(analystOutputs),
      ],
    }),
    sourceThreadId: null,
    tradeDecision,
    createdAt: new Date(now).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: PROMPT_VERSION,
    modelProvider: tradeDecision?.modelProvider ?? "llm-chain",
    legacyFactionId: null,
  };
}

function makePartialRecord({
  input,
  candidate,
  now,
  analystOutputs,
  analystRoundOutputs,
  researchLead,
  riskLead,
  activeStage,
  stageAudit,
  evidencePack,
  abstainedInputMemberIds,
}: {
  input: PmDecisionPipelineInput;
  candidate: DecisionCandidate;
  now: number;
  analystOutputs: AnalystOutput[];
  analystRoundOutputs: MultiRoundAnalystOutput[];
  researchLead?: LeadOutput;
  riskLead?: LeadOutput;
  activeStage: "research_lead" | "risk_lead" | "trade_decision";
  stageAudit: StageAuditMap;
  evidencePack: EvidenceContextPack;
  abstainedInputMemberIds: TeamMemberId[];
}): StrategyDecisionRecord {
  const symbol = symbolFromCandidate(candidate);
  const locale = normalizeWatchLocale(input.locale);
  const observedAt = new Date().toISOString();
  const analystInputs: AnalystInputRecord[] = analystOutputs.map((output) => ({
    memberId: output.memberId,
    direction: output.direction,
    confidence: output.confidence,
    rationale: output.rationale,
    oneLineSummary: output.oneLineSummary,
    detailedRationale: output.detailedRationale,
    dataStatus: output.dataStatus,
    evidenceIds: output.citations,
    rounds: analystRoundsForMember(output.memberId, analystRoundOutputs),
  }));

  if (researchLead) {
    analystInputs.push({
      memberId: "research_lead",
      direction: "neutral",
      confidence: researchLead.confidence,
      rationale: researchLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
      rounds: singleRoundRecord({
        direction: "neutral",
        confidence: researchLead.confidence,
        rationale: researchLead.rationale,
        evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
        observedAt,
      }),
    });
  }

  if (riskLead) {
    analystInputs.push({
      memberId: "risk_lead",
      direction: "neutral",
      confidence: riskLead.confidence,
      rationale: riskLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
      rounds: singleRoundRecord({
        direction: "neutral",
        confidence: riskLead.confidence,
        rationale: riskLead.rationale,
        evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
        observedAt,
      }),
    });
  }

  return {
    id: `pm:${symbol}:${now}`,
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    candidate,
    locale,
    decisionOwnerId: "pm",
    contributorIds: TEAM_MEMBER_IDS,
    analystInputs,
    stageTrace: makePartialStageTrace({
      observedAt,
      activeStage,
      researchLead,
      riskLead,
      stageAudit,
      analystRoundOutputs,
    }),
    roleExecutionTrace: buildRoleExecutionTrace({
      evidencePack,
      activeInputMemberIds: PIPELINE_INPUT_MEMBER_IDS.filter(
        (memberId) => !shouldAbstainMember(memberId, evidencePack),
      ),
      executedInputMemberIds: latestAnalystOutputsMemberIds(analystOutputs),
      abstainedInputMemberIds,
      materialContributorIds: [
        ...latestAnalystOutputsMemberIds(analystOutputs),
        ...(researchLead ? (["research_lead"] as const) : []),
        ...(riskLead ? (["risk_lead"] as const) : []),
      ],
      warningMemberIds: riskLead ? ["risk_lead"] : [],
      leadEvidenceIds: [
        ...input.recentNewsEvidence.map((evidence) => evidence.id),
        ...evidenceIdsFromAnalystOutputs(analystOutputs),
      ],
    }),
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(now).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: PROMPT_VERSION,
    modelProvider: "llm-chain",
    legacyFactionId: null,
  };
}

function makeStageTrace(
  observedAt: string,
  tradeDecision: TradeDecision | null,
  stageAudit: StageAuditMap,
  analystRoundOutputs: readonly MultiRoundAnalystOutput[],
): DecisionStageTraceEntry[] {
  const analystRounds: DispatchStageRoundRecord[] = Array.from(
    { length: PM_DECISION_ANALYST_ROUNDS },
    (_, index) => {
      const round = index + 1;
      const roundOutputs = analystRoundOutputs.filter((output) => output.round === round);
      return {
        round,
        label: round === 1 ? "Independent analyst pass" : "Refinement pass",
        status: "done" as const,
        observedAt: roundOutputs.at(-1)?.observedAt ?? observedAt,
        memberIds: roundOutputs.map((output) => output.memberId),
        note: `${roundOutputs.length} analyst outputs`,
      };
    },
  );

  return [
    {
      stageId: "analyst_inputs",
      label: "Analyst input generation",
      status: "done",
      observedAt,
      memberIds: PIPELINE_INPUT_MEMBER_IDS,
      rounds: analystRounds,
      ...stageAuditFields(stageAudit, "analyst_inputs"),
    },
    {
      stageId: "research_lead",
      label: "Research synthesis",
      status: "done",
      observedAt,
      memberIds: ["research_lead"],
      ...stageAuditFields(stageAudit, "research_lead"),
    },
    {
      stageId: "risk_lead",
      label: "Risk review",
      status: "done",
      observedAt,
      memberIds: ["risk_lead"],
      ...stageAuditFields(stageAudit, "risk_lead"),
    },
    {
      stageId: "trade_decision",
      label: "PM trade decision",
      status: "done",
      observedAt,
      memberIds: ["pm"],
      ...stageAuditFields(stageAudit, "trade_decision"),
      ...(tradeDecision
        ? {
            modelProvider: tradeDecision.modelProvider,
            promptVersion: tradeDecision.promptVersion,
          }
        : {}),
    },
    {
      stageId: "record_write",
      label: "Decision record persistence",
      status: "pending",
      observedAt,
      ...stageAuditFields(stageAudit, "record_write"),
    },
    {
      stageId: "public_timeline",
      label: "Public timeline projection",
      status: "pending",
      observedAt,
      ...stageAuditFields(stageAudit, "public_timeline"),
    },
  ];
}

function makePartialStageTrace({
  observedAt,
  activeStage,
  researchLead,
  riskLead,
  stageAudit,
  analystRoundOutputs,
}: {
  observedAt: string;
  activeStage: "research_lead" | "risk_lead" | "trade_decision";
  researchLead?: LeadOutput;
  riskLead?: LeadOutput;
  stageAudit: StageAuditMap;
  analystRoundOutputs: readonly MultiRoundAnalystOutput[];
}): DecisionStageTraceEntry[] {
  const analystRounds: DispatchStageRoundRecord[] = Array.from(
    { length: PM_DECISION_ANALYST_ROUNDS },
    (_, index) => {
      const round = index + 1;
      const roundOutputs = analystRoundOutputs.filter((output) => output.round === round);
      return {
        round,
        label: round === 1 ? "Independent analyst pass" : "Refinement pass",
        status: "done" as const,
        observedAt: roundOutputs.at(-1)?.observedAt ?? observedAt,
        memberIds: roundOutputs.map((output) => output.memberId),
        note: `${roundOutputs.length} analyst outputs`,
      };
    },
  );
  const researchStatus =
    activeStage === "research_lead" ? "in_progress" : researchLead ? "done" : "pending";
  const riskStatus = activeStage === "risk_lead" ? "in_progress" : riskLead ? "done" : "pending";
  const tradeStatus = activeStage === "trade_decision" ? "in_progress" : "pending";

  return [
    {
      stageId: "analyst_inputs",
      label: "Analyst input generation",
      status: "done",
      observedAt,
      memberIds: PIPELINE_INPUT_MEMBER_IDS,
      rounds: analystRounds,
      ...stageAuditFields(stageAudit, "analyst_inputs"),
    },
    {
      stageId: "research_lead",
      label: "Research synthesis",
      status: researchStatus,
      observedAt,
      memberIds: ["research_lead"],
      ...stageAuditFields(stageAudit, "research_lead"),
    },
    {
      stageId: "risk_lead",
      label: "Risk review",
      status: riskStatus,
      observedAt,
      memberIds: ["risk_lead"],
      ...stageAuditFields(stageAudit, "risk_lead"),
    },
    {
      stageId: "trade_decision",
      label: "PM trade decision",
      status: tradeStatus,
      observedAt,
      memberIds: ["pm"],
      ...stageAuditFields(stageAudit, "trade_decision"),
    },
    {
      stageId: "record_write",
      label: "Decision record persistence",
      status: "pending",
      observedAt,
      ...stageAuditFields(stageAudit, "record_write"),
    },
    {
      stageId: "public_timeline",
      label: "Public timeline projection",
      status: "pending",
      observedAt,
      ...stageAuditFields(stageAudit, "public_timeline"),
    },
  ];
}

function withStageTraceStatus(
  record: StrategyDecisionRecord,
  stageId: DecisionStageTraceId,
  status: DecisionStageTraceStatus,
  observedAt: string,
  audit?: StageAuditMap,
): StrategyDecisionRecord {
  return {
    ...record,
    stageTrace: record.stageTrace?.map((stage) =>
      stage.stageId === stageId
        ? {
            ...stage,
            status,
            observedAt,
            ...(audit ? stageAuditFields(audit, stageId) : {}),
          }
        : stage,
    ),
  };
}

function makePublicTimelineEntry(
  record: StrategyDecisionRecord,
  evidenceIds: string[],
): PublicTimelineEvent {
  const derived = publicDecisionProcessFromRecord(record);
  return {
    id: `public:${record.id}`,
    ts: Date.parse(record.createdAt),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds,
    locale: record.locale,
    payload: {
      kind: "pm_decision",
      recordId: record.id,
      symbol: record.symbol,
      candidateType: record.candidate?.candidateType,
      candidateKey: record.candidate?.candidateKey,
      displayTitle: record.candidate?.displayTitle,
      executable: record.candidate?.executable,
      analysisSummary: record.analysisSummary,
      tradeDecision: normalizePublicTradeDecision(record.tradeDecision),
      rationaleByAgent: derived.rationaleByAgent,
      citationsByAgent: derived.citationsByAgent,
      rounds: derived.rounds,
      stageTrace: publicStageTraceFromRecord(record, {
        hasRenderableTradeDecision: Boolean(normalizePublicTradeDecision(record.tradeDecision)),
        analysisOnlyCandidate: Boolean(
          record.candidate && record.candidate.candidateType !== "symbol",
        ),
      }),
    },
  };
}

function runIdFor(symbol: string, now: number) {
  return `run:pm:${symbol}:${now}`;
}

function candidateRunSnapshot(candidate: DecisionCandidate): DecisionRunRecord["candidate"] {
  return {
    candidateType: candidate.candidateType,
    candidateKey: candidate.candidateKey,
    displayTitle: candidate.displayTitle,
    executable: candidate.executable,
    ...(candidate.symbol ? { symbol: candidate.symbol } : {}),
  };
}

function stageStatusFromAudit(
  stageAudit: StageAuditMap,
  activeStage?: DecisionStageTraceId,
  failedStage?: DecisionStageTraceId,
): DecisionRunRecord["stageStatus"] {
  const stageIds: DecisionStageTraceId[] = [
    "analyst_inputs",
    "research_lead",
    "risk_lead",
    "trade_decision",
    "record_write",
    "public_timeline",
  ];
  return Object.fromEntries(
    stageIds.map((stageId) => {
      let status: DecisionRunStageStatus = "pending";
      if (stageAudit[stageId]?.completedAt) status = "done";
      if (activeStage === stageId) status = "in_progress";
      if (failedStage === stageId) status = "failed";
      return [stageId, status];
    }),
  );
}

function buildDecisionRun({
  id,
  status,
  triggerSource,
  locale,
  candidate,
  symbol,
  startedAt,
  completedAt = null,
  stageAudit,
  activeStage,
  failedStage,
  analystRoundCount = 0,
  activeMemberIds = [],
  abstainedMemberIds = [],
  decisionRecordId = null,
  publicTimelineEventId = null,
  quality,
  error = null,
  skipReason = null,
}: {
  id: string;
  status: DecisionRunRecord["status"];
  triggerSource: PmDecisionTriggerSource;
  locale: Locale;
  candidate: DecisionCandidate;
  symbol: string;
  startedAt: string;
  completedAt?: string | null;
  stageAudit: StageAuditMap;
  activeStage?: DecisionStageTraceId;
  failedStage?: DecisionStageTraceId;
  analystRoundCount?: number;
  activeMemberIds?: TeamMemberId[];
  abstainedMemberIds?: TeamMemberId[];
  decisionRecordId?: string | null;
  publicTimelineEventId?: string | null;
  quality?: DecisionQualityReport;
  error?: string | null;
  skipReason?: string | null;
}): DecisionRunRecord {
  return {
    id,
    schemaVersion: 1,
    status,
    triggerSource,
    locale,
    candidate: candidateRunSnapshot(candidate),
    symbol,
    startedAt,
    completedAt,
    stageStatus: stageStatusFromAudit(stageAudit, activeStage, failedStage),
    analystRoundCount,
    activeMemberIds,
    abstainedMemberIds,
    decisionRecordId,
    publicTimelineEventId,
    ...(quality ? { quality } : {}),
    error,
    skipReason,
  };
}

function isBlockingJudgeFailure(judge: DecisionJudgeResult) {
  return judge.verdict === "fail" && Boolean(judge.fail_reason) && judge.confidence >= 0.5;
}

function evidenceIdsForPartial(
  input: PmDecisionPipelineInput,
  analystRoundOutputs: readonly MultiRoundAnalystOutput[],
) {
  return Array.from(
    new Set([
      ...input.recentNewsEvidence.map((evidence) => evidence.id),
      ...analystRoundOutputs.flatMap((output) => output.citations),
    ]),
  );
}

function timelineEntryAsChatThread(
  record: StrategyDecisionRecord,
  evidenceIds: string[],
): Parameters<typeof appendWatchHistoryEntry>[0] {
  const now = Date.parse(record.createdAt);
  const thread: ChatThread = {
    id: record.id,
    seed: {
      id: record.id,
      type: "market",
      title: `${record.candidate?.displayTitle ?? record.symbol} PM decision`,
      description: "Claw42 PM decision pipeline",
      symbols: record.candidate?.symbol ? [record.candidate.symbol] : [],
      sentiment: "neutral",
      createdAt: now,
    },
    messages: [],
    strategy: null,
    status: "completed",
    createdAt: now,
    completedAt: now,
    symbol: record.symbol,
  };
  return {
    kind: "chat_thread",
    id: `pm-decision:${record.id}`,
    ts: now,
    thread,
    meta: {
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds,
      locale: record.locale,
      recordId: record.id,
      tradeDecision: record.tradeDecision,
    },
  };
}

export async function runPmDecisionPipeline(
  input: PmDecisionPipelineInput,
  deps: PipelineDeps = {},
): Promise<PmDecisionPipelineOutput | null> {
  const now = input.now ?? Date.now();
  const locale = normalizeWatchLocale(input.locale);
  const localizedInput = { ...input, locale };
  const candidate = candidateFromInput(localizedInput);
  if (!candidate) return null;
  const runCandidate = candidate;
  const tradeDisabled = isTradeDisabledCandidate(runCandidate);
  const symbol = symbolFromCandidate(runCandidate);
  const stageAudit: StageAuditMap = {};
  const runId = runIdFor(symbol, now);
  const runStartedAt = new Date(now).toISOString();
  const runWriter = deps.upsertDecisionRun ?? upsertDecisionRun;
  let latestActiveMemberIds: TeamMemberId[] = [];
  let latestAbstainedMemberIds: TeamMemberId[] = [];
  let latestAnalystRoundCount = 0;
  async function writeRun(run: DecisionRunRecord) {
    try {
      await runWriter(run);
    } catch (error) {
      console.warn("[claw42] PM decision run ledger write skipped", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async function writeSkippedRun({
    skipReason,
    activeStage,
    failedStage,
    decisionRecordId = null,
    quality,
    error = null,
  }: {
    skipReason: string;
    activeStage?: DecisionStageTraceId;
    failedStage?: DecisionStageTraceId;
    decisionRecordId?: string | null;
    quality?: DecisionQualityReport;
    error?: string | null;
  }) {
    await writeRun(
      buildDecisionRun({
        id: runId,
        status: "skipped",
        triggerSource: localizedInput.triggerSource,
        locale,
        candidate: runCandidate,
        symbol,
        startedAt: runStartedAt,
        completedAt: new Date(Date.now()).toISOString(),
        stageAudit,
        activeStage,
        failedStage,
        analystRoundCount: latestAnalystRoundCount,
        activeMemberIds: latestActiveMemberIds,
        abstainedMemberIds: latestAbstainedMemberIds,
        decisionRecordId,
        quality,
        error,
        skipReason,
      }),
    );
  }
  if (!tradeDisabled && !shouldRunPipeline(localizedInput)) {
    await writeSkippedRun({ skipReason: "below_importance_threshold" });
    return null;
  }
  await writeRun(
    buildDecisionRun({
      id: runId,
      status: "running",
      triggerSource: localizedInput.triggerSource,
      locale,
      candidate,
      symbol,
      startedAt: runStartedAt,
      stageAudit,
    }),
  );
  const evidencePack = await (deps.buildEvidenceContextPack ?? buildEvidenceContextPack)({
    symbol,
    candidate,
    recentMarketSignals: localizedInput.recentMarketSignals,
    recentNewsEvidence: localizedInput.recentNewsEvidence,
    locale,
  });
  const allowedEvidenceIds = new Set(
    PIPELINE_INPUT_MEMBER_IDS.flatMap((memberId) => evidenceIdsForMember(memberId, evidencePack)),
  );
  const activeInputMemberIds = PIPELINE_INPUT_MEMBER_IDS.filter(
    (memberId) => !shouldAbstainMember(memberId, evidencePack),
  );
  latestActiveMemberIds = activeInputMemberIds;
  latestAbstainedMemberIds = PIPELINE_INPUT_MEMBER_IDS.filter((memberId) =>
    shouldAbstainMember(memberId, evidencePack),
  );
  if (activeInputMemberIds.length === 0) {
    await writeSkippedRun({ skipReason: "all_input_roles_abstained" });
    return null;
  }
  const evidenceWriter = deps.saveNewsEvidence ?? saveNewsEvidence;
  const generateAnalyst =
    deps.generateAnalystOutput ??
    ((memberId: TeamMemberId, prompt: string) =>
      defaultGenerateAnalystOutput(
        memberId,
        prompt,
        allowedEvidenceIds,
        locale,
        dataStatusForMember(memberId, evidencePack),
      ));
  const generateLead =
    deps.generateLeadOutput ??
    ((memberId: TeamMemberId, prompt: string) =>
      defaultGenerateLeadOutput(memberId, prompt, locale));
  const tradeGenerator = deps.generateTradeDecision ?? generateTradeDecision;
  const recordWriter = deps.recordStrategyDecisionRecord ?? recordStrategyDecisionRecord;
  const recordUpdater = deps.updateDecisionRecord ?? upsertDecisionRecord;
  const decisionJudge = deps.runDecisionJudge ?? runDecisionJudge;
  const partialStageWriter = deps.writeDecisionStagePartial ?? writeDecisionStagePartial;
  const watchWriter = deps.appendWatchHistoryEntry ?? appendWatchHistoryEntry;
  let partialHistoryPublished = false;

  async function publishPartialStage(record: StrategyDecisionRecord, evidenceIds: string[]) {
    if (!localizedInput.partialStageUpdates) return record;
    try {
      const partialRecord = await partialStageWriter(record);
      if (!partialHistoryPublished) {
        await watchWriter(timelineEntryAsChatThread(partialRecord, evidenceIds));
        partialHistoryPublished = true;
      }
      return partialRecord;
    } catch (error) {
      console.warn("[claw42] PM partial stage update skipped", {
        recordId: record.id,
        stageTrace: record.stageTrace?.map((stage) => `${stage.stageId}:${stage.status}`),
        error: error instanceof Error ? error.message : String(error),
      });
      return record;
    }
  }

  try {
    await Promise.all(
      localizedInput.recentNewsEvidence.map((evidence) => evidenceWriter(evidence)),
    );
    startStage(stageAudit, "analyst_inputs");
    const analystPrompts = await Promise.all(
      activeInputMemberIds.map(async (memberId) => ({
        memberId,
        prompt: await buildMemberPrompt(memberId, localizedInput, deps, evidencePack, candidate),
      })),
    );
    const analystRoundOutputs = await runMultiRoundAnalystDebate({
      candidates: analystPrompts,
      generateRound: (memberId, prompt) =>
        generateAnalystWithFallback({ memberId, prompt, generateAnalyst, locale }),
    });
    const publicAnalystRoundOutputs = analystRoundOutputs.filter(
      (output) => !output.abstained && cleanPublicDecisionText(output.rationale, locale),
    );
    latestAnalystRoundCount = publicAnalystRoundOutputs.length;
    const latestAnalystOutputs = latestAnalystRoundByMember(publicAnalystRoundOutputs);
    latestActiveMemberIds = activeInputMemberIds;
    latestAbstainedMemberIds = Array.from(
      new Set([
        ...PIPELINE_INPUT_MEMBER_IDS.filter((memberId) => !activeInputMemberIds.includes(memberId)),
        ...activeInputMemberIds.filter((memberId) =>
          analystRoundOutputs.some((output) => output.memberId === memberId && output.abstained),
        ),
      ]),
    );
    if (latestAnalystOutputs.length === 0) {
      await writeSkippedRun({
        skipReason: "no_public_analyst_outputs",
        activeStage: "analyst_inputs",
      });
      return null;
    }
    if (!publicAnalystRoundOutputs.some((output) => output.round === 1)) {
      await writeSkippedRun({
        skipReason: "no_public_analyst_stage_one_outputs",
        activeStage: "analyst_inputs",
      });
      return null;
    }
    completeStage(
      stageAudit,
      "analyst_inputs",
      `${publicAnalystRoundOutputs.length} analyst round outputs`,
    );

    startStage(stageAudit, "research_lead");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        candidate,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs: publicAnalystRoundOutputs,
        activeStage: "research_lead",
        stageAudit,
        evidencePack,
        abstainedInputMemberIds: latestAbstainedMemberIds,
      }),
      evidenceIdsForPartial(localizedInput, publicAnalystRoundOutputs),
    );
    const researchLead = await generateLead(
      "research_lead",
      await buildLeadPrompt(
        "research_lead",
        localizedInput,
        candidate,
        latestAnalystOutputs,
        undefined,
        deps,
      ),
    );
    if (containsPublicContentLeak(researchLead.rationale)) {
      await writeSkippedRun({
        skipReason: "research_lead_content_leak",
        failedStage: "research_lead",
      });
      return null;
    }
    completeStage(stageAudit, "research_lead", "research synthesis generated");
    startStage(stageAudit, "risk_lead");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        candidate,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs: publicAnalystRoundOutputs,
        researchLead,
        activeStage: "risk_lead",
        stageAudit,
        evidencePack,
        abstainedInputMemberIds: latestAbstainedMemberIds,
      }),
      evidenceIdsForPartial(localizedInput, publicAnalystRoundOutputs),
    );
    const riskLead = await generateLead(
      "risk_lead",
      await buildLeadPrompt(
        "risk_lead",
        localizedInput,
        candidate,
        latestAnalystOutputs,
        researchLead,
        deps,
      ),
    );
    if (containsPublicContentLeak(riskLead.rationale)) {
      await writeSkippedRun({
        skipReason: "risk_lead_content_leak",
        failedStage: "risk_lead",
      });
      return null;
    }
    completeStage(stageAudit, "risk_lead", "risk review generated");

    startStage(stageAudit, "trade_decision");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        candidate,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs: publicAnalystRoundOutputs,
        researchLead,
        riskLead,
        activeStage: "trade_decision",
        stageAudit,
        evidencePack,
        abstainedInputMemberIds: latestAbstainedMemberIds,
      }),
      evidenceIdsForPartial(localizedInput, publicAnalystRoundOutputs),
    );
    const tradeInputs = [
      ...latestAnalystOutputs.map((output) => ({
        memberId: output.memberId,
        direction: tradeInputDirection(output.direction),
        confidence: output.confidence,
        rationale: output.rationale,
      })),
      {
        memberId: "research_lead" as const,
        direction: "neutral" as const,
        confidence: researchLead.confidence,
        rationale: researchLead.rationale,
      },
      {
        memberId: "risk_lead" as const,
        direction: "neutral" as const,
        confidence: riskLead.confidence,
        rationale: riskLead.rationale,
      },
    ];
    const currentPrice = currentPriceFromSignals(localizedInput.recentMarketSignals);
    const tradeDecision =
      tradeDisabled || !currentPrice
        ? null
        : await tradeGenerator({
            symbol,
            currentPrice,
            analystInputs: tradeInputs,
            riskNotes: [riskLead.rationale],
            newsContext: localizedInput.recentNewsEvidence.map(
              (evidence) => `${evidence.id}: ${evidence.summary}`,
            ),
            severity: toSeverity(localizedInput),
            locale,
          });
    if (!tradeDisabled && !tradeDecision) {
      await writeSkippedRun({
        skipReason: "trade_decision_unavailable",
        activeStage: "trade_decision",
      });
      return null;
    }
    if (
      tradeDecision &&
      containsPublicContentLeak(`${tradeDecision.riskNote}\n${tradeDecision.invalidatesIf}`)
    ) {
      await writeSkippedRun({
        skipReason: "trade_decision_content_leak",
        failedStage: "trade_decision",
      });
      return null;
    }
    const analysisSummary = tradeDisabled
      ? buildAnalysisSummary({
          candidate,
          analystOutputs: latestAnalystOutputs,
          researchLead,
          riskLead,
        })
      : undefined;
    completeStage(
      stageAudit,
      "trade_decision",
      tradeDecision ? `${tradeDecision.direction} trade card generated` : "analysis-only summary",
    );

    const evidenceIds = Array.from(
      new Set([
        ...localizedInput.recentNewsEvidence.map((evidence) => evidence.id),
        ...publicAnalystRoundOutputs.flatMap((output) => output.citations),
        ...(tradeDecision?.evidenceIds ?? []),
      ]),
    );
    const record = makeRecord({
      input: localizedInput,
      candidate,
      now,
      analystOutputs: latestAnalystOutputs,
      analystRoundOutputs: publicAnalystRoundOutputs,
      researchLead,
      riskLead,
      tradeDecision,
      analysisSummary,
      stageAudit,
      evidencePack,
      abstainedInputMemberIds: latestAbstainedMemberIds,
    });
    const judge = await decisionJudge(record);
    recordDecisionJudgeMetric(judge);
    if (isBlockingJudgeFailure(judge)) {
      await writeSkippedRun({
        skipReason: "llm_judge_fail",
        failedStage: "record_write",
        error: `judge_fail_reason:${judge.fail_reason}; detail:${judge.fail_detail ?? ""}`,
      });
      return null;
    }
    startStage(stageAudit, "record_write");
    const recordWriteObservedAt = new Date(Date.now()).toISOString();
    const recordForStorage = withStageTraceStatus(
      record,
      "record_write",
      "done",
      recordWriteObservedAt,
      stageAudit,
    );
    const writtenRecord = await recordWriter(
      recordForStorage,
      tradeDisabled ? 0 : (currentPrice ?? 0),
    );
    if (!tradeDisabled && !writtenRecord.tradeDecision) {
      await writeSkippedRun({
        skipReason: "record_missing_trade_decision",
        failedStage: "record_write",
      });
      return null;
    }
    completeStage(stageAudit, "record_write", "decision record persisted");
    const recordWriteCompletedAt = new Date(Date.now()).toISOString();
    const recordAfterWrite = withStageTraceStatus(
      writtenRecord,
      "record_write",
      "done",
      recordWriteCompletedAt,
      stageAudit,
    );
    const quality = assessDecisionQuality(recordAfterWrite);
    if (!quality.publishable) {
      const qualityFailedRecord = withStageTraceStatus(
        recordAfterWrite,
        "public_timeline",
        "failed",
        new Date(Date.now()).toISOString(),
        stageAudit,
      );
      try {
        await recordUpdater(qualityFailedRecord);
      } catch (error) {
        console.warn("[claw42] PM quality gate stage update skipped", {
          recordId: qualityFailedRecord.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await writeSkippedRun({
        skipReason: "public_quality_gate_failed",
        failedStage: "public_timeline",
        decisionRecordId: qualityFailedRecord.id,
        quality,
      });
      return null;
    }

    startStage(stageAudit, "public_timeline");
    if (!partialHistoryPublished) {
      await watchWriter(timelineEntryAsChatThread(recordAfterWrite, evidenceIds));
    }
    completeStage(stageAudit, "public_timeline", "watch history projection written");
    const completedRecord = withStageTraceStatus(
      withStageTraceStatus(
        recordAfterWrite,
        "record_write",
        "done",
        new Date(Date.now()).toISOString(),
        stageAudit,
      ),
      "public_timeline",
      "done",
      new Date(Date.now()).toISOString(),
      stageAudit,
    );
    try {
      await recordUpdater(completedRecord);
    } catch (error) {
      console.warn("[claw42] PM stage trace completion update skipped", {
        recordId: completedRecord.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const publicTimelineEntry = makePublicTimelineEntry(completedRecord, evidenceIds);
    await writeRun(
      buildDecisionRun({
        id: runId,
        status: "succeeded",
        triggerSource: localizedInput.triggerSource,
        locale,
        candidate,
        symbol,
        startedAt: runStartedAt,
        completedAt: new Date(Date.now()).toISOString(),
        stageAudit,
        analystRoundCount: latestAnalystRoundCount,
        activeMemberIds: latestActiveMemberIds,
        abstainedMemberIds: latestAbstainedMemberIds,
        decisionRecordId: completedRecord.id,
        publicTimelineEventId: publicTimelineEntry.id,
        quality,
      }),
    );
    return {
      record: completedRecord,
      publicTimelineEntry,
      tradeDecision: completedRecord.tradeDecision,
    };
  } catch (error) {
    console.warn("[claw42] PM decision pipeline failed", {
      triggerSource: input.triggerSource,
      locale: normalizeWatchLocale(input.locale),
      error: error instanceof Error ? error.message : String(error),
    });
    await writeRun(
      buildDecisionRun({
        id: runId,
        status: "failed",
        triggerSource: localizedInput.triggerSource,
        locale,
        candidate,
        symbol,
        startedAt: runStartedAt,
        completedAt: new Date(Date.now()).toISOString(),
        stageAudit,
        analystRoundCount: latestAnalystRoundCount,
        activeMemberIds: latestActiveMemberIds,
        abstainedMemberIds: latestAbstainedMemberIds,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

export const __pmDecisionPipelineTestUtils = {
  shouldRunPipeline,
};
