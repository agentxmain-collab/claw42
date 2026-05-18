import type {
  DecisionOpsCronAudit,
  DecisionOpsCronAuditIssueType,
} from "@/lib/team/decisionOpsCronAudit";
import type {
  DecisionOpsFreshnessAlert,
  DecisionOpsFreshnessReport,
} from "@/lib/team/decisionOpsFreshness";
import type {
  DecisionOpsHealthAlert,
  DecisionOpsHealthSummary,
} from "@/lib/team/decisionOpsHealth";

export type DecisionOpsChainStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsChainRootCause =
  | "public_output_recent"
  | "cron_delivery_stalled"
  | "job_queue_stalled"
  | "pm_runner_stalled"
  | "public_projection_stalled"
  | "quality_or_zero_output_stalled"
  | "unknown_stalled";

export type DecisionOpsPublicBoardState =
  | "has_recent_public_output"
  | "public_output_stale"
  | "no_public_output";

export type DecisionOpsChainLinkId =
  | "cron_delivery"
  | "job_ledger"
  | "pm_runner"
  | "public_timeline";

export type DecisionOpsChainLinkStatus = "ready" | "degraded" | "blocked" | "unknown";

export interface DecisionOpsChainLink {
  link: DecisionOpsChainLinkId;
  status: DecisionOpsChainLinkStatus;
  signal: string;
  issueCodes: string[];
  action: string;
}

export interface DecisionOpsRunbookAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsChainRunbook {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsChainStatus;
  rootCause: DecisionOpsChainRootCause;
  publicBoardState: DecisionOpsPublicBoardState;
  summary: string;
  evidence: {
    latestCronJobAt: string | null;
    latestSuccessfulRunAt: string | null;
    latestPublicPmEventAt: string | null;
    cronIssueCodes: DecisionOpsCronAuditIssueType[];
    freshnessAlerts: DecisionOpsFreshnessAlert[];
    healthAlerts: DecisionOpsHealthAlert[];
  };
  chain: DecisionOpsChainLink[];
  runbookActions: DecisionOpsRunbookAction[];
}

const CRON_DELIVERY_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "no_cron_job",
  "cron_job_stale",
]);

const JOB_LEDGER_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_job_retry_overdue",
  "cron_job_retry_exhausted",
  "cron_job_stale_running",
]);

const PM_RUNNER_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "no_cron_run",
  "cron_run_failed",
  "cron_run_stale_running",
]);

const PUBLIC_PROJECTION_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_run_missing_public_output",
]);

const QUALITY_OR_ZERO_OUTPUT_ISSUES = new Set<DecisionOpsCronAuditIssueType>([
  "cron_job_zero_output",
]);

const PUBLIC_FRESHNESS_ALERTS = new Set<DecisionOpsFreshnessAlert>([
  "no_recent_public_pm_event",
  "public_pm_event_stale",
]);

const QUALITY_HEALTH_ALERTS = new Set<DecisionOpsHealthAlert>([
  "job_zero_output",
  "quality_blocking",
]);

export function buildDecisionOpsChainRunbook({
  cronAudit,
  freshness,
  health,
  now = Date.now(),
}: {
  cronAudit: DecisionOpsCronAudit;
  freshness: DecisionOpsFreshnessReport;
  health: DecisionOpsHealthSummary;
  now?: number;
}): DecisionOpsChainRunbook {
  const cronIssueCodes = cronAudit.issues.map((issue) => issue.type);
  const rootCause = rootCauseFor({ cronIssueCodes, freshness, health });
  const publicBoardState = publicBoardStateFor(freshness);
  const status = statusFor({ rootCause, cronAudit, freshness, health });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    rootCause,
    publicBoardState,
    summary: summaryFor(rootCause),
    evidence: {
      latestCronJobAt: freshness.signals.latestCronJobAt,
      latestSuccessfulRunAt: freshness.signals.latestSucceededRunAt,
      latestPublicPmEventAt: freshness.signals.latestPublicPmEventAt,
      cronIssueCodes,
      freshnessAlerts: freshness.alerts,
      healthAlerts: health.alerts,
    },
    chain: chainFor({ cronIssueCodes, freshness, health }),
    runbookActions: runbookActionsFor(rootCause),
  };
}

