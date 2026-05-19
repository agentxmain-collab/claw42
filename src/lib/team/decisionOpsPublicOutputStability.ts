import type { PublicTimelineEvent, PublicTimelinePayload } from "@/lib/watch/publicTimelineEvent";
import {
  comparePublicTimelineEvents,
  publicTimelineEventStableId,
  publicTimelinePmCandidateKey,
} from "@/lib/watch/publicTimelineOrdering";
import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";
import type {
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsPublicOutputStabilityStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsPublicOutputStabilityIssueType =
  | "empty_public_output"
  | "duplicate_candidate_card"
  | "stage_progress_gap"
  | "unstable_order"
  | "minimum_visible_cards_gap"
  | "missing_stage_trace";

export interface DecisionOpsPublicOutputStabilityIssue {
  type: DecisionOpsPublicOutputStabilityIssueType;
  severity: Exclude<DecisionOpsPublicOutputStabilityStatus, "healthy">;
  targetId: string;
  observedValue: number;
  threshold: number;
  message: string;
  action: string;
}

export interface DecisionOpsPublicOutputStabilityAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsPublicOutputStabilityReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsPublicOutputStabilityStatus;
  primaryIssue: DecisionOpsPublicOutputStabilityIssueType | null;
  thresholds: {
    minimumVisibleCards: number;
    maximumDuplicateCandidateCards: number;
    maximumStageProgressGaps: number;
  };
  counts: {
    publicPmEvents: number;
    uniqueCandidateCards: number;
    duplicateCandidateCards: number;
    unstableOrderEvents: number;
    stageProgressGaps: number;
    missingStageTraceEvents: number;
  };
  byCandidateType: Record<CandidateType, number>;
  byPublicStatus: Record<"done" | "active" | "pending", number>;
  order: {
    stable: boolean;
    eventIds: string[];
    expectedEventIds: string[];
  };
  duplicateCandidateKeys: string[];
  issues: DecisionOpsPublicOutputStabilityIssue[];
  actions: DecisionOpsPublicOutputStabilityAction[];
}

const MINIMUM_VISIBLE_CARDS = 2;
const PUBLIC_STAGE_ORDER: DecisionStageTraceId[] = [
  "analyst_inputs",
  "research_lead",
  "trade_decision",
  "risk_lead",
  "record_write",
  "public_timeline",
];
const ISSUE_PRIORITY: DecisionOpsPublicOutputStabilityIssueType[] = [
  "empty_public_output",
  "duplicate_candidate_card",
  "stage_progress_gap",
  "unstable_order",
  "minimum_visible_cards_gap",
  "missing_stage_trace",
];

type PublicPmDecisionEvent = PublicTimelineEvent & {
  payload: Extract<PublicTimelinePayload, { kind: "pm_decision" }>;
};

