import { generateText } from "@/lib/llm/generateText";
import type { ProviderId } from "@/lib/llm/providers";
import { estimateTokenCount } from "@/lib/llm/providers/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";

export type DecisionJudgeVerdict = "pass" | "fail";

export type DecisionJudgeFailReason =
  | "semantic_duplicate"
  | "viewpoint_missing"
  | "stage_leak"
  | "keyword_stuffing";

export type DecisionJudgeStatus = "ok" | "malformed" | "unavailable";

export interface DecisionJudgeResult {
  verdict: DecisionJudgeVerdict;
  fail_reason: DecisionJudgeFailReason | null;
  fail_detail: string | null;
  confidence: number;
  status: DecisionJudgeStatus;
  callCount: number;
  inputTokenEstimate: number;
  outputTokenEstimate: number;
}

interface DecisionJudgeRawPayload {
  verdict?: unknown;
  fail_reason?: unknown;
  fail_detail?: unknown;
  confidence?: unknown;
}

interface RunDecisionJudgeOptions {
  generate?: typeof generateText;
  primaryProvider?: ProviderId;
  fallbackProvider?: ProviderId;
  timeoutMs?: number;
}

export interface DecisionJudgeMetrics {
  judge_call_count: number;
  judge_pass_count: number;
  judge_fail_count: number;
  judge_unavailable_count: number;
  judge_malformed_count: number;
  judge_estimated_input_tokens: number;
  judge_estimated_output_tokens: number;
  judge_pass_rate: number;
  judge_fail_reasons: Record<string, number>;
}

const PRIMARY_PROVIDER: ProviderId = "claude-haiku";
const FALLBACK_PROVIDER: ProviderId = "openai";
const JUDGE_TIMEOUT_MS = 30_000;
const MAX_DETAIL_LENGTH = 200;
const memoryMetrics: DecisionJudgeMetrics = emptyMetrics();

const SYSTEM_PROMPT = [
  "You are a strict public trading-analysis quality judge.",
  "Return only JSON. Do not include markdown.",
  "Fail only when the public decision record has a clear semantic-quality issue.",
].join("\n");

function emptyMetrics(): DecisionJudgeMetrics {
  return {
    judge_call_count: 0,
    judge_pass_count: 0,
    judge_fail_count: 0,
    judge_unavailable_count: 0,
    judge_malformed_count: 0,
    judge_estimated_input_tokens: 0,
    judge_estimated_output_tokens: 0,
    judge_pass_rate: 0,
    judge_fail_reasons: {},
  };
}

export async function runDecisionJudge(
  record: StrategyDecisionRecord,
  options: RunDecisionJudgeOptions = {},
): Promise<DecisionJudgeResult> {
  const generate = options.generate ?? generateText;
  const primaryProvider = options.primaryProvider ?? PRIMARY_PROVIDER;
  const fallbackProvider = options.fallbackProvider ?? FALLBACK_PROVIDER;
  const timeoutMs = options.timeoutMs ?? JUDGE_TIMEOUT_MS;
  const prompt = buildDecisionJudgePrompt(record);
  const inputTokenEstimate = estimateTokenCount(`${SYSTEM_PROMPT}\n${prompt}`);
  let callCount = 0;
  let outputTokenEstimate = 0;
  let sawMalformedOutput = false;

  for (const providerOverride of [primaryProvider, fallbackProvider]) {
    for (const attempt of [1, 2]) {
      callCount += 1;
      try {
        const output = await generate(attempt === 1 ? prompt : buildRetryPrompt(prompt), {
          systemPrompt: SYSTEM_PROMPT,
          taskTag: "pm-decision:judge",
          providerOverride,
          temperature: 0,
          maxTokens: 260,
          timeoutMs,
          enableCache: false,
          enableGuardrails: false,
        });
        outputTokenEstimate += estimateTokenCount(output);
        const parsed = parseJudgeOutput(output);
        if (!parsed) {
          sawMalformedOutput = true;
          continue;
        }
        return {
          ...parsed,
          status: "ok",
          callCount,
          inputTokenEstimate: inputTokenEstimate * callCount,
          outputTokenEstimate,
        };
      } catch {
        // Try the same provider once, then the configured fallback provider.
      }
    }
  }

  return fallbackPass({
    status: sawMalformedOutput ? "malformed" : "unavailable",
    callCount,
    inputTokenEstimate: inputTokenEstimate * Math.max(1, callCount),
    outputTokenEstimate,
  });
}

export function recordDecisionJudgeMetric(result: DecisionJudgeResult) {
  memoryMetrics.judge_call_count += result.callCount;
  memoryMetrics.judge_estimated_input_tokens += result.inputTokenEstimate;
  memoryMetrics.judge_estimated_output_tokens += result.outputTokenEstimate;

  if (result.status === "unavailable") {
    memoryMetrics.judge_unavailable_count += 1;
  }
  if (result.status === "malformed") {
    memoryMetrics.judge_malformed_count += 1;
  }
  if (result.verdict === "fail" && result.fail_reason) {
    memoryMetrics.judge_fail_count += 1;
    memoryMetrics.judge_fail_reasons[result.fail_reason] =
      (memoryMetrics.judge_fail_reasons[result.fail_reason] ?? 0) + 1;
  } else {
    memoryMetrics.judge_pass_count += 1;
  }

  const settled =
    memoryMetrics.judge_pass_count +
    memoryMetrics.judge_fail_count +
    memoryMetrics.judge_unavailable_count;
  memoryMetrics.judge_pass_rate = settled > 0 ? memoryMetrics.judge_pass_count / settled : 0;
}

