import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent, PublicTimelinePayload } from "@/lib/watch/publicTimelineEvent";
import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";

type ResidentCanaryKind = Extract<CandidateType, "market_overview" | "hotspot">;
type ResidentPmEvent = PublicTimelineEvent & {
  payload: Extract<PublicTimelinePayload, { kind: "pm_decision" }>;
};

export type DecisionOpsResidentQueueCanaryStatus = "ready" | "degraded" | "blocked";

export type DecisionOpsResidentQueueCanaryIssue =
  | "job_missing"
  | "job_pending"
  | "job_failed"
  | "job_zero_output"
  | "run_missing"
  | "run_not_succeeded"
  | "public_event_missing"
  | null;

export interface DecisionOpsResidentQueueCanaryLane {
  kind: ResidentCanaryKind;
  status: DecisionOpsResidentQueueCanaryStatus;
  issue: DecisionOpsResidentQueueCanaryIssue;
  ready: boolean;
  candidateKey: string | null;
  jobId: string | null;
  jobStatus: PmDecisionJobRecord["status"] | null;
  jobOutputCount: number | null;
  runId: string | null;
  runStatus: DecisionRunRecord["status"] | null;
  decisionRecordId: string | null;
  publicTimelineEventId: string | null;
  latestJobAt: string | null;
  latestRunAt: string | null;
  latestPublicEventAt: string | null;
}

export interface DecisionOpsResidentQueueCanaryReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsResidentQueueCanaryStatus;
  allResidentClosedLoopReady: boolean;
  summary: {
    readyLanes: number;
    degradedLanes: number;
    blockedLanes: number;
  };
  lanes: {
    marketOverview: DecisionOpsResidentQueueCanaryLane;
    hotspot: DecisionOpsResidentQueueCanaryLane;
  };
  blockingReasons: string[];
  actions: Array<{
    title: string;
    description: string;
    executable: false;
  }>;
}

const RESIDENT_KINDS: ResidentCanaryKind[] = ["market_overview", "hotspot"];

