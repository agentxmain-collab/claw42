import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export type DecisionOpsSloStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsSloViolationType =
  | "job_stale_running"
  | "job_retry_overdue"
  | "job_retry_exhausted"
  | "job_success_zero_output"
  | "run_stale_running"
  | "run_failed"
  | "run_succeeded_without_public_event"
  | "window_run_success_rate_low"
  | "window_zero_output_rate_high"
  | "window_public_projection_rate_low";

export interface DecisionOpsSloViolation {
  type: DecisionOpsSloViolationType;
  severity: Exclude<DecisionOpsSloStatus, "healthy">;
  targetId: string;
  candidateKey?: string;
  symbol?: string | null;
  observedValue: number | null;
  threshold: number;
  message: string;
  action: string;
}

export interface DecisionOpsSloWindow {
  windowHours: 24 | 168;
  jobs: number;
  runs: number;
  publicPmEvents: number;
  runSuccessRate: number | null;
  zeroOutputRate: number | null;
  publicProjectionRate: number | null;
}

export interface DecisionOpsSloReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSloStatus;
  thresholds: {
    staleRunningJobAfterMs: number;
    staleRunningRunAfterMs: number;
    minRunSuccessRate24h: number;
    maxZeroOutputRate24h: number;
    minPublicProjectionRate24h: number;
  };
  counts: {
    criticalViolations: number;
    degradedViolations: number;
    totalViolations: number;
  };
  violations: DecisionOpsSloViolation[];
  windows: DecisionOpsSloWindow[];
}

const STALE_RUNNING_JOB_AFTER_MS = 30 * 60_000;
const STALE_RUNNING_RUN_AFTER_MS = 30 * 60_000;
const MIN_RUN_SUCCESS_RATE_24H = 0.8;
const MAX_ZERO_OUTPUT_RATE_24H = 0.1;
const MIN_PUBLIC_PROJECTION_RATE_24H = 0.8;

