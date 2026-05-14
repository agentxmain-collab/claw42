import { promises as fs } from "fs";
import path from "path";
import { generateText } from "@/lib/llm/generateText";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { recordStrategyDecisionRecord } from "@/lib/strategyHistory";
import { upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import type {
  StrategyDecisionRecord,
  AnalystInputRecord,
  DecisionStageTraceId,
  DecisionStageTraceStatus,
  DecisionStageTraceEntry,
} from "@/lib/team/strategyDecisionRecord";
import {
  generateTradeDecision,
  type Severity,
  type TradeDecision,
} from "@/lib/team/tradeDecisionPromptBuilder";
import { TEAM_MEMBER_REGISTRY, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  PublicTimelineEvent,
  PublicTimelineImportance,
} from "@/lib/watch/publicTimelineEvent";
import { publicStageTraceFromRecord } from "@/lib/watch/publicTimelineProjection";
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

export interface PmDecisionPipelineInput {
  triggerSource: PmDecisionTriggerSource;
  recentMarketSignals: SignalRecord[];
  recentNewsEvidence: NewsEvidence[];
  importanceThreshold?: PublicTimelineImportance;
  locale?: Locale;
  now?: number;
}

export interface PmDecisionPipelineOutput {
  record: StrategyDecisionRecord;
  publicTimelineEntry: PublicTimelineEvent;
  tradeDecision: TradeDecision | null;
}

interface AnalystOutput {
  memberId: TeamMemberId;
  direction: "long" | "short" | "neutral";
  confidence: number;
  rationale: string;
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
  appendWatchHistoryEntry?: typeof appendWatchHistoryEntry;
  loadPromptDoc?: (memberId: TeamMemberId) => Promise<string>;
}

interface StageAuditMark {
  startedAtMs: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  note?: string;
}

type StageAuditMap = Partial<Record<DecisionStageTraceId, StageAuditMark>>;

const ANALYST_IDS: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
];