export function buildDecisionOpsPublicOutputStability({
  publicEvents,
  now = Date.now(),
}: {
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsPublicOutputStabilityReport {
  const pmEvents = publicEvents.filter(isPublicPmEvent);
  const sortedEvents = [...pmEvents].sort(comparePublicTimelineEvents);
  const orderEventIds = pmEvents.map(publicTimelineEventStableId);
  const expectedEventIds = sortedEvents.map(publicTimelineEventStableId);
  const duplicateCandidateKeys = duplicateKeys(
    pmEvents.map(publicTimelinePmCandidateKey).filter((key): key is string => Boolean(key)),
  );
  const stageProgressGaps = pmEvents.filter(hasStageProgressGap);
  const missingStageTraceEvents = pmEvents.filter(
    (event) => !event.payload.stageTrace?.length,
  ).length;
  const issues = sortIssues([
    ...publicOutputIssues(pmEvents.length),
    ...duplicateIssues(duplicateCandidateKeys),
    ...stageIssues(stageProgressGaps),
    ...orderIssues(orderEventIds, expectedEventIds),
    ...missingStageTraceIssues(missingStageTraceEvents),
  ]);
  const primaryIssue = primaryIssueFor(issues);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromIssues(issues),
    primaryIssue,
    thresholds: {
      minimumVisibleCards: MINIMUM_VISIBLE_CARDS,
      maximumDuplicateCandidateCards: 0,
      maximumStageProgressGaps: 0,
    },
    counts: {
      publicPmEvents: pmEvents.length,
      uniqueCandidateCards: new Set(
        pmEvents.map(publicTimelinePmCandidateKey).filter((key): key is string => Boolean(key)),
      ).size,
      duplicateCandidateCards: duplicateCandidateKeys.length,
      unstableOrderEvents: orderStable(orderEventIds, expectedEventIds) ? 0 : pmEvents.length,
      stageProgressGaps: stageProgressGaps.length,
      missingStageTraceEvents,
    },
    byCandidateType: countByCandidateType(pmEvents),
    byPublicStatus: countByPublicStatus(pmEvents),
    order: {
      stable: orderStable(orderEventIds, expectedEventIds),
      eventIds: orderEventIds,
      expectedEventIds,
    },
    duplicateCandidateKeys,
    issues,
    actions: actionsFor(primaryIssue),
  };
}

function isPublicPmEvent(event: PublicTimelineEvent): event is PublicPmDecisionEvent {
  return event.payload.kind === "pm_decision";
}

function publicOutputIssues(publicPmEvents: number): DecisionOpsPublicOutputStabilityIssue[] {
  if (publicPmEvents === 0) {
    return [
      {
        type: "empty_public_output",
        severity: "critical",
        targetId: "public-output",
        observedValue: 0,
        threshold: MINIMUM_VISIBLE_CARDS,
        message: "No public PM decision cards are visible.",
        action: "Inspect refresh, projection, and record visibility before relying on the board.",
      },
    ];
  }
  if (publicPmEvents < MINIMUM_VISIBLE_CARDS) {
    return [
      {
        type: "minimum_visible_cards_gap",
        severity: "degraded",
        targetId: "public-output",
        observedValue: publicPmEvents,
        threshold: MINIMUM_VISIBLE_CARDS,
        message: "The public board has fewer visible decision cards than the stability floor.",
        action:
          "Keep monitoring candidate selection and projection before treating the board as stable.",
      },
    ];
  }
  return [];
}

function duplicateIssues(keys: readonly string[]): DecisionOpsPublicOutputStabilityIssue[] {
  return keys.map((key) => ({
    type: "duplicate_candidate_card" as const,
    severity: "critical" as const,
    targetId: key,
    observedValue: 1,
    threshold: 0,
    message: "A candidate appears more than once in the public card set.",
    action: "Inspect candidate dedupe and hydration before shipping the public board.",
  }));
}

function stageIssues(
  events: readonly PublicTimelineEvent[],
): DecisionOpsPublicOutputStabilityIssue[] {
  return events.map((event) => ({
    type: "stage_progress_gap" as const,
    severity: "critical" as const,
    targetId: publicTimelineEventStableId(event),
    observedValue: 1,
    threshold: 0,
    message: "A public stage advanced while an earlier public stage is still pending.",
    action: "Inspect public stage normalization before exposing this decision card.",
  }));
}

function orderIssues(
  eventIds: readonly string[],
  expectedEventIds: readonly string[],
): DecisionOpsPublicOutputStabilityIssue[] {
  if (orderStable(eventIds, expectedEventIds)) return [];
  return [
    {
      type: "unstable_order",
      severity: "degraded",
      targetId: "public-output-order",
      observedValue: eventIds.length,
      threshold: 0,
      message: "Public events are not in canonical candidate order.",
      action: "Sort by the canonical public timeline comparator before rendering or streaming.",
    },
  ];
}

function missingStageTraceIssues(
  missingStageTraceEvents: number,
): DecisionOpsPublicOutputStabilityIssue[] {
  if (missingStageTraceEvents === 0) return [];
  return [
    {
      type: "missing_stage_trace",
      severity: "degraded",
      targetId: "public-stage-trace",
      observedValue: missingStageTraceEvents,
      threshold: 0,
      message: "Some public PM decision cards have no public stage trace.",
      action: "Inspect projection inputs so progress bars can remain stable.",
    },
  ];
}

function countByCandidateType(
  events: readonly PublicTimelineEvent[],
): Record<CandidateType, number> {
  const counts: Record<CandidateType, number> = { symbol: 0, market_overview: 0, hotspot: 0 };
  for (const event of events) {
    if (event.payload.kind !== "pm_decision") continue;
    counts[normalizeCandidateType(event.payload.candidateType)] += 1;
  }
  return counts;
}

function countByPublicStatus(events: readonly PublicTimelineEvent[]) {
  return events.reduce<Record<"done" | "active" | "pending", number>>(
    (counts, event) => {
      counts[publicStatusForEvent(event)] += 1;
      return counts;
    },
    { done: 0, active: 0, pending: 0 },
  );
}

function publicStatusForEvent(event: PublicTimelineEvent): "done" | "active" | "pending" {
  if (event.payload.kind !== "pm_decision") return "pending";
  const stageTrace = event.payload.stageTrace ?? [];
  if (stageTrace.some((stage) => stage.status === "in_progress")) return "active";
  if (stageTrace.length > 0 && stageTrace.every((stage) => stage.status === "done")) {
    return "done";
  }
  return "pending";
}

function hasStageProgressGap(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return false;
  const stageTrace = event.payload.stageTrace ?? [];
  const statusByStage = new Map(stageTrace.map((stage) => [stage.stageId, stage.status]));
  return PUBLIC_STAGE_ORDER.some((stageId, index) => {
    const status = statusByStage.get(stageId) ?? "pending";
    if (isAdvancedStatus(status)) return false;
    return PUBLIC_STAGE_ORDER.slice(index + 1).some((laterStageId) =>
      isAdvancedStatus(statusByStage.get(laterStageId) ?? "pending"),
    );
  });
}

function isAdvancedStatus(status: DecisionStageTraceStatus) {
  return status === "done" || status === "in_progress";
}

function duplicateKeys(keys: readonly string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

function orderStable(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function primaryIssueFor(
  issues: readonly DecisionOpsPublicOutputStabilityIssue[],
): DecisionOpsPublicOutputStabilityIssueType | null {
  return ISSUE_PRIORITY.find((type) => issues.some((issue) => issue.type === type)) ?? null;
}

function statusFromIssues(
  issues: readonly DecisionOpsPublicOutputStabilityIssue[],
): DecisionOpsPublicOutputStabilityStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function sortIssues(issues: DecisionOpsPublicOutputStabilityIssue[]) {
  return [...issues].sort(
    (a, b) =>
      ISSUE_PRIORITY.indexOf(a.type) - ISSUE_PRIORITY.indexOf(b.type) ||
      a.targetId.localeCompare(b.targetId),
  );
}

function actionsFor(
  primaryIssue: DecisionOpsPublicOutputStabilityIssueType | null,
): DecisionOpsPublicOutputStabilityAction[] {
  if (!primaryIssue) return [];
  const shared = { executable: false as const };
  if (primaryIssue === "empty_public_output") {
    return [
      {
        title: "Inspect public projection before user-facing checks",
        description:
          "Confirm records project into public PM events before judging UI or refresh behavior.",
        ...shared,
      },
    ];
  }
  if (primaryIssue === "duplicate_candidate_card") {
    return [
      {
        title: "Inspect candidate dedupe and hydration",
        description:
          "Compare duplicate candidate keys against record backfill and stream projection sources.",
        ...shared,
      },
    ];
  }
  if (primaryIssue === "stage_progress_gap") {
    return [
      {
        title: "Inspect public stage normalization",
        description:
          "Review the projected stage trace before exposing progress bars for the affected card.",
        ...shared,
      },
    ];
  }
  return [
    {
      title: "Keep output stability in observe mode",
      description:
        "Use canonical ordering, stage trace, and card-count diagnostics before changing refresh behavior.",
      ...shared,
    },
  ];
}
