import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

export type DecisionOpsCronAuditStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsCronAuditIssueType =
  | "no_cron_job"
  | "cron_job_stale"
  | "cron_job_retry_overdue"
  | "cron_job_retry_exhausted"
  | "cron_job_stale_running"
  | "cron_job_zero_output"
  | "no_cron_run"
  | "cron_run_failed"
  | "cron_run_stale_running"
  | "cron_run_missing_public_output";

export interface DecisionOpsCronAuditIssue {
  type: DecisionOpsCronAuditIssueType;
  severity: Exclude<DecisionOpsCronAuditStatus, "healthy">;
  targetId: string;
  ageMs: number | null;
  message: string;
  action: string;
}

export interface DecisionOpsCronAuditJobSnapshot {
  id: string;
  status: PmDecisionJobRecord["status"];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  ageMs: number | null;
  outputCount: number;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt: string | null;
  lastError: string | null;
}

export interface DecisionOpsCronAuditRunSnapshot {
  id: string;
  status: DecisionRunRecord["status"];
  startedAt: string;
  completedAt: string | null;
  ageMs: number | null;
  symbol: string;
  candidateKey: string;
  decisionRecordId: string | null;
  publicTimelineEventId: string | null;
  error: string | null;
  skipReason: string | null;
}

export interface DecisionOpsCronAudit {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsCronAuditStatus;
  schedule: {
    path: "/api/cron/strategy-replay";
    expression: "0 */3 * * *";
    expectedIntervalMs: number;
    degradedAfterMs: number;
    criticalAfterMs: number;
  };
  queue: {
    enabled: boolean;
    mode: PmDecisionQueueReadiness["mode"];
    topic: PmDecisionQueueReadiness["topic"];
    visibilityTimeoutMs: number;
    maxDeliveries: number;
    cronJobs: {
      total: number;
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      retryBacklog: number;
      overdueRetry: number;
      exhaustedFailed: number;
      staleRunning: number;
      zeroOutputSuccess: number;
    };
  };
  latest: {
    cronJob: DecisionOpsCronAuditJobSnapshot | null;
    cronRun: DecisionOpsCronAuditRunSnapshot | null;
  };
  issues: DecisionOpsCronAuditIssue[];
}

const CRON_PATH = "/api/cron/strategy-replay" as const;
const CRON_EXPRESSION = "0 */3 * * *" as const;
const EXPECTED_INTERVAL_MS = 3 * 60 * 60_000;
const DEGRADED_AFTER_MS = 4 * 60 * 60_000;
const CRITICAL_AFTER_MS = 8 * 60 * 60_000;

