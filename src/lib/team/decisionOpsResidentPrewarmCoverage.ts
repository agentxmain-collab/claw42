import {
  HOTSPOT_BURST_WINDOW_HOURS,
  HOTSPOT_BURST_SCORE_THRESHOLD,
} from "@/lib/watch/residentPrewarm";
import {
  HOTSPOT_WINDOW_HOURS,
  MARKET_OVERVIEW_INTERVAL_HOURS,
} from "@/lib/watch/residentCandidate";
import type {
  ResidentPrewarmKind,
  ResidentPrewarmKindState,
  ResidentPrewarmSlaState,
  ResidentPrewarmStatus,
} from "@/lib/watch/residentPrewarmStatus";

export type DecisionOpsResidentPrewarmCoverageStatus = "ready" | "degraded" | "critical";
export type DecisionOpsResidentPrewarmCoverageIssue =
  | "missing"
  | "queued"
  | "running"
  | "failed"
  | "stale"
  | "cadence_late"
  | null;

export interface DecisionOpsResidentPrewarmLane {
  kind: ResidentPrewarmKind;
  required: true;
  ready: boolean;
  state: ResidentPrewarmKindState;
  slaState: ResidentPrewarmSlaState;
  ageMs: number | null;
  expectedIntervalMs: number;
  staleAfterMs: number;
  lastSucceededAt: string | null;
  candidateKey: string | null;
  issue: DecisionOpsResidentPrewarmCoverageIssue;
}

export interface DecisionOpsResidentPrewarmCoverageAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsResidentPrewarmCoverageReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsResidentPrewarmCoverageStatus;
  allGlobalLanesCovered: boolean;
  utcPolicy: {
    clock: "UTC";
    marketOverviewIntervalHours: number;
    hotspotIntervalHours: number;
    hotspotBurstWindowHours: number;
    hotspotBurstScoreThreshold: number;
  };
  lanes: {
    marketOverview: DecisionOpsResidentPrewarmLane;
    hotspot: DecisionOpsResidentPrewarmLane;
  };
  blockingReasons: string[];
  actions: DecisionOpsResidentPrewarmCoverageAction[];
}

export function buildDecisionOpsResidentPrewarmCoverage({
  residentStatus,
  now = Date.now(),
}: {
  residentStatus: ResidentPrewarmStatus;
  now?: number;
}): DecisionOpsResidentPrewarmCoverageReport {
  const marketOverview = laneFromStatus(residentStatus.marketOverview);
  const hotspot = laneFromStatus(residentStatus.hotspot);
  const lanes = [marketOverview, hotspot];
  const blockingReasons = blockingReasonsFor(lanes);
  const status = statusFor(lanes);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    allGlobalLanesCovered: lanes.every((lane) => lane.issue !== "missing"),
    utcPolicy: {
      clock: "UTC",
      marketOverviewIntervalHours: MARKET_OVERVIEW_INTERVAL_HOURS,
      hotspotIntervalHours: HOTSPOT_WINDOW_HOURS,
      hotspotBurstWindowHours: HOTSPOT_BURST_WINDOW_HOURS,
      hotspotBurstScoreThreshold: HOTSPOT_BURST_SCORE_THRESHOLD,
    },
    lanes: {
      marketOverview,
      hotspot,
    },
    blockingReasons,
    actions: actionsFor(status),
  };
}

function laneFromStatus(status: ResidentPrewarmStatus["marketOverview"]) {
  const issue = issueFor(status);
  return {
    kind: status.kind,
    required: true,
    ready: issue === null,
    state: status.state,
    slaState: status.slaState,
    ageMs: status.ageMs,
    expectedIntervalMs: status.expectedIntervalMs,
    staleAfterMs: status.staleAfterMs,
    lastSucceededAt: status.lastSucceededAt,
    candidateKey: status.candidateKey,
    issue,
  } satisfies DecisionOpsResidentPrewarmLane;
}

function issueFor(
  status: ResidentPrewarmStatus["marketOverview"],
): DecisionOpsResidentPrewarmCoverageIssue {
  if (status.state === "empty") return "missing";
  if (status.state === "running") return "running";
  if (status.state === "queued") return "queued";
  if (status.state === "failed") return "failed";
  if (status.stale || status.slaState === "critical") return "stale";
  if (
    typeof status.ageMs === "number" &&
    status.ageMs > status.expectedIntervalMs &&
    status.slaState === "degraded"
  ) {
    return "cadence_late";
  }
  return null;
}

function statusFor(lanes: readonly DecisionOpsResidentPrewarmLane[]) {
  if (
    lanes.some(
      (lane) => lane.issue === "missing" || lane.issue === "failed" || lane.issue === "stale",
    )
  ) {
    return "critical";
  }
  if (lanes.some((lane) => lane.issue !== null)) return "degraded";
  return "ready";
}

function blockingReasonsFor(lanes: readonly DecisionOpsResidentPrewarmLane[]) {
  return lanes.flatMap((lane) => {
    if (!lane.issue) return [];
    const prefix =
      lane.kind === "market_overview" ? "resident_market_overview" : "resident_hotspot";
    return [`${prefix}_${lane.issue}`];
  });
}

function actionsFor(
  status: DecisionOpsResidentPrewarmCoverageStatus,
): DecisionOpsResidentPrewarmCoverageAction[] {
  if (status === "ready") return [];
  if (status === "critical") {
    return [
      {
        title: "Backfill global resident analysis before judging user-trigger behavior",
        description:
          "Market overview and hotspot are global value lanes. They should be scheduled by UTC cadence and not depend on a visitor opening the board.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Keep resident cadence on the UTC schedule",
      description:
        "A lane is past its expected UTC cadence. Queue a resident prewarm before treating the public board as stable.",
      executable: false,
    },
  ];
}
