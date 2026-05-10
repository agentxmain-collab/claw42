import { promises as fs } from "fs";
import path from "path";
import { generateText } from "@/lib/llm/generateText";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { recordStrategyDecisionRecord } from "@/lib/strategyHistory";
import type { StrategyDecisionRecord, AnalystInputRecord } from "@/lib/team/strategyDecisionRecord";
import { generateTradeDecision, type Severity, type TradeDecision } from "@/lib/team/tradeDecisionPromptBuilder";
import {
  TEAM_MEMBER_REGISTRY,
  type TeamMemberId,
} from "@/lib/team/teamRegistry";
import type { PublicTimelineEvent, PublicTimelineImportance } from "@/lib/watch/publicTimelineEvent";
import { appendWatchHistoryEntry } from "@/lib/watchHistoryStore";
import type { SignalRecord } from "@/modules/agent-watch/types";
import type { ChatThread } from "@/lib/types";

export type PmDecisionTriggerSource = "cron" | "user_visit_trigger";

export interface PmDecisionPipelineInput {
  triggerSource: PmDecisionTriggerSource;
  recentMarketSignals: SignalRecord[];
  recentNewsEvidence: NewsEvidence[];
  importanceThreshold?: PublicTimelineImportance;
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
  generateAnalystOutput?: (memberId: TeamMemberId, prompt: string) => Promise<AnalystOutput>;
  generateLeadOutput?: (memberId: TeamMemberId, prompt: string) => Promise<LeadOutput>;
  generateTradeDecision?: typeof generateTradeDecision;
  recordStrategyDecisionRecord?: typeof recordStrategyDecisionRecord;
  appendWatchHistoryEntry?: typeof appendWatchHistoryEntry;
  loadPromptDoc?: (memberId: TeamMemberId) => Promise<string>;
}

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

async function defaultGenerateAnalystOutput(
  memberId: TeamMemberId,
  prompt: string,
  allowedEvidenceIds: Set<string>,
): Promise<AnalystOutput> {
  const text = await generateText(prompt, {
    taskTag: `watch:pm-decision:${memberId}`,
    temperature: 0.35,
    maxTokens: 500,
    enableGuardrails: false,
  });
  const parsed = parseObject(text);
  const rationale = String(parsed.rationale ?? "").trim();
  if (!rationale) throw new Error(`${memberId} missing rationale`);
  return {
    memberId,
    direction: normalizeDirection(parsed.direction),
    confidence: normalizeConfidence(parsed.confidence),
    rationale,
    citations: normalizeCitations(parsed.citations, allowedEvidenceIds),
  };
}

async function defaultGenerateLeadOutput(
  memberId: TeamMemberId,
  prompt: string,
): Promise<LeadOutput> {
  const text = await generateText(prompt, {
    taskTag: `watch:pm-decision:${memberId}`,
    temperature: 0.25,
    maxTokens: 520,
    enableGuardrails: false,
  });
  const parsed = parseObject(text);
  const rationale = String(parsed.rationale ?? parsed.thesis ?? parsed.rebuttal ?? "").trim();
  if (!rationale) throw new Error(`${memberId} missing rationale`);
  return {
    rationale,
    confidence: normalizeConfidence(parsed.confidence ?? parsed.consensusLevel),
  };
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
    .map((evidence) => `- ${evidence.id}: ${evidence.title} (${evidence.source}) ${evidence.summary}`)
    .join("\n");
}