export function buildDecisionOpsCronAudit({
  jobs,
  runs,
  queueReadiness,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  queueReadiness: PmDecisionQueueReadiness;
  now?: number;
}): DecisionOpsCronAudit {
  const cronJobs = jobs.filter((job) => job.triggerSource === "cron");
  const cronRuns = runs.filter((run) => run.triggerSource === "cron");
  const latestCronJob = latestBy(cronJobs, (job) => safeTime(job.createdAt));
  const latestCronRun = latestBy(cronRuns, (run) => safeTime(run.completedAt ?? run.startedAt));
  const issues = sortIssues([
    ...cronCadenceIssues(latestCronJob, now),
    ...cronJobQueueIssues(cronJobs, queueReadiness, now),
    ...cronRunIssues(latestCronRun, now),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromIssues(issues),
    schedule: {
      path: CRON_PATH,
      expression: CRON_EXPRESSION,
      expectedIntervalMs: EXPECTED_INTERVAL_MS,
      degradedAfterMs: DEGRADED_AFTER_MS,
      criticalAfterMs: CRITICAL_AFTER_MS,
    },
    queue: {
      enabled: queueReadiness.enabled,
      mode: queueReadiness.mode,
      topic: queueReadiness.topic,
      visibilityTimeoutMs: queueReadiness.visibilityTimeoutSeconds * 1000,
      maxDeliveries: queueReadiness.maxDeliveries,
      cronJobs: cronJobCounts(cronJobs, queueReadiness, now),
    },
    latest: {
      cronJob: latestCronJob ? cronJobSnapshot(latestCronJob, now) : null,
      cronRun: latestCronRun ? cronRunSnapshot(latestCronRun, now) : null,
    },
    issues,
  };
}

function cronCadenceIssues(
  latestCronJob: PmDecisionJobRecord | undefined,
  now: number,
): DecisionOpsCronAuditIssue[] {
  if (!latestCronJob) {
    return [
      {
        type: "no_cron_job",
        severity: "critical",
        targetId: "cron-job-ledger",
        ageMs: null,
        message: "No scheduled PM cron job exists in the job ledger.",
        action: "Verify Vercel cron delivery and /api/cron/strategy-replay authorization.",
      },
    ];
  }

  const age = ageMs(latestCronJob.createdAt, now);
  if (age === null || age < DEGRADED_AFTER_MS) return [];

  return [
    {
      type: "cron_job_stale",
      severity: age >= CRITICAL_AFTER_MS ? "critical" : "degraded",
      targetId: latestCronJob.id,
      ageMs: age,
      message: "Latest scheduled PM cron job is older than the expected cadence.",
      action: "Check Vercel cron delivery before changing candidate ranking or PM prompts.",
    },
  ];
}

function cronJobQueueIssues(
  cronJobs: readonly PmDecisionJobRecord[],
  queueReadiness: PmDecisionQueueReadiness,
  now: number,
): DecisionOpsCronAuditIssue[] {
  const issues: DecisionOpsCronAuditIssue[] = [];
  const staleAfterMs = queueReadiness.visibilityTimeoutSeconds * 1000;

  for (const job of cronJobs) {
    if ((job.status === "queued" || job.status === "failed") && isPastOrNow(job.nextRunAt, now)) {
      issues.push({
        type: "cron_job_retry_overdue",
        severity: "degraded",
        targetId: job.id,
        ageMs: ageMs(job.nextRunAt, now),
        message: "Scheduled PM job retry is due but has not been processed.",
        action: "Verify queue consumer drain and retry delivery before manual replay.",
      });
    }

    if (job.status === "failed" && job.nextRunAt === null && job.attemptCount >= job.maxAttempts) {
      issues.push({
        type: "cron_job_retry_exhausted",
        severity: "critical",
        targetId: job.id,
        ageMs: ageMs(job.completedAt ?? job.updatedAt, now),
        message: "Scheduled PM job exhausted all retry attempts.",
        action: "Inspect lastError and provider telemetry before replaying the job.",
      });
    }

    if (job.status === "running") {
      const age = ageMs(job.startedAt, now);
      if (age !== null && age >= staleAfterMs) {
        issues.push({
          type: "cron_job_stale_running",
          severity: "critical",
          targetId: job.id,
          ageMs: age,
          message: "Scheduled PM job has held the running lease past the queue visibility window.",
          action: "Inspect queue lease recovery and provider logs before widening cadence.",
        });
      }
    }

    if (job.status === "succeeded" && job.outputCount === 0) {
      issues.push({
        type: "cron_job_zero_output",
        severity: "degraded",
        targetId: job.id,
        ageMs: ageMs(job.completedAt ?? job.updatedAt, now),
        message: "Scheduled PM job succeeded without writing decision records.",
        action: "Inspect run skipReason, quality gate, and public projection before replay.",
      });
    }
  }

  return issues;
}

function cronRunIssues(
  latestCronRun: DecisionRunRecord | undefined,
  now: number,
): DecisionOpsCronAuditIssue[] {
  if (!latestCronRun) {
    return [
      {
        type: "no_cron_run",
        severity: "critical",
        targetId: "cron-run-ledger",
        ageMs: null,
        message: "No scheduled PM run exists in the run ledger.",
        action: "Verify scheduled jobs are reaching the PM decision runner.",
      },
    ];
  }

  const issues: DecisionOpsCronAuditIssue[] = [];
  if (latestCronRun.status === "running") {
    const age = ageMs(latestCronRun.startedAt, now);
    if (age !== null && age >= 30 * 60_000) {
      issues.push({
        type: "cron_run_stale_running",
        severity: "critical",
        targetId: latestCronRun.id,
        ageMs: age,
        message: "Latest scheduled PM run is still running past the execution window.",
        action: "Inspect provider logs and stage trace before replaying.",
      });
    }
  }

  if (latestCronRun.status === "failed") {
    issues.push({
      type: "cron_run_failed",
      severity: "critical",
      targetId: latestCronRun.id,
      ageMs: ageMs(latestCronRun.completedAt ?? latestCronRun.startedAt, now),
      message: latestCronRun.error ?? "Latest scheduled PM run failed.",
      action: "Inspect run error and provider telemetry before replaying.",
    });
  }

  if (
    latestCronRun.status === "succeeded" &&
    latestCronRun.decisionRecordId &&
    !latestCronRun.publicTimelineEventId
  ) {
    issues.push({
      type: "cron_run_missing_public_output",
      severity: "critical",
      targetId: latestCronRun.id,
      ageMs: ageMs(latestCronRun.completedAt ?? latestCronRun.startedAt, now),
      message: "Latest scheduled PM run wrote a decision record without a public timeline event.",
      action: "Inspect public projection and hydration before touching PM execution.",
    });
  }

  return issues;
}

function cronJobCounts(
  cronJobs: readonly PmDecisionJobRecord[],
  queueReadiness: PmDecisionQueueReadiness,
  now: number,
) {
  const staleAfterMs = queueReadiness.visibilityTimeoutSeconds * 1000;
  return {
    total: cronJobs.length,
    queued: cronJobs.filter((job) => job.status === "queued").length,
    running: cronJobs.filter((job) => job.status === "running").length,
    succeeded: cronJobs.filter((job) => job.status === "succeeded").length,
    failed: cronJobs.filter((job) => job.status === "failed").length,
    retryBacklog: cronJobs.filter((job) => job.status === "failed" && job.nextRunAt).length,
    overdueRetry: cronJobs.filter(
      (job) =>
        (job.status === "queued" || job.status === "failed") && isPastOrNow(job.nextRunAt, now),
    ).length,
    exhaustedFailed: cronJobs.filter(
      (job) =>
        job.status === "failed" && job.nextRunAt === null && job.attemptCount >= job.maxAttempts,
    ).length,
    staleRunning: cronJobs.filter((job) => {
      if (job.status !== "running") return false;
      const age = ageMs(job.startedAt, now);
      return age !== null && age >= staleAfterMs;
    }).length,
    zeroOutputSuccess: cronJobs.filter((job) => job.status === "succeeded" && job.outputCount === 0)
      .length,
  };
}

function cronJobSnapshot(job: PmDecisionJobRecord, now: number): DecisionOpsCronAuditJobSnapshot {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    ageMs: ageMs(job.completedAt ?? job.updatedAt ?? job.startedAt ?? job.createdAt, now),
    outputCount: job.outputCount,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    nextRunAt: job.nextRunAt,
    lastError: job.lastError,
  };
}

function cronRunSnapshot(run: DecisionRunRecord, now: number): DecisionOpsCronAuditRunSnapshot {
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    ageMs: ageMs(run.completedAt ?? run.startedAt, now),
    symbol: run.symbol,
    candidateKey: run.candidate.candidateKey,
    decisionRecordId: run.decisionRecordId,
    publicTimelineEventId: run.publicTimelineEventId,
    error: run.error,
    skipReason: run.skipReason,
  };
}

function latestBy<T>(items: readonly T[], getTime: (item: T) => number) {
  return [...items].sort((a, b) => getTime(b) - getTime(a))[0];
}

function sortIssues(issues: readonly DecisionOpsCronAuditIssue[]) {
  return [...issues].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.type.localeCompare(b.type) ||
      a.targetId.localeCompare(b.targetId),
  );
}

function statusFromIssues(issues: readonly DecisionOpsCronAuditIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function severityRank(severity: Exclude<DecisionOpsCronAuditStatus, "healthy">) {
  return severity === "critical" ? 0 : 1;
}

function isPastOrNow(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp <= now;
}

function ageMs(value: string | null | undefined, now: number) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
