import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export type DecisionOpsStabilityStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsStabilityIssueType =
  | "stale_running_job"
  | "public_output_gap"
  | "run_success_rate_low"
  | "cron_cadence_gap"
  | "queue_backlog";

export interface DecisionOpsStabilityWindow {
  windowHours: 24 | 168;
  expectedCronJobs: number;
  cronJobs: number;
  cronCoverageRate: number | null;
  jobs: {
    total: number;
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
  };
  runs: {
    total: number;
    running: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  publicPmEvents: number;
  runSuccessRate: number | null;
  publicOutputRate: number | null;
}

export interface DecisionOpsStabilityIssue {
  type: DecisionOpsStabilityIssueType;
  severity: Exclude<DecisionOpsStabilityStatus, "healthy">;
  windowHours: 24 | 168 | null;
  targetId: string;
  observedValue: number | null;
  threshold: number;
  message: string;
  action: string;
}

export interface DecisionOpsStabilityAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsStabilityReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsStabilityStatus;
  primaryIssue: DecisionOpsStabilityIssueType | null;
  thresholds: {
    expectedCronIntervalMs: number;
    minCronCoverageRate: number;
    minRunSuccessRate: number;
    minPublicOutputRate: number;
    staleRunningJobAfterMs: number;
  };
  windows: DecisionOpsStabilityWindow[];
  issues: DecisionOpsStabilityIssue[];
  actions: DecisionOpsStabilityAction[];
}

const EXPECTED_CRON_INTERVAL_MS = 3 * 60 * 60_000;
const MIN_CRON_COVERAGE_RATE = 0.75;
const MIN_RUN_SUCCESS_RATE = 0.8;
const MIN_PUBLIC_OUTPUT_RATE = 0.8;
const STALE_RUNNING_JOB_AFTER_MS = 30 * 60_000;

const ISSUE_PRIORITY: DecisionOpsStabilityIssueType[] = [
  "stale_running_job",
  "public_output_gap",
  "run_success_rate_low",
  "cron_cadence_gap",
  "queue_backlog",
];

