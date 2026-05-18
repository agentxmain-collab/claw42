import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export type DecisionOpsReconciliationStatus = "healthy" | "degraded" | "critical";
export type DecisionOpsReconciliationSeverity = "degraded" | "critical";

export type DecisionOpsReconciliationIssueType =
  | "job_succeeded_without_run"
  | "job_zero_output"
  | "run_succeeded_without_job"
  | "run_succeeded_without_public_event"
  | "run_stale_running";

export type DecisionOpsRepairAction =
  | "inspect_run"
  | "inspect_job_ledger"
  | "inspect_timeline_projection"
  | "inspect_provider_logs"
  | "manual_replay_candidate"
  | "wait_for_running";

export interface DecisionOpsRepairProposal {
  action: DecisionOpsRepairAction;
  executable: false;
  reason: string;
}

export interface DecisionOpsReconciliationIssue {
  type: DecisionOpsReconciliationIssueType;
  severity: DecisionOpsReconciliationSeverity;
  jobId?: string;
  runId?: string;
  recordId?: string;
  publicTimelineEventId?: string;
  candidateKey?: string;
  symbol?: string | null;
  message: string;
  repairProposal: DecisionOpsRepairProposal;
}

export interface DecisionOpsCanaryCheck {
  name: "queue_readiness" | "job_success" | "run_success" | "public_timeline";
  status: "ready" | "degraded" | "blocked";
  message: string;
}

export interface DecisionOpsHistoryWindow {
  windowHours: 24 | 168;
  jobs: number;
  runs: number;
  publicPmEvents: number;
  runSuccessRate: number | null;
  zeroOutputRate: number | null;
  qualityBlockRate: number | null;
  averageDurationMs: number | null;
  averageQualityScore: number | null;
}

export interface DecisionOpsReconciliationReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsReconciliationStatus;
  counts: {
    jobs: number;
    runs: number;
    publicPmEvents: number;
    succeededJobs: number;
    succeededRuns: number;
    issues: number;
    repairProposals: number;
  };
  issues: DecisionOpsReconciliationIssue[];
  repairProposals: DecisionOpsRepairProposal[];
  canary: {
    status: "ready" | "degraded" | "blocked";
    checks: DecisionOpsCanaryCheck[];
  };
  history: {
    windows: DecisionOpsHistoryWindow[];
  };
}

const RUN_RUNNING_STALE_MS = 30 * 60_000;

export function buildDecisionOpsReconciliation({
  jobs,
  runs,
  publicEvents,
  queueReadiness,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicEvents: readonly PublicTimelineEvent[];
  queueReadiness?: PmDecisionQueueReadiness;
  now?: number;
}): DecisionOpsReconciliationReport {
  const publicPmEvents = publicEvents.filter((event) => event.payload.kind === "pm_decision");
  const context = buildIndexes(jobs, runs, publicPmEvents);
  const issues = sortIssues([...jobIssues(jobs, context), ...runIssues(runs, context, now)]);
  const repairProposals = issues.map((issue) => issue.repairProposal);
  const canary = buildCanary({ jobs, runs, publicPmEvents, queueReadiness });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: reportStatus(issues),
    counts: {
      jobs: jobs.length,
      runs: runs.length,
      publicPmEvents: publicPmEvents.length,
      succeededJobs: jobs.filter((job) => job.status === "succeeded").length,
      succeededRuns: runs.filter((run) => run.status === "succeeded").length,
      issues: issues.length,
      repairProposals: repairProposals.length,
    },
    issues,
    repairProposals,
    canary,
    history: {
      windows: [
        historyWindow(24, jobs, runs, publicPmEvents, now),
        historyWindow(168, jobs, runs, publicPmEvents, now),
      ],
    },
  };
}

