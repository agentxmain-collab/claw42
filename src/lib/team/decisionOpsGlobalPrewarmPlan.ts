import type { Locale } from "@/i18n/types";
import type { DecisionOpsQueuePriorityPolicyReport } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import type { DecisionOpsResidentPublicVisibilityReport } from "@/lib/team/decisionOpsResidentPublicVisibility";
import {
  HOTSPOT_WINDOW_HOURS,
  MARKET_OVERVIEW_INTERVAL_HOURS,
  hotspotDecisionCandidate,
  marketOverviewCandidate,
} from "@/lib/watch/residentCandidate";
import type {
  ResidentPrewarmKind,
  ResidentPrewarmKindStatus,
  ResidentPrewarmStatus,
} from "@/lib/watch/residentPrewarmStatus";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";

export type DecisionOpsGlobalPrewarmPlanStatus =
  | "ready"
  | "needs_global_prewarm"
  | "blocked_by_queue";

export interface DecisionOpsGlobalPrewarmTarget {
  kind: ResidentPrewarmKind;
  priority: 10 | 20;
  reason:
    | "resident_market_overview_missing"
    | "resident_market_overview_stale"
    | "resident_market_overview_not_visible"
    | "resident_hotspot_missing"
    | "resident_hotspot_stale"
    | "resident_hotspot_not_visible";
  shouldEnqueue: boolean;
  candidate: DecisionCandidate;
  existingJobId: string | null;
  lastSucceededAt: string | null;
}

export interface DecisionOpsGlobalPrewarmPlanAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsGlobalPrewarmPlanReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsGlobalPrewarmPlanStatus;
  clock: "UTC";
  safeToEnqueueResidentPrewarm: boolean;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  utcPolicy: {
    marketOverviewIntervalHours: number;
    hotspotIntervalHours: number;
  };
  summary: {
    plannedTargets: number;
    missingVisibleResidentCards: number;
    blockedByQueue: boolean;
  };
  targets: DecisionOpsGlobalPrewarmTarget[];
  blockingReasons: string[];
  actions: DecisionOpsGlobalPrewarmPlanAction[];
}

export function buildDecisionOpsGlobalPrewarmPlan({
  residentStatus,
  residentVisibility,
  queuePriority,
  locale,
  now = Date.now(),
}: {
  residentStatus: ResidentPrewarmStatus;
  residentVisibility: DecisionOpsResidentPublicVisibilityReport;
  queuePriority: DecisionOpsQueuePriorityPolicyReport;
  locale: Locale;
  now?: number;
}): DecisionOpsGlobalPrewarmPlanReport {
  const blockedByQueue =
    queuePriority.residentPriorityActive || queuePriority.blockedLowerPriorityJobs.length > 0;
  const blockingReasons = blockedByQueue ? ["resident_queue_already_draining"] : [];
  const rawTargets = blockedByQueue
    ? []
    : [
        targetFor({
          kind: "market_overview",
          lane: residentStatus.marketOverview,
          visible: residentVisibility.counts.marketOverview > 0,
          locale,
          now,
        }),
        targetFor({
          kind: "hotspot",
          lane: residentStatus.hotspot,
          visible: residentVisibility.counts.hotspot > 0,
          locale,
          now,
        }),
      ];
  const targets = rawTargets.filter((target): target is DecisionOpsGlobalPrewarmTarget =>
    Boolean(target),
  );
  const status: DecisionOpsGlobalPrewarmPlanStatus = blockedByQueue
    ? "blocked_by_queue"
    : targets.length > 0
      ? "needs_global_prewarm"
      : "ready";

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    clock: "UTC",
    safeToEnqueueResidentPrewarm:
      status === "needs_global_prewarm" && targets.some((target) => target.shouldEnqueue),
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    utcPolicy: {
      marketOverviewIntervalHours: MARKET_OVERVIEW_INTERVAL_HOURS,
      hotspotIntervalHours: HOTSPOT_WINDOW_HOURS,
    },
    summary: {
      plannedTargets: targets.filter((target) => target.shouldEnqueue).length,
      missingVisibleResidentCards: residentVisibility.missingResidentTypes.length,
      blockedByQueue,
    },
    targets,
    blockingReasons,
    actions: actionsFor(status),
  };
}

function targetFor({
  kind,
  lane,
  visible,
  locale,
  now,
}: {
  kind: ResidentPrewarmKind;
  lane: ResidentPrewarmKindStatus;
  visible: boolean;
  locale: Locale;
  now: number;
}): DecisionOpsGlobalPrewarmTarget | null {
  const laneProblem = problemFor(kind, lane);
  const visibilityProblem = visible ? null : notVisibleReasonFor(kind);
  const reason = laneProblem ?? visibilityProblem;
  if (!reason) return null;
  const candidate =
    kind === "market_overview"
      ? marketOverviewCandidate({ locale, now })
      : hotspotDecisionCandidate({ locale, now });

  return {
    kind,
    priority: kind === "market_overview" ? 10 : 20,
    reason,
    shouldEnqueue: lane.state !== "queued" && lane.state !== "running",
    candidate,
    existingJobId: lane.jobId,
    lastSucceededAt: lane.lastSucceededAt,
  };
}

function problemFor(
  kind: ResidentPrewarmKind,
  lane: ResidentPrewarmKindStatus,
): DecisionOpsGlobalPrewarmTarget["reason"] | null {
  const prefix = kind === "market_overview" ? "resident_market_overview" : "resident_hotspot";
  if (lane.state === "empty" || lane.state === "failed") return `${prefix}_missing` as const;
  if (lane.stale || lane.slaState === "critical" || lane.slaState === "degraded") {
    return `${prefix}_stale` as const;
  }
  return null;
}

function notVisibleReasonFor(kind: ResidentPrewarmKind): DecisionOpsGlobalPrewarmTarget["reason"] {
  return kind === "market_overview"
    ? "resident_market_overview_not_visible"
    : "resident_hotspot_not_visible";
}

function actionsFor(
  status: DecisionOpsGlobalPrewarmPlanStatus,
): DecisionOpsGlobalPrewarmPlanAction[] {
  if (status === "ready") return [];
  if (status === "blocked_by_queue") {
    return [
      {
        title: "Wait for resident queue drain",
        description:
          "Resident prewarm work is already queued or running. Do not enqueue duplicate market or hotspot jobs.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Queue missing global resident lanes",
      description:
        "Market overview and hotspot are global UTC lanes. Backfill them before relying on user-visit symbol triggers.",
      executable: false,
    },
  ];
}