export function summarizeDecisionJudgeMetrics(
  runs: readonly DecisionRunRecord[] = [],
): DecisionJudgeMetrics {
  const metrics: DecisionJudgeMetrics = {
    ...memoryMetrics,
    judge_fail_reasons: { ...memoryMetrics.judge_fail_reasons },
  };
  for (const run of runs) {
    if (run.skipReason !== "llm_judge_fail") continue;
    const reason = parseJudgeReasonFromRun(run);
    if (!reason) continue;
    metrics.judge_fail_count += 1;
    metrics.judge_fail_reasons[reason] = (metrics.judge_fail_reasons[reason] ?? 0) + 1;
  }
  const settled =
    metrics.judge_pass_count + metrics.judge_fail_count + metrics.judge_unavailable_count;
  metrics.judge_pass_rate = settled > 0 ? metrics.judge_pass_count / settled : 0;
  return metrics;
}

export const __decisionJudgeTestUtils = {
  clearMetrics() {
    Object.assign(memoryMetrics, emptyMetrics());
  },
};

function buildDecisionJudgePrompt(record: StrategyDecisionRecord) {
  const payload = {
    recordId: record.id,
    symbol: record.symbol,
    candidateType: record.candidate?.candidateType,
    analysisSummary: record.analysisSummary,
    analystInputs: record.analystInputs.map((input) => ({
      memberId: input.memberId,
      direction: input.direction,
      confidence: input.confidence,
      oneLineSummary: input.oneLineSummary,
      rationale: input.rationale,
      detailedRationale: input.detailedRationale,
      rounds: input.rounds?.map((round) => ({
        round: round.round,
        direction: round.direction,
        confidence: round.confidence,
        oneLineSummary: round.oneLineSummary,
        rationale: round.rationale,
        detailedRationale: round.detailedRationale,
      })),
    })),
    tradeDecision: record.tradeDecision
      ? {
          direction: record.tradeDecision.direction,
          riskNote: record.tradeDecision.riskNote,
          invalidatesIf: record.tradeDecision.invalidatesIf,
          confidence: record.tradeDecision.confidence,
        }
      : null,
  };

  return [
    "Judge this public Claw42 decision record before it is persisted.",
    "Return JSON with this exact shape:",
    '{"verdict":"pass|fail","fail_reason":"semantic_duplicate|viewpoint_missing|stage_leak|keyword_stuffing|null","fail_detail":"<=200 chars|null","confidence":0.0}',
    "Fail when public messages are semantically repetitive, missing opposing risk/research views, leak trade-plan details into an earlier stage, or stuff keywords.",
    "If uncertain, return pass with confidence below 0.5.",
    JSON.stringify(payload),
  ].join("\n");
}

function buildRetryPrompt(prompt: string) {
  return `${prompt}\n\nPrevious output was not valid JSON. Return exactly one JSON object and no other text.`;
}

function parseJudgeOutput(
  output: string,
): Omit<
  DecisionJudgeResult,
  "status" | "callCount" | "inputTokenEstimate" | "outputTokenEstimate"
> | null {
  const payload = parseJsonObject(output);
  if (!payload) return null;
  return normalizeJudgePayload(payload);
}

function parseJsonObject(output: string): DecisionJudgeRawPayload | null {
  const trimmed = output
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as DecisionJudgeRawPayload;
  } catch {
    return null;
  }
}

function normalizeJudgePayload(
  payload: DecisionJudgeRawPayload,
): Omit<
  DecisionJudgeResult,
  "status" | "callCount" | "inputTokenEstimate" | "outputTokenEstimate"
> | null {
  const confidence =
    typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
      ? clamp(payload.confidence, 0, 1)
      : 0;
  const verdict = payload.verdict === "fail" ? "fail" : payload.verdict === "pass" ? "pass" : null;
  if (!verdict) return null;
  if (verdict === "pass" || confidence < 0.5) {
    return {
      verdict: "pass",
      fail_reason: null,
      fail_detail: null,
      confidence,
    };
  }
  const failReason = normalizeFailReason(payload.fail_reason);
  if (!failReason) return null;
  return {
    verdict: "fail",
    fail_reason: failReason,
    fail_detail:
      typeof payload.fail_detail === "string"
        ? payload.fail_detail.trim().slice(0, MAX_DETAIL_LENGTH) || null
        : null,
    confidence,
  };
}

function fallbackPass({
  status,
  callCount,
  inputTokenEstimate,
  outputTokenEstimate,
}: {
  status: DecisionJudgeStatus;
  callCount: number;
  inputTokenEstimate: number;
  outputTokenEstimate: number;
}): DecisionJudgeResult {
  return {
    verdict: "pass",
    fail_reason: null,
    fail_detail: null,
    confidence: 0,
    status,
    callCount,
    inputTokenEstimate,
    outputTokenEstimate,
  };
}

function normalizeFailReason(value: unknown): DecisionJudgeFailReason | null {
  if (
    value === "semantic_duplicate" ||
    value === "viewpoint_missing" ||
    value === "stage_leak" ||
    value === "keyword_stuffing"
  ) {
    return value;
  }
  return null;
}

function parseJudgeReasonFromRun(run: DecisionRunRecord) {
  const match = /^judge_fail_reason:([a-z_]+)/.exec(run.error ?? "");
  return normalizeFailReason(match?.[1]) ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