const PROMPT_VERSION = "pm-decision-pipeline-v1";

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
  return "neutral";
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
      },
    );
    try {
      const parsed = parseObject(text);
      const rationale = String(parsed.rationale ?? "").trim();
      if (!rationale) throw new Error(`${memberId} missing rationale`);
      ensureLocaleText(locale, [rationale], `${memberId} analyst`);
      return {
        memberId,
        direction: normalizeDirection(parsed.direction),
        confidence: normalizeConfidence(parsed.confidence),
        rationale,
        citations: normalizeCitations(parsed.citations, allowedEvidenceIds),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${memberId} analyst generation failed`);
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
) {
  const promptDoc = await (deps.loadPromptDoc ?? defaultLoadPromptDoc)(memberId);
  return `${promptDoc}

You are participating in the Claw42 PM decision pipeline.
Return JSON only:
{
  "direction": "long" | "short" | "neutral",
  "confidence": 0.0_to_1.0,
  "rationale": "short concrete rationale with numbers when available",
  "citations": ["evidenceId"]
}

## Locale
${buildLocaleInstruction(normalizeWatchLocale(input.locale))}

## Market signals
${marketContext(input) || "- none"}

## News evidence
${newsContext(input) || "- none"}`;
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

function makeRecord({
  input,
  now,
  analystOutputs,
  researchLead,
  riskLead,
  tradeDecision,
  stageAudit,
}: {
  input: PmDecisionPipelineInput;
  now: number;
  analystOutputs: AnalystOutput[];
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
      evidenceIds: output.citations,
    })),
    {
      memberId: "research_lead",
      direction: "neutral",
      confidence: researchLead.confidence,
      rationale: researchLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
    },
    {
      memberId: "risk_lead",
      direction: "neutral",
      confidence: riskLead.confidence,
      rationale: riskLead.rationale,
      evidenceIds: input.recentNewsEvidence.map((evidence) => evidence.id),
    },
  ];

  return {
    id: `pm:${symbol}:${now}`,
    schemaVersion: 1,
    recordSource: "live",
    symbol,
    locale,
    decisionOwnerId: "pm",
    contributorIds: [
      "fundamental_analyst",
      "news_analyst",
      "chart_analyst",
      "onchain_analyst",
      "research_lead",
      "risk_lead",
    ],
    analystInputs,
    stageTrace: makeStageTrace(observedAt, tradeDecision, stageAudit),
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

function makeStageTrace(
  observedAt: string,
  tradeDecision: TradeDecision | null,
  stageAudit: StageAuditMap,
): DecisionStageTraceEntry[] {
  return [
    {
      stageId: "analyst_inputs",
      label: "Analyst input generation",
      status: "done",
      observedAt,
      memberIds: ANALYST_IDS,
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
      rationaleByMember: Object.fromEntries(
        record.analystInputs.map((input) => [input.memberId, input.rationale]),
      ),
      citationsByMember: Object.fromEntries(
        record.analystInputs.map((input) => [input.memberId, input.evidenceIds]),
      ),
      stageTrace: publicStageTraceFromRecord(record),
    },
  };
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
  const allowedEvidenceIds = new Set(input.recentNewsEvidence.map((evidence) => evidence.id));
  const evidenceWriter = deps.saveNewsEvidence ?? saveNewsEvidence;
  const generateAnalyst =
    deps.generateAnalystOutput ??
    ((memberId: TeamMemberId, prompt: string) =>
      defaultGenerateAnalystOutput(memberId, prompt, allowedEvidenceIds, locale));
  const generateLead =
    deps.generateLeadOutput ??
    ((memberId: TeamMemberId, prompt: string) =>
      defaultGenerateLeadOutput(memberId, prompt, locale));
  const tradeGenerator = deps.generateTradeDecision ?? generateTradeDecision;
  const recordWriter = deps.recordStrategyDecisionRecord ?? recordStrategyDecisionRecord;
  const recordUpdater = deps.updateDecisionRecord ?? upsertDecisionRecord;
  const watchWriter = deps.appendWatchHistoryEntry ?? appendWatchHistoryEntry;
  const stageAudit: StageAuditMap = {};

  try {
    await Promise.all(
      localizedInput.recentNewsEvidence.map((evidence) => evidenceWriter(evidence)),
    );
    startStage(stageAudit, "analyst_inputs");
    const analystPrompts = await Promise.all(
      ANALYST_IDS.map(async (memberId) => ({
        memberId,
        prompt: await buildMemberPrompt(memberId, localizedInput, deps),
      })),
    );
    const analystOutputs = await Promise.all(
      analystPrompts.map(({ memberId, prompt }) => generateAnalyst(memberId, prompt)),
    );
    completeStage(stageAudit, "analyst_inputs", `${analystOutputs.length} analyst outputs`);

    startStage(stageAudit, "research_lead");
    const researchLead = await generateLead(
      "research_lead",
      await buildLeadPrompt("research_lead", localizedInput, analystOutputs, undefined, deps),
    );
    completeStage(stageAudit, "research_lead", "research synthesis generated");
    startStage(stageAudit, "risk_lead");
    const riskLead = await generateLead(
      "risk_lead",
      await buildLeadPrompt("risk_lead", localizedInput, analystOutputs, researchLead, deps),
    );
    completeStage(stageAudit, "risk_lead", "risk review generated");

    const currentPrice = currentPriceFromSignals(localizedInput.recentMarketSignals);
    startStage(stageAudit, "trade_decision");
    const tradeDecision = await tradeGenerator({
      symbol: symbolFromInput(localizedInput),
      currentPrice,
      analystInputs: analystOutputs.map((output) => ({
        memberId: output.memberId,
        direction: output.direction,
        confidence: output.confidence,
        rationale: output.rationale,
      })),
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
        ...analystOutputs.flatMap((output) => output.citations),
      ]),
    );
    const record = makeRecord({
      input: localizedInput,
      now,
      analystOutputs,
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
    await watchWriter(timelineEntryAsChatThread(writtenRecord, evidenceIds));
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
