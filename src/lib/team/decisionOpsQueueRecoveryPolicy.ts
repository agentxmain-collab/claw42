import type { DecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type {
  DecisionOpsCronAudit,
  DecisionOpsCronAuditIssueType,
} from "@/lib/team/decisionOpsCronAudit";
import type {
  DecisionOpsHealthAlert,
  DecisionOpsHealthSummary,
} from "@/lib/team/decisionOpsHealth";

export type DecisionOpsQueueRecoveryStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsQueueRecoveryMode =
  | "observe"
  | "manual_intervention"
  | "investigate_before_replay"
  | "pause_new_triggers";

export interface DecisionOpsQueueRecoveryStep {
  title: string;
  description: string;
  executable: false;
  evidence: string[];
}

export interface DecisionOpsQueueRecoveryPolicy {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsQueueRecoveryStatus;
  mode: DecisionOpsQueueRecoveryMode;
  shouldPauseNewTriggers: boolean;
  autoRecoveryAllowed: false;
  primaryAction: string | null;
  evidence: {
    rootCause: DecisionOpsChainRunbook["rootCause"];
    publicBoardState: DecisionOpsChainRunbook["publicBoardState"];
    queueMode: DecisionOpsCronAudit["queue"]["mode"];
    cronIssueCodes: DecisionOpsCronAuditIssueType[];
    healthAlerts: DecisionOpsHealthAlert[];
    exhaustedCronJobs: number;
    staleRunningCronJobs: number;
    overdueCronRetries: number;
    zeroOutputCronJobs: number;
  };
  recoverySteps: DecisionOpsQueueRecoveryStep[];
}

const MANUAL_QUEUE_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_job_retry_exhausted",
  "cron_job_stale_running",
]);

const RETRY_QUEUE_ISSUES = new Set<DecisionOpsCronAuditIssueType>(["cron_job_retry_overdue"]);

const RUNNER_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_run_failed",
  "cron_run_stale_running",
]);

const QUALITY_OR_ZERO_OUTPUT_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_job_zero_output",
  "cron_run_missing_public_output",
]);

const MANUAL_HEALTH_ALERTS = new Set<DecisionOpsHealthAlert>([
  "queue_exhausted",
  "queue_stale_running",
]);

const QUALITY_HEALTH_ALERTS = new Set<DecisionOpsHealthAlert>([
  "job_zero_output",
  "quality_blocking",
]);

export function buildDecisionOpsQueueRecoveryPolicy({
  runbook,
  cronAudit,
  health,
  now = Date.now(),
}: {
  runbook: DecisionOpsChainRunbook;
  cronAudit: DecisionOpsCronAudit;
  health: DecisionOpsHealthSummary;
  now?: number;
}): DecisionOpsQueueRecoveryPolicy {
  const cronIssueCodes = cronAudit.issues.map((issue) => issue.type);
  const mode = modeFor({ runbook, cronIssueCodes, health });
  const status = statusFor({ runbook, cronAudit, health, mode });
  const primaryAction = primaryActionFor(mode, runbook.rootCause);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    mode,
    shouldPauseNewTriggers: shouldPauseNewTriggers({ mode, cronAudit, health }),
    autoRecoveryAllowed: false,
    primaryAction,
    evidence: {
      rootCause: runbook.rootCause,
      publicBoardState: runbook.publicBoardState,
      queueMode: cronAudit.queue.mode,
      cronIssueCodes,
      healthAlerts: health.alerts,
      exhaustedCronJobs: cronAudit.queue.cronJobs.exhaustedFailed,
      staleRunningCronJobs: cronAudit.queue.cronJobs.staleRunning,
      overdueCronRetries: cronAudit.queue.cronJobs.overdueRetry,
      zeroOutputCronJobs: cronAudit.queue.cronJobs.zeroOutputSuccess,
    },
    recoverySteps: primaryAction ? recoveryStepsFor({ mode, runbook, cronAudit, health }) : [],
  };
}

