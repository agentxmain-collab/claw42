import type { PmDecisionJobRecord, PmDecisionJobStatus } from "@/lib/watch/pmDecisionJobLedger";

export type DecisionOpsQueuePriorityBand =
  | "resident_market_overview"
  | "resident_hotspot"
  | "symbol_once"
  | "batch";

export type DecisionOpsQueuePriorityPolicyStatus = "ready" | "prioritizing_resident";

export interface DecisionOpsQueuePriority {
  rank: number;
  band: DecisionOpsQueuePriorityBand;
  resident: boolean;
}

export interface DecisionOpsQueuePriorityItem {
  jobId: string;
  priority: DecisionOpsQueuePriority;
  status: PmDecisionJobStatus;
  due: boolean;
  nextRunAt: string | null;
  candidateKey: string | null;
}

export interface DecisionOpsQueuePriorityBlocker {
  jobId: string;
  blockingJobIds: string[];
  retryAfterSeconds: number;
  reason: "higher_priority_resident_due";
}

export interface DecisionOpsQueuePriorityPolicyAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsQueuePriorityPolicyReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsQueuePriorityPolicyStatus;
  residentPriorityActive: boolean;
  pendingOrder: DecisionOpsQueuePriorityItem[];
  blockedLowerPriorityJobs: DecisionOpsQueuePriorityBlocker[];
  priorityBands: {
    residentMarketOverview: number;
    residentHotspot: number;
    symbolOnce: number;
    batch: number;
  };
  nextActions: DecisionOpsQueuePriorityPolicyAction[];
}

const DEFAULT_PRIORITY_RETRY_SECONDS = 30;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30 * 60;

export function buildDecisionOpsQueuePriorityPolicy({
  jobs,
  now = Date.now(),
  visibilityTimeoutSeconds = DEFAULT_VISIBILITY_TIMEOUT_SECONDS,
}: {
  jobs: readonly PmDecisionJobRecord[];
  now?: number;
  visibilityTimeoutSeconds?: number;
}): DecisionOpsQueuePriorityPolicyReport {
  const dueItems = jobs
    .filter((job) => isDueQueueWork(job, now, visibilityTimeoutSeconds))
    .map((job) => itemFor(job, now, visibilityTimeoutSeconds))
    .sort((left, right) => {
      const priorityDelta = left.priority.rank - right.priority.rank;
      if (priorityDelta !== 0) return priorityDelta;
      return left.jobId.localeCompare(right.jobId);
    });
  const blockedLowerPriorityJobs = dueItems.flatMap((item) => {
    const job = jobs.find((candidate) => candidate.id === item.jobId);
    if (!job) return [];
    const blockers = findResidentPriorityBlockers(job, jobs, now, { visibilityTimeoutSeconds });
    return blockers
      ? [
          {
            jobId: job.id,
            blockingJobIds: blockers.blockingJobIds,
            retryAfterSeconds: blockers.retryAfterSeconds,
            reason: blockers.reason,
          },
        ]
      : [];
  });
  const residentPriorityActive =
    dueItems.some((item) => item.priority.resident) || blockedLowerPriorityJobs.length > 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: residentPriorityActive ? "prioritizing_resident" : "ready",
    residentPriorityActive,
    pendingOrder: dueItems,
    blockedLowerPriorityJobs,
    priorityBands: {
      residentMarketOverview: dueItems.filter(
        (item) => item.priority.band === "resident_market_overview",
      ).length,
      residentHotspot: dueItems.filter((item) => item.priority.band === "resident_hotspot").length,
      symbolOnce: dueItems.filter((item) => item.priority.band === "symbol_once").length,
      batch: dueItems.filter((item) => item.priority.band === "batch").length,
    },
    nextActions: residentPriorityActive
      ? [
          {
            title: "Drain resident prewarm before lower-priority PM work",
            description:
              "Market overview and hotspot are global high-value lanes. Queue consumers should process them before symbol and batch jobs.",
            executable: false,
          },
        ]
      : [],
  };
}