async function buildMemberPrompt(memberId: TeamMemberId, input: PmDecisionPipelineInput, deps: PipelineDeps) {
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

## Analyst outputs
${analystOutputs
  .map((output) => `- ${output.memberId}: ${output.direction} ${output.confidence} ${output.rationale}`)
  .join("\n")}

## Previous lead
${previousLead?.rationale ?? "- none"}

## Market signals
${marketContext(input) || "- none"}

## News evidence
${newsContext(input) || "- none"}`;
}

function currentPriceFromSignals(signals: SignalRecord[]) {
  const price = signals.find((signal) => typeof signal.payload.priceLevel === "number")?.payload.priceLevel;
  return price && price > 0 ? price : 1;
}

function symbolFromInput(input: PmDecisionPipelineInput) {
  return (
    input.recentMarketSignals[0]?.symbol ??
    input.recentNewsEvidence[0]?.symbol[0] ??
    "BTC"
  )
    .replace(/^\$/, "")
    .toUpperCase();
}

function toSeverity(input: PmDecisionPipelineInput): Severity {
  const hasHighNews = input.recentNewsEvidence.some((evidence) => evidence.impactSeverity === "high");
  const hasAlertSignal = input.recentMarketSignals.some((signal) => signal.severity === "alert");
  return hasHighNews || hasAlertSignal ? "high" : "medium";
}

function makeRecord({
  input,
  now,
  analystOutputs,
  researchLead,
  riskLead,
  tradeDecision,
}: {
  input: PmDecisionPipelineInput;
  now: number;
  analystOutputs: AnalystOutput[];
  researchLead: LeadOutput;
  riskLead: LeadOutput;
  tradeDecision: TradeDecision | null;
}): StrategyDecisionRecord {
  const symbol = symbolFromInput(input);
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
    decisionOwnerId: "pm",
    contributorIds: ["fundamental_analyst", "news_analyst", "chart_analyst", "onchain_analyst", "research_lead", "risk_lead"],
    analystInputs,
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

function makePublicTimelineEntry(record: StrategyDecisionRecord, evidenceIds: string[]): PublicTimelineEvent {
  return {
    id: `public:${record.id}`,
    ts: Date.parse(record.createdAt),
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds,
    payload: {
      kind: "pm_decision",
      recordId: record.id,
      tradeDecision: record.tradeDecision,
      rationaleByMember: Object.fromEntries(
        record.analystInputs.map((input) => [input.memberId, input.rationale]),
      ),
      citationsByMember: Object.fromEntries(
        record.analystInputs.map((input) => [input.memberId, input.evidenceIds]),
      ),
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
      recordId: record.id,
    },
  };
}

export async function runPmDecisionPipeline(
  input: PmDecisionPipelineInput,
  deps: PipelineDeps = {},
): Promise<PmDecisionPipelineOutput | null> {
  if (!shouldRunPipeline(input)) return null;

  const now = input.now ?? Date.now();
  const allowedEvidenceIds = new Set(input.recentNewsEvidence.map((evidence) => evidence.id));
  const generateAnalyst =
    deps.generateAnalystOutput ??
    ((memberId: TeamMemberId, prompt: string) =>
      defaultGenerateAnalystOutput(memberId, prompt, allowedEvidenceIds));
  const generateLead = deps.generateLeadOutput ?? defaultGenerateLeadOutput;
  const tradeGenerator = deps.generateTradeDecision ?? generateTradeDecision;
  const recordWriter = deps.recordStrategyDecisionRecord ?? recordStrategyDecisionRecord;
  const watchWriter = deps.appendWatchHistoryEntry ?? appendWatchHistoryEntry;

  try {
    const analystPrompts = await Promise.all(
      ANALYST_IDS.map(async (memberId) => ({
        memberId,
        prompt: await buildMemberPrompt(memberId, input, deps),
      })),
    );
    const analystOutputs = await Promise.all(
      analystPrompts.map(({ memberId, prompt }) => generateAnalyst(memberId, prompt)),
    );

    const researchLead = await generateLead(
      "research_lead",
      await buildLeadPrompt("research_lead", input, analystOutputs, undefined, deps),
    );
    const riskLead = await generateLead(
      "risk_lead",
      await buildLeadPrompt("risk_lead", input, analystOutputs, researchLead, deps),
    );

    const currentPrice = currentPriceFromSignals(input.recentMarketSignals);
    const tradeDecision = await tradeGenerator({
      symbol: symbolFromInput(input),
      currentPrice,
      analystInputs: analystOutputs.map((output) => ({
        memberId: output.memberId,
        direction: output.direction,
        confidence: output.confidence,
        rationale: output.rationale,
      })),
      riskNotes: [riskLead.rationale],
      newsContext: input.recentNewsEvidence.map((evidence) => `${evidence.id}: ${evidence.summary}`),
      severity: toSeverity(input),
    });
    if (!tradeDecision) return null;

    const evidenceIds = Array.from(
      new Set([
        ...input.recentNewsEvidence.map((evidence) => evidence.id),
        ...analystOutputs.flatMap((output) => output.citations),
      ]),
    );
    const record = makeRecord({
      input,
      now,
      analystOutputs,
      researchLead,
      riskLead,
      tradeDecision,
    });
    const writtenRecord = await recordWriter(record, currentPrice);
    if (!writtenRecord.tradeDecision) return null;

    const publicTimelineEntry = makePublicTimelineEntry(writtenRecord, evidenceIds);
    await watchWriter(timelineEntryAsChatThread(writtenRecord, evidenceIds));
    return {
      record: writtenRecord,
      publicTimelineEntry,
      tradeDecision: writtenRecord.tradeDecision,
    };
  } catch (error) {
    console.warn("[claw42] PM decision pipeline failed", {
      triggerSource: input.triggerSource,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export const __pmDecisionPipelineTestUtils = {
  shouldRunPipeline,
};