export function buildDecisionOpsSlo({
  jobs,
  runs,
  publicEvents,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsSloReport {
  const publicPmEvents = publicEvents.filter((event) => event.payload.kind === "pm_decision");
  const windows = [
    buildWindow(24, jobs, runs, publicPmEvents, now),
    buildWindow(168, jobs, runs, publicPmEvents, now),
  ];
  const violations = sortViolations([
    ...jobViolations(jobs, now),
    ...runViolations(runs, publicPmEvents, now),
    ...windowViolations(windows[0]),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromViolations(violations),
    thresholds: {
      staleRunningJobAfterMs: STALE_RUNNING_JOB_AFTER_MS,
      staleRunningRunAfterMs: STALE_RUNNING_RUN_AFTER_MS,
      minRunSuccessRate24h: MIN_RUN_SUCCESS_RATE_24H,
      maxZeroOutputRate24h: MAX_ZERO_OUTPUT_RATE_24H,
      minPublicProjectionRate24h: MIN_PUBLIC_PROJECTION_RATE_24H,
    },
    counts: {
      criticalViolations: violations.filter((violation) => violation.severity === "critical")
        .length,
      degradedViolations: violations.filter((violation) => violation.severity === "degraded")
        .length,
      totalViolations: violations.length,
    },
    violations,
    windows,
  };
}

function jobViolations(
  jobs: readonly PmDecisionJobRecord[],
  now: number,
): DecisionOpsSloViolation[] {
  const violations: DecisionOpsSloViolation[] = [];

  for (const job of jobs) {
    if (job.status === "running") {
      const age = ageMs(job.startedAt, now);
      if (age !== null && age >= STALE_RUNNING_JOB_AFTER_MS) {
        violations.push({
          type: "job_stale_running",
          severity: "critical",
          targetId: job.id,
          candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
          symbol: job.symbol,
          observedValue: age,
          threshold: STALE_RUNNING_JOB_AFTER_MS,
          message: "PM job stayed running beyond the queue SLO.",
          action: "Inspect queue consumer and provider logs before retrying.",
        });
      }
    }

    if ((job.status === "queued" || job.status === "failed") && isPastOrNow(job.nextRunAt, now)) {
      violations.push({
        type: "job_retry_overdue",
        severity: "degraded",
        targetId: job.id,
        candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
        symbol: job.symbol,
        observedValue: ageMs(job.nextRunAt, now),
        threshold: 0,
        message: "PM job retry is overdue.",
        action: "Verify queue drain before widening cadence.",
      });
    }

    if (job.status === "failed" && job.nextRunAt === null && job.attemptCount >= job.maxAttempts) {
      violations.push({
        type: "job_retry_exhausted",
        severity: "critical",
        targetId: job.id,
        candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
        symbol: job.symbol,
        observedValue: job.attemptCount,
        threshold: job.maxAttempts,
        message: "PM job exhausted all retry attempts.",
        action: "Inspect lastError and provider status before manual replay.",
      });
    }

    if (job.status === "succeeded" && job.outputCount === 0) {
      violations.push({
        type: "job_success_zero_output",
        severity: "degraded",
        targetId: job.id,
        candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
        symbol: job.symbol,
        observedValue: 0,
        threshold: 1,
        message: "Succeeded PM job wrote zero decision records.",
        action: "Inspect quality gate and run ledger before replay.",
      });
    }
  }

  return violations;
}

function runViolations(
  runs: readonly DecisionRunRecord[],
  publicPmEvents: readonly PublicTimelineEvent[],
  now: number,
): DecisionOpsSloViolation[] {
  const publicEventIndex = buildPublicEventIndex(publicPmEvents);
  const violations: DecisionOpsSloViolation[] = [];

  for (const run of runs) {
    if (run.status === "running") {
      const age = ageMs(run.startedAt, now);
      if (age !== null && age >= STALE_RUNNING_RUN_AFTER_MS) {
        violations.push({
          type: "run_stale_running",
          severity: "critical",
          targetId: run.id,
          candidateKey: run.candidate.candidateKey,
          symbol: run.symbol,
          observedValue: age,
          threshold: STALE_RUNNING_RUN_AFTER_MS,
          message: "PM run stayed running beyond the execution SLO.",
          action: "Inspect provider logs and stage trace before retrying.",
        });
      }
    }

    if (run.status === "failed") {
      violations.push({
        type: "run_failed",
        severity: "critical",
        targetId: run.id,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        observedValue: null,
        threshold: 0,
        message: run.error ?? "PM run failed.",
        action: "Inspect run error and provider telemetry before replay.",
      });
    }

    if (
      run.status === "succeeded" &&
      run.decisionRecordId &&
      !hasPublicEventForRun(run, publicEventIndex)
    ) {
      violations.push({
        type: "run_succeeded_without_public_event",
        severity: "critical",
        targetId: run.id,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        observedValue: 0,
        threshold: 1,
        message: "Succeeded PM run has no matching public timeline event.",
        action: "Inspect public projection and hydration before touching PM execution.",
      });
    }
  }

  return violations;
}

function buildWindow(
  windowHours: 24 | 168,
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
  publicPmEvents: readonly PublicTimelineEvent[],
  now: number,
): DecisionOpsSloWindow {
  const startsAt = now - windowHours * 60 * 60_000;
  const windowJobs = jobs.filter((job) => safeTime(jobTime(job)) >= startsAt);
  const windowRuns = runs.filter((run) => safeTime(run.startedAt) >= startsAt);
  const windowPublicEvents = publicPmEvents.filter((event) => event.ts >= startsAt);
  const succeededJobs = windowJobs.filter((job) => job.status === "succeeded");
  const succeededRunsWithRecord = windowRuns.filter(
    (run) => run.status === "succeeded" && run.decisionRecordId,
  );
  const publicEventIndex = buildPublicEventIndex(windowPublicEvents);

  return {
    windowHours,
    jobs: windowJobs.length,
    runs: windowRuns.length,
    publicPmEvents: windowPublicEvents.length,
    runSuccessRate: rate(
      windowRuns.filter((run) => run.status === "succeeded").length,
      windowRuns.length,
    ),
    zeroOutputRate: rate(
      succeededJobs.filter((job) => job.outputCount === 0).length,
      succeededJobs.length,
    ),
    publicProjectionRate: rate(
      succeededRunsWithRecord.filter((run) => hasPublicEventForRun(run, publicEventIndex)).length,
      succeededRunsWithRecord.length,
    ),
  };
}

function windowViolations(window: DecisionOpsSloWindow): DecisionOpsSloViolation[] {
  const violations: DecisionOpsSloViolation[] = [];
  if (window.runSuccessRate !== null && window.runSuccessRate < MIN_RUN_SUCCESS_RATE_24H) {
    violations.push({
      type: "window_run_success_rate_low",
      severity: "degraded",
      targetId: `window:${window.windowHours}h:run_success_rate`,
      observedValue: window.runSuccessRate,
      threshold: MIN_RUN_SUCCESS_RATE_24H,
      message: "Recent PM run success rate is below SLO.",
      action: "Inspect queue/provider failure concentration before changing cadence.",
    });
  }
  if (window.zeroOutputRate !== null && window.zeroOutputRate > MAX_ZERO_OUTPUT_RATE_24H) {
    violations.push({
      type: "window_zero_output_rate_high",
      severity: "degraded",
      targetId: `window:${window.windowHours}h:zero_output_rate`,
      observedValue: window.zeroOutputRate,
      threshold: MAX_ZERO_OUTPUT_RATE_24H,
      message: "Recent zero-output job rate is above SLO.",
      action: "Inspect quality gate and record writer before replay.",
    });
  }
  if (
    window.publicProjectionRate !== null &&
    window.publicProjectionRate < MIN_PUBLIC_PROJECTION_RATE_24H
  ) {
    violations.push({
      type: "window_public_projection_rate_low",
      severity: "critical",
      targetId: `window:${window.windowHours}h:public_projection_rate`,
      observedValue: window.publicProjectionRate,
      threshold: MIN_PUBLIC_PROJECTION_RATE_24H,
      message: "Recent public projection rate is below SLO.",
      action: "Inspect timeline projection and hydration before touching execution.",
    });
  }
  return violations;
}

function buildPublicEventIndex(publicPmEvents: readonly PublicTimelineEvent[]) {
  const byId = new Set<string>();
  const byRecordId = new Set<string>();
  for (const event of publicPmEvents) {
    byId.add(event.id);
    if (event.payload.kind === "pm_decision") {
      byRecordId.add(event.payload.recordId);
    }
  }
  return { byId, byRecordId };
}

function hasPublicEventForRun(
  run: DecisionRunRecord,
  publicEventIndex: ReturnType<typeof buildPublicEventIndex>,
) {
  return Boolean(
    (run.publicTimelineEventId && publicEventIndex.byId.has(run.publicTimelineEventId)) ||
    (run.decisionRecordId && publicEventIndex.byRecordId.has(run.decisionRecordId)),
  );
}

function sortViolations(violations: readonly DecisionOpsSloViolation[]) {
  return [...violations].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.type.localeCompare(b.type) ||
      a.targetId.localeCompare(b.targetId),
  );
}

function statusFromViolations(violations: readonly DecisionOpsSloViolation[]) {
  if (violations.some((violation) => violation.severity === "critical")) return "critical";
  if (violations.length > 0) return "degraded";
  return "healthy";
}

function severityRank(severity: Exclude<DecisionOpsSloStatus, "healthy">) {
  return severity === "critical" ? 0 : 1;
}

function isPastOrNow(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp <= now;
}

function ageMs(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function jobTime(job: PmDecisionJobRecord) {
  return job.completedAt ?? job.updatedAt ?? job.startedAt ?? job.createdAt;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}