export function buildDecisionOpsResidentQueueCanary({
  jobs,
  runs,
  publicEvents,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsResidentQueueCanaryReport {
  const lanes = Object.fromEntries(
    RESIDENT_KINDS.map((kind) => [kind, laneFor(kind, jobs, runs, publicEvents)]),
  ) as Record<ResidentCanaryKind, DecisionOpsResidentQueueCanaryLane>;
  const laneValues = RESIDENT_KINDS.map((kind) => lanes[kind]);
  const blockingReasons = laneValues.flatMap((lane) =>
    lane.issue ? [`resident_${lane.kind}_${lane.issue}`] : [],
  );
  const status = reportStatus(laneValues);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    allResidentClosedLoopReady: status === "ready",
    summary: {
      readyLanes: laneValues.filter((lane) => lane.status === "ready").length,
      degradedLanes: laneValues.filter((lane) => lane.status === "degraded").length,
      blockedLanes: laneValues.filter((lane) => lane.status === "blocked").length,
    },
    lanes: {
      marketOverview: lanes.market_overview,
      hotspot: lanes.hotspot,
    },
    blockingReasons,
    actions: actionsFor(status),
  };
}

function laneFor(
  kind: ResidentCanaryKind,
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
  publicEvents: readonly PublicTimelineEvent[],
): DecisionOpsResidentQueueCanaryLane {
  const job = latestJobFor(kind, jobs);
  const run = latestRunFor(kind, runs, job);
  const publicEvent = publicEventFor(kind, publicEvents, run);
  const issue = issueFor(job, run, publicEvent);
  const status = laneStatus(issue, job, run);

  return {
    kind,
    status,
    issue,
    ready: issue === null,
    candidateKey:
      job?.candidate?.candidateKey ??
      run?.candidate.candidateKey ??
      publicCandidateKey(publicEvent) ??
      null,
    jobId: job?.id ?? null,
    jobStatus: job?.status ?? null,
    jobOutputCount: job?.outputCount ?? null,
    runId: run?.id ?? null,
    runStatus: run?.status ?? null,
    decisionRecordId: run?.decisionRecordId ?? job?.decisionRecordIds[0] ?? null,
    publicTimelineEventId: publicEvent?.id ?? run?.publicTimelineEventId ?? null,
    latestJobAt: job ? latestJobTimestamp(job) : null,
    latestRunAt: run ? latestRunTimestamp(run) : null,
    latestPublicEventAt: publicEvent ? new Date(publicEvent.ts).toISOString() : null,
  };
}

function latestJobFor(kind: ResidentCanaryKind, jobs: readonly PmDecisionJobRecord[]) {
  return jobs
    .filter((job) => normalizeCandidateType(job.candidate?.candidateType) === kind)
    .sort(
      (left, right) => timestamp(right, latestJobTimestamp) - timestamp(left, latestJobTimestamp),
    )[0];
}

function latestRunFor(
  kind: ResidentCanaryKind,
  runs: readonly DecisionRunRecord[],
  job: PmDecisionJobRecord | undefined,
) {
  const recordIds = new Set(job?.decisionRecordIds ?? []);
  const kindRuns = runs.filter(
    (run) => normalizeCandidateType(run.candidate.candidateType) === kind,
  );
  const matchingRecordRuns = kindRuns.filter(
    (run) => run.decisionRecordId && recordIds.has(run.decisionRecordId),
  );
  return (matchingRecordRuns.length > 0 ? matchingRecordRuns : kindRuns).sort(
    (left, right) => timestamp(right, latestRunTimestamp) - timestamp(left, latestRunTimestamp),
  )[0];
}

function publicEventFor(
  kind: ResidentCanaryKind,
  events: readonly PublicTimelineEvent[],
  run: DecisionRunRecord | undefined,
) {
  const candidates = events
    .filter(isPmEvent)
    .filter((event) => normalizeCandidateType(event.payload.candidateType) === kind);
  const byRunEventId = run?.publicTimelineEventId
    ? candidates.find((event) => event.id === run.publicTimelineEventId)
    : undefined;
  if (byRunEventId) return byRunEventId;
  const byRecordId = run?.decisionRecordId
    ? candidates.find(
        (event) =>
          event.payload.kind === "pm_decision" && event.payload.recordId === run.decisionRecordId,
      )
    : undefined;
  if (byRecordId) return byRecordId;
  return candidates.sort((left, right) => right.ts - left.ts || left.id.localeCompare(right.id))[0];
}

function isPmEvent(event: PublicTimelineEvent): event is ResidentPmEvent {
  return event.payload.kind === "pm_decision";
}

function issueFor(
  job: PmDecisionJobRecord | undefined,
  run: DecisionRunRecord | undefined,
  publicEvent: PublicTimelineEvent | undefined,
): DecisionOpsResidentQueueCanaryIssue {
  if (!job) return "job_missing";
  if (job.status === "queued" || job.status === "running") return "job_pending";
  if (job.status === "failed") return "job_failed";
  if (job.status === "succeeded" && job.outputCount === 0) return "job_zero_output";
  if (!run) return "run_missing";
  if (run.status !== "succeeded" || !run.decisionRecordId) return "run_not_succeeded";
  if (!publicEvent) return "public_event_missing";
  return null;
}

function laneStatus(
  issue: DecisionOpsResidentQueueCanaryIssue,
  job: PmDecisionJobRecord | undefined,
  run: DecisionRunRecord | undefined,
): DecisionOpsResidentQueueCanaryStatus {
  if (!issue) return "ready";
  if (job?.status === "queued" || job?.status === "running" || run?.status === "running") {
    return "degraded";
  }
  return "blocked";
}

function reportStatus(lanes: readonly DecisionOpsResidentQueueCanaryLane[]) {
  if (lanes.some((lane) => lane.status === "blocked")) return "blocked";
  if (lanes.some((lane) => lane.status === "degraded")) return "degraded";
  return "ready";
}

function actionsFor(status: DecisionOpsResidentQueueCanaryStatus) {
  if (status === "ready") return [];
  if (status === "degraded") {
    return [
      {
        title: "Wait for resident queue drain",
        description:
          "A resident market or hotspot job is queued/running. Keep the lane in observe mode until it reaches public output.",
        executable: false as const,
      },
    ];
  }
  return [
    {
      title: "Inspect resident closed-loop break",
      description:
        "Trace the affected resident lane through PM job ledger, decision run ledger, and public timeline projection before changing candidate ranking or prompts.",
      executable: false as const,
    },
  ];
}

function latestJobTimestamp(job: PmDecisionJobRecord) {
  return job.completedAt ?? job.startedAt ?? job.updatedAt ?? job.createdAt;
}

function latestRunTimestamp(run: DecisionRunRecord) {
  return run.completedAt ?? run.startedAt;
}

function timestamp<T>(value: T, getIso: (value: T) => string | null) {
  const ts = Date.parse(getIso(value) ?? "");
  return Number.isFinite(ts) ? ts : 0;
}

function publicCandidateKey(event: PublicTimelineEvent | undefined) {
  if (!event || event.payload.kind !== "pm_decision") return null;
  return event.payload.candidateKey ?? null;
}
