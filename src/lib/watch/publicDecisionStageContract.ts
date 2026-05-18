import type {
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";
import type { PublicDecisionStageTraceEntry } from "@/lib/watch/publicTimelineEvent";

export const PUBLIC_DECISION_STAGE_ORDER: ReadonlyArray<{
  traceId: DecisionStageTraceId;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
}> = [
  { traceId: "analyst_inputs", stage: 1 },
  { traceId: "research_lead", stage: 2 },
  { traceId: "trade_decision", stage: 3 },
  { traceId: "risk_lead", stage: 4 },
  { traceId: "record_write", stage: 5 },
  { traceId: "public_timeline", stage: 6 },
];

const PUBLIC_PROGRESS_GATE_ORDER = PUBLIC_DECISION_STAGE_ORDER.slice(0, 4);

export interface PublicDecisionStageContractOptions {
  hasRenderableTradeDecision: boolean;
  analysisOnlyCandidate?: boolean;
}

export function normalizePublicDecisionStageStatuses(
  trace: readonly PublicDecisionStageTraceEntry[] | undefined,
  options: PublicDecisionStageContractOptions,
): Partial<Record<DecisionStageTraceId, DecisionStageTraceStatus>> {
  const originalStatus = (stageId: DecisionStageTraceId): DecisionStageTraceStatus =>
    trace?.find((entry) => entry.stageId === stageId)?.status ?? "pending";
  const rawStatus = (stageId: DecisionStageTraceId): DecisionStageTraceStatus => {
    const raw = originalStatus(stageId);
    if (!options.hasRenderableTradeDecision && !options.analysisOnlyCandidate) {
      if (stageId === "trade_decision" && raw === "done") return "in_progress";
      if (stageId === "risk_lead") return "pending";
    }
    return raw;
  };

  const normalized: Partial<Record<DecisionStageTraceId, DecisionStageTraceStatus>> = {};
  let blocked = false;

  for (let index = 0; index < PUBLIC_PROGRESS_GATE_ORDER.length; index += 1) {
    const { traceId } = PUBLIC_PROGRESS_GATE_ORDER[index]!;
    const raw = rawStatus(traceId);

    if (blocked) {
      normalized[traceId] = "pending";
      continue;
    }

    if (raw === "done") {
      normalized[traceId] = "done";
      continue;
    }

    if (raw === "in_progress") {
      normalized[traceId] = "in_progress";
      blocked = true;
      continue;
    }

    const laterHasProgress = PUBLIC_PROGRESS_GATE_ORDER.slice(index + 1).some(({ traceId }) => {
      const later = originalStatus(traceId);
      return later === "done" || later === "in_progress";
    });
    normalized[traceId] = laterHasProgress ? "in_progress" : raw;
    blocked = true;
  }

  for (const { traceId } of PUBLIC_DECISION_STAGE_ORDER.slice(4)) {
    normalized[traceId] = rawStatus(traceId);
  }

  return normalized;
}

export function normalizePublicDecisionStageTrace(
  trace: readonly PublicDecisionStageTraceEntry[] | undefined,
  options: PublicDecisionStageContractOptions,
): PublicDecisionStageTraceEntry[] | undefined {
  if (!trace?.length) return undefined;
  const statuses = normalizePublicDecisionStageStatuses(trace, options);
  return trace.map((entry) => ({
    ...entry,
    status: statuses[entry.stageId] ?? entry.status,
  }));
}

export function publicDecisionVisibleStageLimit(
  trace: readonly PublicDecisionStageTraceEntry[] | undefined,
  options: PublicDecisionStageContractOptions,
) {
  if (options.hasRenderableTradeDecision) return 6;
  if (options.analysisOnlyCandidate) return 6;
  if (!trace?.length) return 3;
  const statuses = normalizePublicDecisionStageStatuses(trace, options);
  const active = PUBLIC_PROGRESS_GATE_ORDER.find(
    ({ traceId }) => statuses[traceId] === "in_progress",
  );
  if (active) return active.stage;
  const firstPending = PUBLIC_PROGRESS_GATE_ORDER.find(
    ({ traceId }) => statuses[traceId] === "pending",
  );
  return firstPending ? firstPending.stage : 4;
}
