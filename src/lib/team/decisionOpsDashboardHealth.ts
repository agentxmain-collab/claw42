import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { buildDecisionOpsResidentPublicVisibility } from "@/lib/team/decisionOpsResidentPublicVisibility";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import {
  deriveResidentPrewarmStatus,
  type ResidentPrewarmKindStatus,
} from "@/lib/watch/residentPrewarmStatus";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";
import { mergePublicTimelineEvents } from "@/lib/watch/publicTimelineOrdering";

export interface PublicDashboardHealthReport {
  schemaVersion: 1;
  generatedAt: string;
  status: "ready" | "degraded" | "critical";
  aligned: boolean;
  visibleCards: {
    marketOverview: number;
    hotspot: number;
    symbol: number;
  };
  residentStatus: {
    overallState: string;
    slaState: string;
    latestSucceededAt: string | null;
    marketOverview: PublicResidentLaneStatus;
    hotspot: PublicResidentLaneStatus;
  };
  blockingReasons: string[];
}

interface PublicResidentLaneStatus {
  state: string;
  slaState: string;
  stale: boolean;
  ageMs: number | null;
  lastSucceededAt: string | null;
  nextRunAt: string | null;
}

export function buildPublicDashboardHealth({
  records,
  jobs,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  jobs: readonly PmDecisionJobRecord[];
  now?: number;
}): PublicDashboardHealthReport {
  const publicEvents = publicPmEventsFromRecords(records);
  const residentStatus = deriveResidentPrewarmStatus({ records, jobs, now });
  const residentVisibility = buildDecisionOpsResidentPublicVisibility({
    publicEvents,
    now,
  });
  const blockingReasons = [
    ...residentVisibility.blockingReasons,
    ...residentSlaBlockingReasons(residentStatus.marketOverview),
    ...residentSlaBlockingReasons(residentStatus.hotspot),
  ];
  const aligned =
    residentVisibility.allResidentCardsVisible && residentStatus.slaState !== "critical";

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: aligned ? "ready" : residentStatus.slaState === "degraded" ? "degraded" : "critical",
    aligned,
    visibleCards: residentVisibility.counts,
    residentStatus: {
      overallState: residentStatus.overallState,
      slaState: residentStatus.slaState,
      latestSucceededAt: residentStatus.latestSucceededAt,
      marketOverview: publicLaneStatus(residentStatus.marketOverview),
      hotspot: publicLaneStatus(residentStatus.hotspot),
    },
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}

function publicPmEventsFromRecords(records: readonly StrategyDecisionRecord[]) {
  return mergePublicTimelineEvents(
    records
      .map((record) => projectDecisionRecordToPublicEvent(record))
      .filter((event): event is PublicTimelineEvent => event?.payload.kind === "pm_decision"),
  );
}

function residentSlaBlockingReasons(status: ResidentPrewarmKindStatus) {
  if (status.slaState !== "critical") return [];
  return [`resident_${status.kind}_sla_critical`];
}

function publicLaneStatus(status: ResidentPrewarmKindStatus): PublicResidentLaneStatus {
  return {
    state: status.state,
    slaState: status.slaState,
    stale: status.stale,
    ageMs: status.ageMs,
    lastSucceededAt: status.lastSucceededAt,
    nextRunAt: status.nextRunAt,
  };
}