export function buildDecisionOpsStability({
  jobs,
  runs,
  publicEvents,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsStabilityReport {
  const publicPmEvents = publicEvents.filter((event) => event.payload.kind === "pm_decision");
  const windows = [
    buildWindow(24, jobs, runs, publicPmEvents, now),
    buildWindow(168, jobs, runs, publicPmEvents, now),
  ];
  const issues = sortIssues([
    ...staleRunningJobIssues(jobs, now),
    ...windows.flatMap((window) => windowIssues(window)),
  ]);
  const primaryIssue = issues[0]?.type ?? null;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFor(issues),
    primaryIssue,
    thresholds: {
      expectedCronIntervalMs: EXPECTED_CRON_INTERVAL_MS,
      minCronCoverageRate: MIN_CRON_COVERAGE_RATE,
      minRunSuccessRate: MIN_RUN_SUCCESS_RATE,
      minPublicOutputRate: MIN_PUBLIC_OUTPUT_RATE,
      staleRunningJobAfterMs: STALE_RUNNING_JOB_AFTER_MS,
    },
    windows,
    issues,
    actions: actionsFor(primaryIssue),
  };
}

function buildWindow(
  windowHours: 24 | 168,
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
  publicPmEvents: readonly PublicTimelineEvent[],
  now: number,
): DecisionOpsStabilityWindow {
  const startsAt = now - windowHours * 60 * 60_000;
  const windowJobs = jobs.filter((job) => safeTime(jobTime(job)) >= startsAt);
  const windowRuns = runs.filter((run) => safeTime(run.startedAt) >= startsAt);
  const windowPublicEvents = publicPmEvents.filter((event) => event.ts >= startsAt);
  const cronJobs = windowJobs.filter((job) => job.triggerSource === "cron");
  const succeededRunsWithRecord = windowRuns.filter(
    (run) => run.status === "succeeded" && run.decisionRecordId,
  );
  const publicEventIndex = buildPublicEventIndex(windowPublicEvents);
  const expectedCronJobs = Math.ceil((windowHours * 60 * 60_000) / EXPECTED_CRON_INTERVAL_MS);

  return {
    windowHours,
    expectedCronJobs,
    cronJobs: cronJobs.length,
    cronCoverageRate: rateCapped(cronJobs.length, expectedCronJobs),
    jobs: {
      total: windowJobs.length,
      queued: windowJobs.filter((job) => job.status === "queued").length,
      running: windowJobs.filter((job) => job.status === "running").length,
      succeeded: windowJobs.filter((job) => job.status === "succeeded").length,
      failed: windowJobs.filter((job) => job.status === "failed").length,
    },
    runs: {
      total: windowRuns.length,
      running: windowRuns.filter((run) => run.status === "running").length,
      succeeded: windowRuns.filter((run) => run.status === "succeeded").length,
      failed: windowRuns.filter((run) => run.status === "failed").length,
      skipped: windowRuns.filter((run) => run.status === "skipped").length,
    },
    publicPmEvents: windowPublicEvents.length,
    runSuccessRate: rate(
      windowRuns.filter((run) => run.status === "succeeded").length,
      windowRuns.length,
    ),
    publicOutputRate: rate(
      succeededRunsWithRecord.filter((run) => hasPublicEventForRun(run, publicEventIndex)).length,
      succeededRunsWithRecord.length,
    ),
  };
}

function staleRunningJobIssues(
  jobs: readonly PmDecisionJobRecord[],
  now: number,
): DecisionOpsStabilityIssue[] {
  return jobs.flatMap((job) => {
    if (job.status !== "running") return [];
    const age = ageMs(job.startedAt, now);
    if (age === null || age < STALE_RUNNING_JOB_AFTER_MS) return [];
    return [
      {
        type: "stale_running_job" as const,
        severity: "critical" as const,
        windowHours: null,
        targetId: job.id,
        observedValue: age,
        threshold: STALE_RUNNING_JOB_AFTER_MS,
        message: "PM job stayed running beyond the stability threshold.",
        action: "Inspect queue consumer and provider logs before increasing trigger pressure.",
      },
    ];
  });
}

function windowIssues(window: DecisionOpsStabilityWindow): DecisionOpsStabilityIssue[] {
  const issues: DecisionOpsStabilityIssue[] = [];

  if (window.cronCoverageRate !== null && window.cronCoverageRate < MIN_CRON_COVERAGE_RATE) {
    issues.push({
      type: "cron_cadence_gap",
      severity: window.cronJobs === 0 ? "critical" : "degraded",
      windowHours: window.windowHours,
      targetId: `window:${window.windowHours}h:cron_cadence`,
      observedValue: window.cronCoverageRate,
      threshold: MIN_CRON_COVERAGE_RATE,
      message: "Scheduled cron coverage is below the stability threshold.",
      action: "Inspect scheduled cron delivery before changing PM execution cadence.",
    });
  }

  if (window.jobs.queued > 0 || window.jobs.running > 0) {
    issues.push({
      type: "queue_backlog",
      severity: "degraded",
      windowHours: window.windowHours,
      targetId: `window:${window.windowHours}h:queue_backlog`,
      observedValue: window.jobs.queued + window.jobs.running,
      threshold: 0,
      message: "PM job queue still has queued or running work in the stability window.",
      action: "Inspect queue drain before increasing visit-trigger pressure.",
    });
  }

  if (window.runSuccessRate !== null && window.runSuccessRate < MIN_RUN_SUCCESS_RATE) {
    issues.push({
      type: "run_success_rate_low",
      severity: window.runSuccessRate === 0 ? "critical" : "degraded",
      windowHours: window.windowHours,
      targetId: `window:${window.windowHours}h:run_success_rate`,
      observedValue: window.runSuccessRate,
      threshold: MIN_RUN_SUCCESS_RATE,
      message: "PM run success rate is below the stability threshold.",
      action: "Inspect provider failures and quality gates before changing cadence.",
    });
  }

  if (window.publicOutputRate !== null && window.publicOutputRate < MIN_PUBLIC_OUTPUT_RATE) {
    issues.push({
      type: "public_output_gap",
      severity: "critical",
      windowHours: window.windowHours,
      targetId: `window:${window.windowHours}h:public_output_rate`,
      observedValue: window.publicOutputRate,
      threshold: MIN_PUBLIC_OUTPUT_RATE,
      message: "Successful PM runs are not consistently reaching public output.",
      action: "Inspect timeline projection and hydration before touching PM execution.",
    });
  }

  return issues;
}

function actionsFor(
  primaryIssue: DecisionOpsStabilityIssueType | null,
): DecisionOpsStabilityAction[] {
  if (!primaryIssue) return [];
  if (primaryIssue === "stale_running_job") {
    return [
      {
        title: "Inspect stale running PM jobs",
        description:
          "A running job has exceeded the stability threshold. Check queue consumer and provider logs first.",
        executable: false,
      },
    ];
  }
  if (primaryIssue === "public_output_gap") {
    return [
      {
        title: "Inspect public output projection",
        description:
          "Successful runs are not consistently visible publicly. Check projection and hydration before execution changes.",
        executable: false,
      },
    ];
  }
  if (primaryIssue === "run_success_rate_low") {
    return [
      {
        title: "Inspect PM run failures",
        description:
          "Run success rate is below threshold. Check provider and quality gate failures.",
        executable: false,
      },
    ];
  }
  if (primaryIssue === "cron_cadence_gap") {
    return [
      {
        title: "Inspect scheduled cron delivery",
        description:
          "Cron coverage is below threshold. Check Vercel cron delivery before cadence changes.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Inspect PM queue backlog",
      description: "Queued or running work remains in the stability window.",
      executable: false,
    },
  ];
}

function statusFor(issues: readonly DecisionOpsStabilityIssue[]): DecisionOpsStabilityStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function sortIssues(issues: readonly DecisionOpsStabilityIssue[]) {
  return [...issues].sort(
    (left, right) =>
      ISSUE_PRIORITY.indexOf(left.type) - ISSUE_PRIORITY.indexOf(right.type) ||
      (left.windowHours ?? 0) - (right.windowHours ?? 0) ||
      left.targetId.localeCompare(right.targetId),
  );
}

function buildPublicEventIndex(publicPmEvents: readonly PublicTimelineEvent[]) {
  const byId = new Set<string>();
  const byRecordId = new Set<string>();
  for (const event of publicPmEvents) {
    byId.add(event.id);
    if (event.payload.kind === "pm_decision") byRecordId.add(event.payload.recordId);
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

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function rateCapped(numerator: number, denominator: number) {
  const value = rate(numerator, denominator);
  return value === null ? null : Math.min(1, value);
}

function jobTime(job: PmDecisionJobRecord) {
  return job.completedAt ?? job.updatedAt ?? job.startedAt ?? job.createdAt;
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function ageMs(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}