function buildIndexes(
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
  publicPmEvents: readonly PublicTimelineEvent[],
) {
  const runsByRecordId = new Map<string, DecisionRunRecord[]>();
  const jobsByRecordId = new Map<string, PmDecisionJobRecord[]>();
  const publicEventsById = new Map<string, PublicTimelineEvent>();
  const publicEventsByRecordId = new Map<string, PublicTimelineEvent>();

  for (const run of runs) {
    if (!run.decisionRecordId) continue;
    const existing = runsByRecordId.get(run.decisionRecordId) ?? [];
    existing.push(run);
    runsByRecordId.set(run.decisionRecordId, existing);
  }

  for (const job of jobs) {
    for (const recordId of job.decisionRecordIds) {
      const existing = jobsByRecordId.get(recordId) ?? [];
      existing.push(job);
      jobsByRecordId.set(recordId, existing);
    }
  }

  for (const event of publicPmEvents) {
    publicEventsById.set(event.id, event);
    if (event.payload.kind === "pm_decision") {
      publicEventsByRecordId.set(event.payload.recordId, event);
    }
  }

  return {
    runsByRecordId,
    jobsByRecordId,
    publicEventsById,
    publicEventsByRecordId,
  };
}

function jobIssues(
  jobs: readonly PmDecisionJobRecord[],
  context: ReturnType<typeof buildIndexes>,
): DecisionOpsReconciliationIssue[] {
  const issues: DecisionOpsReconciliationIssue[] = [];

  for (const job of jobs) {
    if (job.status !== "succeeded") continue;
    if (job.outputCount === 0) {
      issues.push({
        type: "job_zero_output",
        severity: "degraded",
        jobId: job.id,
        candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
        symbol: job.symbol,
        message: "Succeeded PM job wrote zero decision records.",
        repairProposal: {
          action: "inspect_run",
          executable: false,
          reason: "Inspect the associated decision run and quality gate before replay.",
        },
      });
      continue;
    }

    for (const recordId of job.decisionRecordIds) {
      const matchingRuns = context.runsByRecordId.get(recordId) ?? [];
      if (matchingRuns.length === 0) {
        issues.push({
          type: "job_succeeded_without_run",
          severity: "degraded",
          jobId: job.id,
          recordId,
          candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
          symbol: job.symbol,
          message: "Succeeded PM job has a decision record but no matching decision run ledger.",
          repairProposal: {
            action: "inspect_run",
            executable: false,
            reason: "Verify the run ledger write before considering any manual replay.",
          },
        });
      }
    }
  }

  return issues;
}

function runIssues(
  runs: readonly DecisionRunRecord[],
  context: ReturnType<typeof buildIndexes>,
  now: number,
): DecisionOpsReconciliationIssue[] {
  const issues: DecisionOpsReconciliationIssue[] = [];

  for (const run of runs) {
    if (run.status === "running" && isRunStale(run, now)) {
      issues.push({
        type: "run_stale_running",
        severity: "critical",
        runId: run.id,
        recordId: run.decisionRecordId ?? undefined,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        message: "Decision run is still running beyond the visibility window.",
        repairProposal: {
          action: "inspect_provider_logs",
          executable: false,
          reason: "Check provider and queue logs before widening cadence or retrying.",
        },
      });
    }

    if (run.status !== "succeeded") continue;
    if (!run.decisionRecordId) continue;

    if (!(context.jobsByRecordId.get(run.decisionRecordId) ?? []).length) {
      issues.push({
        type: "run_succeeded_without_job",
        severity: "degraded",
        runId: run.id,
        recordId: run.decisionRecordId,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        message: "Succeeded decision run has no matching PM job ledger entry.",
        repairProposal: {
          action: "inspect_job_ledger",
          executable: false,
          reason: "Verify job ledger retention and idempotency before replay.",
        },
      });
    }

    if (!hasPublicTimelineEvent(run, context)) {
      issues.push({
        type: "run_succeeded_without_public_event",
        severity: "degraded",
        runId: run.id,
        recordId: run.decisionRecordId,
        publicTimelineEventId: run.publicTimelineEventId ?? undefined,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        message: "Succeeded decision run has no matching public PM timeline event.",
        repairProposal: {
          action: "inspect_timeline_projection",
          executable: false,
          reason: "Inspect public projection/backfill before touching pipeline execution.",
        },
      });
    }
  }

  return issues;
}

function hasPublicTimelineEvent(run: DecisionRunRecord, context: ReturnType<typeof buildIndexes>) {
  if (run.publicTimelineEventId && context.publicEventsById.has(run.publicTimelineEventId)) {
    return true;
  }
  return Boolean(run.decisionRecordId && context.publicEventsByRecordId.has(run.decisionRecordId));
}