function rootCauseFor({
  cronIssueCodes,
  freshness,
  health,
}: {
  cronIssueCodes: readonly DecisionOpsCronAuditIssueType[];
  freshness: DecisionOpsFreshnessReport;
  health: DecisionOpsHealthSummary;
}): DecisionOpsChainRootCause {
  if (hasAny(cronIssueCodes, CRON_DELIVERY_ISSUES)) return "cron_delivery_stalled";
  if (hasAny(cronIssueCodes, JOB_LEDGER_ISSUES)) return "job_queue_stalled";
  if (hasAny(cronIssueCodes, PM_RUNNER_ISSUES)) return "pm_runner_stalled";
  if (hasAny(cronIssueCodes, PUBLIC_PROJECTION_ISSUES)) return "public_projection_stalled";
  if (
    hasAny(cronIssueCodes, QUALITY_OR_ZERO_OUTPUT_ISSUES) ||
    hasAny(health.alerts, QUALITY_HEALTH_ALERTS)
  ) {
    return "quality_or_zero_output_stalled";
  }
  if (hasAny(freshness.alerts, PUBLIC_FRESHNESS_ALERTS)) return "public_projection_stalled";
  if (freshness.signals.latestPublicPmEventAt) return "public_output_recent";
  return "unknown_stalled";
}

function publicBoardStateFor(freshness: DecisionOpsFreshnessReport): DecisionOpsPublicBoardState {
  if (!freshness.signals.latestPublicPmEventAt) return "no_public_output";
  if (freshness.alerts.includes("public_pm_event_stale")) return "public_output_stale";
  return "has_recent_public_output";
}

function statusFor({
  rootCause,
  cronAudit,
  freshness,
  health,
}: {
  rootCause: DecisionOpsChainRootCause;
  cronAudit: DecisionOpsCronAudit;
  freshness: DecisionOpsFreshnessReport;
  health: DecisionOpsHealthSummary;
}): DecisionOpsChainStatus {
  if (rootCause === "public_output_recent") return "healthy";
  if (
    cronAudit.status === "critical" ||
    freshness.status === "critical" ||
    health.status === "critical"
  ) {
    return "critical";
  }
  return "degraded";
}

function chainFor({
  cronIssueCodes,
  freshness,
  health,
}: {
  cronIssueCodes: readonly DecisionOpsCronAuditIssueType[];
  freshness: DecisionOpsFreshnessReport;
  health: DecisionOpsHealthSummary;
}): DecisionOpsChainLink[] {
  return [
    chainLink({
      link: "cron_delivery",
      issues: matchingIssues(cronIssueCodes, CRON_DELIVERY_ISSUES),
      fallbackBlocked: freshness.alerts.includes("no_recent_cron_job"),
      signal: freshness.signals.latestCronJobAt
        ? `Latest cron job at ${freshness.signals.latestCronJobAt}.`
        : "No cron job has reached the PM job ledger.",
      action: "Verify Vercel cron delivery and strategy-replay authorization.",
    }),
    chainLink({
      link: "job_ledger",
      issues: matchingIssues(cronIssueCodes, JOB_LEDGER_ISSUES),
      signal:
        health.queue.total > 0
          ? `PM job ledger has ${health.queue.total} recent jobs.`
          : "PM job ledger has no recent jobs.",
      action: "Inspect queue readiness, retries, and stale running leases before replay.",
    }),
    chainLink({
      link: "pm_runner",
      issues: matchingIssues(cronIssueCodes, PM_RUNNER_ISSUES),
      fallbackBlocked: freshness.alerts.includes("no_recent_successful_run"),
      signal: freshness.signals.latestSucceededRunAt
        ? `Latest successful PM run at ${freshness.signals.latestSucceededRunAt}.`
        : "No successful PM run is available.",
      action: "Inspect PM runner errors, provider logs, and quality gate state.",
    }),
    chainLink({
      link: "public_timeline",
      issues: [
        ...matchingIssues(cronIssueCodes, PUBLIC_PROJECTION_ISSUES),
        ...matchingIssues(cronIssueCodes, QUALITY_OR_ZERO_OUTPUT_ISSUES),
        ...matchingIssues(health.alerts, QUALITY_HEALTH_ALERTS),
        ...matchingIssues(freshness.alerts, PUBLIC_FRESHNESS_ALERTS),
      ],
      signal: freshness.signals.latestPublicPmEventAt
        ? `Latest public PM event at ${freshness.signals.latestPublicPmEventAt}.`
        : "No public PM event is available for the watch board.",
      action: "Inspect public projection, hydration, and quality filtering before replay.",
    }),
  ];
}