function modeFor({
  runbook,
  cronIssueCodes,
  health,
}: {
  runbook: DecisionOpsChainRunbook;
  cronIssueCodes: readonly DecisionOpsCronAuditIssueType[];
  health: DecisionOpsHealthSummary;
}): DecisionOpsQueueRecoveryMode {
  if (runbook.rootCause === "public_output_recent") return "observe";
  if (hasAny(cronIssueCodes, MANUAL_QUEUE_ISSUES) || hasAny(health.alerts, MANUAL_HEALTH_ALERTS)) {
    return "manual_intervention";
  }
  if (
    hasAny(cronIssueCodes, QUALITY_OR_ZERO_OUTPUT_ISSUES) ||
    hasAny(health.alerts, QUALITY_HEALTH_ALERTS) ||
    runbook.rootCause === "public_projection_stalled" ||
    runbook.rootCause === "quality_or_zero_output_stalled"
  ) {
    return "investigate_before_replay";
  }
  if (hasAny(cronIssueCodes, RETRY_QUEUE_ISSUES) || hasAny(cronIssueCodes, RUNNER_ISSUES)) {
    return "pause_new_triggers";
  }
  return "manual_intervention";
}

function statusFor({
  runbook,
  cronAudit,
  health,
  mode,
}: {
  runbook: DecisionOpsChainRunbook;
  cronAudit: DecisionOpsCronAudit;
  health: DecisionOpsHealthSummary;
  mode: DecisionOpsQueueRecoveryMode;
}): DecisionOpsQueueRecoveryStatus {
  if (mode === "observe") return "healthy";
  if (
    runbook.status === "critical" ||
    cronAudit.status === "critical" ||
    health.status === "critical"
  ) {
    return "critical";
  }
  return "degraded";
}

function shouldPauseNewTriggers({
  mode,
  cronAudit,
  health,
}: {
  mode: DecisionOpsQueueRecoveryMode;
  cronAudit: DecisionOpsCronAudit;
  health: DecisionOpsHealthSummary;
}) {
  if (mode === "manual_intervention") return true;
  if (mode !== "pause_new_triggers") return false;
  return (
    cronAudit.queue.cronJobs.overdueRetry > 0 ||
    health.queue.overdueRetry > 0 ||
    health.runs.staleRunning > 0
  );
}

function primaryActionFor(
  mode: DecisionOpsQueueRecoveryMode,
  rootCause: DecisionOpsChainRunbook["rootCause"],
) {
  if (mode === "observe") return null;
  if (mode === "manual_intervention") return "Inspect exhausted cron jobs before any replay.";
  if (mode === "pause_new_triggers")
    return "Pause new visit-trigger pressure while queue recovers.";
  if (rootCause === "public_projection_stalled") {
    return "Inspect public projection before replay.";
  }
  return "Inspect quality gate and zero-output guards before replay.";
}

function recoveryStepsFor({
  mode,
  runbook,
  cronAudit,
  health,
}: {
  mode: DecisionOpsQueueRecoveryMode;
  runbook: DecisionOpsChainRunbook;
  cronAudit: DecisionOpsCronAudit;
  health: DecisionOpsHealthSummary;
}): DecisionOpsQueueRecoveryStep[] {
  if (mode === "manual_intervention") {
    return [
      {
        title: "Inspect exhausted cron jobs before any replay",
        description:
          "Review failed cron jobs, stale leases, and provider errors. Do not replay until the failure class is known.",
        executable: false,
        evidence: evidenceFor({ runbook, cronAudit, health }),
      },
    ];
  }
  if (mode === "pause_new_triggers") {
    return [
      {
        title: "Pause new visit-trigger pressure while queue recovers",
        description:
          "Keep scheduled recovery read-only until overdue retries or stale PM runs clear.",
        executable: false,
        evidence: evidenceFor({ runbook, cronAudit, health }),
      },
    ];
  }
  return [
    {
      title:
        runbook.rootCause === "public_projection_stalled"
          ? "Inspect public projection before replay"
          : "Inspect quality gate and zero-output guards before replay",
      description:
        "Verify whether a successful run was hidden by projection, hydration, leak filtering, or zero-output guards.",
      executable: false,
      evidence: evidenceFor({ runbook, cronAudit, health }),
    },
  ];
}

function evidenceFor({
  runbook,
  cronAudit,
  health,
}: {
  runbook: DecisionOpsChainRunbook;
  cronAudit: DecisionOpsCronAudit;
  health: DecisionOpsHealthSummary;
}) {
  return [
    `rootCause:${runbook.rootCause}`,
    `publicBoardState:${runbook.publicBoardState}`,
    `cronIssues:${cronAudit.issues.map((issue) => issue.type).join(",") || "none"}`,
    `healthAlerts:${health.alerts.join(",") || "none"}`,
  ];
}

function hasAny<T extends string>(values: readonly T[], issueSet: ReadonlySet<T>) {
  return values.some((value) => issueSet.has(value));
}