export function getPmDecisionJobQueuePriority(job: PmDecisionJobRecord): DecisionOpsQueuePriority {
  if (job.candidate?.candidateType === "market_overview") {
    return { rank: 10, band: "resident_market_overview", resident: true };
  }
  if (job.candidate?.candidateType === "hotspot") {
    return { rank: 20, band: "resident_hotspot", resident: true };
  }
  if (job.kind === "once") {
    return { rank: 30, band: "symbol_once", resident: false };
  }
  return { rank: 40, band: "batch", resident: false };
}

export function findResidentPriorityBlockers(
  job: PmDecisionJobRecord,
  jobs: readonly PmDecisionJobRecord[],
  now = Date.now(),
  {
    visibilityTimeoutSeconds = DEFAULT_VISIBILITY_TIMEOUT_SECONDS,
  }: {
    visibilityTimeoutSeconds?: number;
  } = {},
): DecisionOpsQueuePriorityBlocker | null {
  const priority = getPmDecisionJobQueuePriority(job);
  const blockingJobs = jobs
    .filter((candidate) => candidate.id !== job.id)
    .filter((candidate) => {
      const candidatePriority = getPmDecisionJobQueuePriority(candidate);
      return candidatePriority.resident && candidatePriority.rank < priority.rank;
    })
    .filter((candidate) => isDueQueueWork(candidate, now, visibilityTimeoutSeconds))
    .sort((left, right) => {
      const priorityDelta =
        getPmDecisionJobQueuePriority(left).rank - getPmDecisionJobQueuePriority(right).rank;
      if (priorityDelta !== 0) return priorityDelta;
      return left.id.localeCompare(right.id);
    });
  if (blockingJobs.length === 0) return null;

  const retryAfterSeconds = Math.max(
    DEFAULT_PRIORITY_RETRY_SECONDS,
    Math.min(
      ...blockingJobs.map((blockingJob) =>
        retryAfterSecondsFor(blockingJob, now, visibilityTimeoutSeconds),
      ),
    ),
  );

  return {
    jobId: job.id,
    blockingJobIds: blockingJobs.map((blockingJob) => blockingJob.id),
    retryAfterSeconds,
    reason: "higher_priority_resident_due",
  };
}

function itemFor(
  job: PmDecisionJobRecord,
  now: number,
  visibilityTimeoutSeconds: number,
): DecisionOpsQueuePriorityItem {
  return {
    jobId: job.id,
    priority: getPmDecisionJobQueuePriority(job),
    status: job.status,
    due: isDueQueueWork(job, now, visibilityTimeoutSeconds),
    nextRunAt: job.nextRunAt,
    candidateKey: job.candidate?.candidateKey ?? null,
  };
}

function isDueQueueWork(job: PmDecisionJobRecord, now: number, visibilityTimeoutSeconds: number) {
  if (job.status === "succeeded") return false;
  if (isExhaustedFailedJob(job)) return false;
  if (job.status === "running")
    return activeRunningJobStillHoldsLease(job, now, visibilityTimeoutSeconds);
  if (!job.nextRunAt) return true;
  const nextRunAtMs = Date.parse(job.nextRunAt);
  return !Number.isFinite(nextRunAtMs) || nextRunAtMs <= now;
}

function retryAfterSecondsFor(
  job: PmDecisionJobRecord,
  now: number,
  visibilityTimeoutSeconds: number,
) {
  if (job.status === "running" && job.startedAt) {
    const startedAtMs = Date.parse(job.startedAt);
    const recoverAtMs = startedAtMs + visibilityTimeoutSeconds * 1000;
    if (Number.isFinite(recoverAtMs) && recoverAtMs > now) {
      return Math.ceil((recoverAtMs - now) / 1000);
    }
  }
  return DEFAULT_PRIORITY_RETRY_SECONDS;
}

function isExhaustedFailedJob(job: PmDecisionJobRecord) {
  return job.status === "failed" && job.nextRunAt === null && job.attemptCount >= job.maxAttempts;
}

function activeRunningJobStillHoldsLease(
  job: PmDecisionJobRecord,
  now: number,
  visibilityTimeoutSeconds: number,
) {
  if (!job.startedAt) return false;
  const startedAtMs = Date.parse(job.startedAt);
  return Number.isFinite(startedAtMs) && startedAtMs + visibilityTimeoutSeconds * 1000 > now;
}