function chainLink({
  link,
  issues,
  fallbackBlocked = false,
  signal,
  action,
}: {
  link: DecisionOpsChainLinkId;
  issues: readonly string[];
  fallbackBlocked?: boolean;
  signal: string;
  action: string;
}): DecisionOpsChainLink {
  return {
    link,
    status: issues.length > 0 || fallbackBlocked ? "blocked" : "ready",
    signal,
    issueCodes: unique(issues),
    action,
  };
}

function summaryFor(rootCause: DecisionOpsChainRootCause) {
  switch (rootCause) {
    case "public_output_recent":
      return "Cron, PM run, and public timeline output are fresh.";
    case "cron_delivery_stalled":
      return "The public board is empty because scheduled cron delivery has not reached the PM job ledger.";
    case "job_queue_stalled":
      return "The public board is behind because scheduled PM jobs are stuck in the job ledger.";
    case "pm_runner_stalled":
      return "The public board is behind because scheduled jobs are not producing successful PM runs.";
    case "public_projection_stalled":
      return "A PM run exists, but the public timeline does not have a fresh card.";
    case "quality_or_zero_output_stalled":
      return "The PM runner completed, but quality or zero-output guards prevented a public card.";
    case "unknown_stalled":
      return "The schedule-to-public chain has no clear fresh public output; inspect the linked evidence.";
  }
}

function runbookActionsFor(rootCause: DecisionOpsChainRootCause): DecisionOpsRunbookAction[] {
  switch (rootCause) {
    case "public_output_recent":
      return [];
    case "cron_delivery_stalled":
      return [
        {
          title: "Verify Vercel cron delivery",
          description:
            "Confirm /api/cron/strategy-replay is being invoked before changing PM prompts or candidate ranking.",
          executable: false,
        },
      ];
    case "job_queue_stalled":
      return [
        {
          title: "Inspect PM job ledger",
          description:
            "Check retry backlog, stale running jobs, and queue readiness before manual intervention.",
          executable: false,
        },
      ];
    case "pm_runner_stalled":
      return [
        {
          title: "Inspect PM runner execution",
          description:
            "Review latest run errors, provider telemetry, and quality blocks before replaying jobs.",
          executable: false,
        },
      ];
    case "public_projection_stalled":
      return [
        {
          title: "Inspect public projection before replay",
          description:
            "Check decision record projection and hydration before triggering another PM run.",
          executable: false,
        },
      ];
    case "quality_or_zero_output_stalled":
      return [
        {
          title: "Inspect quality gate and zero-output guard",
          description:
            "Find whether the run was blocked by content quality, leak filters, or empty output.",
          executable: false,
        },
      ];
    case "unknown_stalled":
      return [
        {
          title: "Inspect schedule-to-public evidence",
          description:
            "Compare cron audit, freshness, and health diagnostics to locate the first missing link.",
          executable: false,
        },
      ];
  }
}

function matchingIssues<T extends string>(values: readonly T[], issueSet: ReadonlySet<T>) {
  return values.filter((value) => issueSet.has(value));
}

function hasAny<T extends string>(values: readonly T[], issueSet: ReadonlySet<T>) {
  return values.some((value) => issueSet.has(value));
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values));
}