function buildCanary({
  jobs,
  runs,
  publicPmEvents,
  queueReadiness,
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicPmEvents: readonly PublicTimelineEvent[];
  queueReadiness?: PmDecisionQueueReadiness;
}) {
  const checks: DecisionOpsCanaryCheck[] = [
    {
      name: "queue_readiness",
      status: queueReadiness ? "ready" : "degraded",
      message: queueReadiness
        ? `PM decision queue mode is ${queueReadiness.mode}.`
        : "PM decision queue readiness was not supplied.",
    },
    {
      name: "job_success",
      status: jobs.some((job) => job.status === "succeeded" && job.outputCount > 0)
        ? "ready"
        : "blocked",
      message: "At least one PM job succeeded with public output.",
    },
    {
      name: "run_success",
      status: runs.some((run) => run.status === "succeeded" && run.decisionRecordId)
        ? "ready"
        : "blocked",
      message: "At least one decision run succeeded with a decision record.",
    },
    {
      name: "public_timeline",
      status: publicPmEvents.length > 0 ? "ready" : "blocked",
      message: "At least one PM decision is projectable into the public timeline.",
    },
  ];
  return {
    status: canaryStatus(checks),
    checks,
  };
}

function canaryStatus(
  checks: readonly DecisionOpsCanaryCheck[],
): DecisionOpsReconciliationReport["canary"]["status"] {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ready";
}

function historyWindow(
  windowHours: 24 | 168,
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
  publicPmEvents: readonly PublicTimelineEvent[],
  now: number,
): DecisionOpsHistoryWindow {
  const cutoff = now - windowHours * 60 * 60_000;
  const windowJobs = jobs.filter((job) => safeTime(job.completedAt ?? job.updatedAt) >= cutoff);
  const windowRuns = runs.filter((run) => safeTime(run.completedAt ?? run.startedAt) >= cutoff);
  const windowEvents = publicPmEvents.filter((event) => event.ts >= cutoff);
  const succeededJobs = windowJobs.filter((job) => job.status === "succeeded");
  const completedRuns = windowRuns.filter((run) => run.status !== "running");
  const qualityScores = windowRuns
    .map((run) => run.quality?.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return {
    windowHours,
    jobs: windowJobs.length,
    runs: windowRuns.length,
    publicPmEvents: windowEvents.length,
    runSuccessRate: rate(
      windowRuns.filter((run) => run.status === "succeeded").length,
      completedRuns.length,
    ),
    zeroOutputRate: rate(
      succeededJobs.filter((job) => job.outputCount === 0).length,
      succeededJobs.length,
    ),
    qualityBlockRate: rate(
      windowRuns.filter((run) => run.skipReason === "public_quality_gate_failed").length,
      windowRuns.length,
    ),
    averageDurationMs: average(
      windowRuns
        .map((run) => durationMsForRun(run))
        .filter((duration): duration is number => typeof duration === "number"),
    ),
    averageQualityScore: average(qualityScores),
  };
}

function reportStatus(issues: readonly DecisionOpsReconciliationIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function isRunStale(run: DecisionRunRecord, now: number) {
  const startedAt = safeTime(run.startedAt);
  return startedAt > 0 && now - startedAt >= RUN_RUNNING_STALE_MS;
}

function durationMsForRun(run: DecisionRunRecord) {
  const startedAt = safeTime(run.startedAt);
  const completedAt = safeTime(run.completedAt);
  if (startedAt === 0 || completedAt === 0) return null;
  return Math.max(0, completedAt - startedAt);
}

function average(values: readonly number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1_000) / 1_000;
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortIssues(issues: readonly DecisionOpsReconciliationIssue[]) {
  const severityRank: Record<DecisionOpsReconciliationSeverity, number> = {
    critical: 0,
    degraded: 1,
  };
  return [...issues].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.type.localeCompare(b.type) ||
      (a.recordId ?? "").localeCompare(b.recordId ?? "") ||
      (a.runId ?? a.jobId ?? "").localeCompare(b.runId ?? b.jobId ?? ""),
  );
}
