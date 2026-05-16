import { promises as fs } from "fs";
import path from "path";
import { generateText } from "@/lib/llm/generateText";
import { mapTeamProviderToProviderId } from "@/lib/llm/providers";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { recordStrategyDecisionRecord } from "@/lib/strategyHistory";
import { writeDecisionStagePartial } from "@/lib/team/decisionStageWriter";
import { upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import {
  buildEvidenceContextPack,
  dataStatusForMember,
  evidenceIdsForMember,
  formatRoleEvidenceContext,
  type EvidenceContextPack,
} from "@/lib/team/evidenceDispatcher";
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
import {
  publicDecisionProcessFromRecord,
  publicStageTraceFromRecord,
} from "@/lib/watch/publicTimelineProjection";
import { appendWatchHistoryEntry } from "@/lib/watchHistoryStore";
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
  writeDecisionStagePartial?: typeof writeDecisionStagePartial;
  appendWatchHistoryEntry?: typeof appendWatchHistoryEntry;
  loadPromptDoc?: (memberId: TeamMemberId) => Promise<string>;
  buildEvidenceContextPack?: typeof buildEvidenceContextPack;
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
      attempt === "first" ? prompt : `${prompt}\n\n${buildLocaleRetryInstruction(locale)}`,
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

function fallbackAnalystOutput(
  memberId: TeamMemberId,
  locale: Locale,
  error: unknown,
): AnalystOutput {
  if (process.env.NODE_ENV !== "test") {
    console.warn("[claw42] PM analyst role fallback used", {
      memberId,
      locale,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const rationale =
    locale === "zh_CN" || locale === "zh_TW"
      ? `${memberId} 基于当前已确认信号保持观望，并降低置信度等待下一轮证据确认。`
      : `${memberId} stays cautious on the confirmed signals and lowers confidence until the next evidence refresh.`;
  return {
    memberId,
    direction: "wait",
    confidence: 0.25,
    rationale,
    oneLineSummary: oneLineSummaryFromRationale(rationale),
    detailedRationale: rationale,
    dataStatus: "partial",
    citations: [],
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
    return fallbackAnalystOutput(memberId, locale, error);
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
      attempt === "first" ? prompt : `${prompt}\n\n${buildLocaleRetryInstruction(locale)}`,
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

async function buildMemberPrompt(
  memberId: TeamMemberId,
  input: PmDecisionPipelineInput,
  deps: PipelineDeps,
  evidencePack: EvidenceContextPack,
) {
  const promptDoc = await (deps.loadPromptDoc ?? defaultLoadPromptDoc)(memberId);
  return `${promptDoc}

You are participating in the Claw42 PM decision pipeline.
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

## Locale
${buildLocaleInstruction(normalizeWatchLocale(input.locale))}

${formatRoleEvidenceContext(memberId, evidencePack)}`;
}

async function buildLeadPrompt(
  memberId: TeamMemberId,
  input: PmDecisionPipelineInput,
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

## Analyst outputs
${analystOutputs
  .map(
    (output) =>
      `- ${output.memberId}: ${output.direction} ${output.confidence} ${output.rationale}`,
  )
  .join("\n")}

## Previous lead
${previousLead?.rationale ?? "- none"}

## Market signals
${marketContext(input) || "- none"}

## News evidence
${newsContext(input) || "- none"}`;
}

function currentPriceFromSignals(signals: SignalRecord[]) {
  const price = signals.find((signal) => typeof signal.payload.priceLevel === "number")?.payload
    .priceLevel;
  return price && price > 0 ? price : 1;
}

function symbolFromInput(input: PmDecisionPipelineInput) {
  return (input.recentMarketSignals[0]?.symbol ?? input.recentNewsEvidence[0]?.symbol[0] ?? "BTC")
    .trim()
    .replace(/^\$+/, "")
    .toUpperCase();
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

function makeRecord({
  input,
  now,
  analystOutputs,
  analystRoundOutputs,
  researchLead,
  riskLead,
  tradeDecision,
  stageAudit,
}: {
  input: PmDecisionPipelineInput;
  now: number;
  analystOutputs: AnalystOutput[];
  analystRoundOutputs: MultiRoundAnalystOutput[];
  researchLead: LeadOutput;
  riskLead: LeadOutput;
  tradeDecision: TradeDecision | null;
  stageAudit: StageAuditMap;
}): StrategyDecisionRecord {
  const symbol = symbolFromInput(input);
  const locale = normalizeWatchLocale(input.locale);
  const observedAt = new Date(now).toISOString();
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
      rationale: tradeDecision
        ? `${tradeDecision.riskNote} ${tradeDecision.invalidatesIf}`.trim()
        : "PM returned no decision.",
      oneLineSummary: tradeDecision
        ? oneLineSummaryFromRationale(tradeDecision.riskNote)
        : "PM returned no decision.",
      detailedRationale: tradeDecision
        ? `${tradeDecision.riskNote} ${tradeDecision.invalidatesIf}`.trim()
        : "PM returned no decision.",
      dataStatus: "ok",
      evidenceIds: tradeDecision?.evidenceIds ?? [],
      rounds: singleRoundRecord({
        direction:
          tradeDecision?.direction === "long" || tradeDecision?.direction === "short"
            ? tradeDecision.direction
            : "neutral",
        confidence: tradeDecision?.confidence ?? 0.5,
        rationale: tradeDecision
          ? `${tradeDecision.riskNote} ${tradeDecision.invalidatesIf}`.trim()
          : "PM returned no decision.",
        oneLineSummary: tradeDecision
          ? oneLineSummaryFromRationale(tradeDecision.riskNote)
          : "PM returned no decision.",
        detailedRationale: tradeDecision
          ? `${tradeDecision.riskNote} ${tradeDecision.invalidatesIf}`.trim()
          : "PM returned no decision.",
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
    locale,
    decisionOwnerId: "pm",
    contributorIds: TEAM_MEMBER_IDS,
    analystInputs,
    stageTrace: makeStageTrace(observedAt, tradeDecision, stageAudit, analystRoundOutputs),
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
  now,
  analystOutputs,
  analystRoundOutputs,
  researchLead,
  riskLead,
  activeStage,
  stageAudit,
}: {
  input: PmDecisionPipelineInput;
  now: number;
  analystOutputs: AnalystOutput[];
  analystRoundOutputs: MultiRoundAnalystOutput[];
  researchLead?: LeadOutput;
  riskLead?: LeadOutput;
  activeStage: "research_lead" | "risk_lead" | "trade_decision";
  stageAudit: StageAuditMap;
}): StrategyDecisionRecord {
  const symbol = symbolFromInput(input);
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
      tradeDecision: record.tradeDecision,
      rationaleByMember: derived.rationaleByMember,
      citationsByMember: derived.citationsByMember,
      rounds: derived.rounds,
      stageTrace: publicStageTraceFromRecord(record),
    },
  };
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
      title: `${record.symbol} PM decision`,
      description: "Claw42 PM decision pipeline",
      symbols: [record.symbol],
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
  if (!shouldRunPipeline(input)) return null;

  const now = input.now ?? Date.now();
  const locale = normalizeWatchLocale(input.locale);
  const localizedInput = { ...input, locale };
  const symbol = symbolFromInput(localizedInput);
  const evidencePack = await (deps.buildEvidenceContextPack ?? buildEvidenceContextPack)({
    symbol,
    recentMarketSignals: localizedInput.recentMarketSignals,
    recentNewsEvidence: localizedInput.recentNewsEvidence,
    locale,
  });
  const allowedEvidenceIds = new Set(
    PIPELINE_INPUT_MEMBER_IDS.flatMap((memberId) => evidenceIdsForMember(memberId, evidencePack)),
  );
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
  const partialStageWriter = deps.writeDecisionStagePartial ?? writeDecisionStagePartial;
  const watchWriter = deps.appendWatchHistoryEntry ?? appendWatchHistoryEntry;
  const stageAudit: StageAuditMap = {};
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
      PIPELINE_INPUT_MEMBER_IDS.map(async (memberId) => ({
        memberId,
        prompt: await buildMemberPrompt(memberId, localizedInput, deps, evidencePack),
      })),
    );
    const analystRoundOutputs = await runMultiRoundAnalystDebate({
      candidates: analystPrompts,
      generateRound: (memberId, prompt) =>
        generateAnalystWithFallback({ memberId, prompt, generateAnalyst, locale }),
    });
    const latestAnalystOutputs = latestAnalystRoundByMember(analystRoundOutputs);
    completeStage(
      stageAudit,
      "analyst_inputs",
      `${analystRoundOutputs.length} analyst round outputs`,
    );

    startStage(stageAudit, "research_lead");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs,
        activeStage: "research_lead",
        stageAudit,
      }),
      evidenceIdsForPartial(localizedInput, analystRoundOutputs),
    );
    const researchLead = await generateLead(
      "research_lead",
      await buildLeadPrompt("research_lead", localizedInput, latestAnalystOutputs, undefined, deps),
    );
    completeStage(stageAudit, "research_lead", "research synthesis generated");
    startStage(stageAudit, "risk_lead");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs,
        researchLead,
        activeStage: "risk_lead",
        stageAudit,
      }),
      evidenceIdsForPartial(localizedInput, analystRoundOutputs),
    );
    const riskLead = await generateLead(
      "risk_lead",
      await buildLeadPrompt("risk_lead", localizedInput, latestAnalystOutputs, researchLead, deps),
    );
    completeStage(stageAudit, "risk_lead", "risk review generated");

    const currentPrice = currentPriceFromSignals(localizedInput.recentMarketSignals);
    startStage(stageAudit, "trade_decision");
    await publishPartialStage(
      makePartialRecord({
        input: localizedInput,
        now,
        analystOutputs: latestAnalystOutputs,
        analystRoundOutputs,
        researchLead,
        riskLead,
        activeStage: "trade_decision",
        stageAudit,
      }),
      evidenceIdsForPartial(localizedInput, analystRoundOutputs),
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
    const tradeDecision = await tradeGenerator({
      symbol: symbolFromInput(localizedInput),
      currentPrice,
      analystInputs: tradeInputs,
      riskNotes: [riskLead.rationale],
      newsContext: localizedInput.recentNewsEvidence.map(
        (evidence) => `${evidence.id}: ${evidence.summary}`,
      ),
      severity: toSeverity(localizedInput),
      locale,
    });
    if (!tradeDecision) return null;
    completeStage(stageAudit, "trade_decision", `${tradeDecision.direction} trade card generated`);

    const evidenceIds = Array.from(
      new Set([
        ...localizedInput.recentNewsEvidence.map((evidence) => evidence.id),
        ...analystRoundOutputs.flatMap((output) => output.citations),
        ...(tradeDecision.evidenceIds ?? []),
      ]),
    );
    const record = makeRecord({
      input: localizedInput,
      now,
      analystOutputs: latestAnalystOutputs,
      analystRoundOutputs,
      researchLead,
      riskLead,
      tradeDecision,
      stageAudit,
    });
    startStage(stageAudit, "record_write");
    const recordWriteObservedAt = new Date(Date.now()).toISOString();
    const recordForStorage = withStageTraceStatus(
      record,
      "record_write",
      "done",
      recordWriteObservedAt,
      stageAudit,
    );
    const writtenRecord = await recordWriter(recordForStorage, currentPrice);
    if (!writtenRecord.tradeDecision) return null;
    completeStage(stageAudit, "record_write", "decision record persisted");

    startStage(stageAudit, "public_timeline");
    if (!partialHistoryPublished) {
      await watchWriter(timelineEntryAsChatThread(writtenRecord, evidenceIds));
    }
    completeStage(stageAudit, "public_timeline", "watch history projection written");
    const completedRecord = withStageTraceStatus(
      withStageTraceStatus(
        writtenRecord,
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
    return null;
  }
}

export const __pmDecisionPipelineTestUtils = {
  shouldRunPipeline,
};
