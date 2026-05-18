import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export type DecisionOpsFreshnessStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsFreshnessAlert =
  | "no_recent_cron_job"
  | "cron_job_stale"
  | "no_recent_successful_run"
  | "successful_run_stale"
  | "no_recent_public_pm_event"
  | "public_pm_event_stale";

export interface DecisionOpsFreshnessAlertDetail {
  alert: DecisionOpsFreshnessAlert;
  severity: Exclude<DecisionOpsFreshnessStatus, "healthy">;
  ageMs: number | null;
  thresholdMs: number;
  action: string;
}

export interface DecisionOpsFreshnessReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsFreshnessStatus;
  signals: {
    latestCronJobAt: string | null;
    latestCronJobAgeMs: number | null;
    latestSucceededRunAt: string | null;
    latestSucceededRunAgeMs: number | null;
    latestPublicPmEventAt: string | null;
    latestPublicPmEventAgeMs: number | null;
  };
  thresholds: {
    degradedAfterMs: number;
    criticalAfterMs: number;
  };
  alerts: DecisionOpsFreshnessAlert[];
  alertDetails: DecisionOpsFreshnessAlertDetail[];
}

const DEGRADED_AFTER_MS = 4 * 60 * 60_000;
const CRITICAL_AFTER_MS = 8 * 60 * 60_000;

export function buildDecisionOpsFreshness({
  jobs,
  runs,
  publicEvents,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsFreshnessReport {
  const latestCronJobAt = latestIso(
    jobs.filter((job) => job.triggerSource === "cron").map((job) => job.createdAt),
  );
  const latestSucceededRunAt = latestIso(
    runs.filter((run) => run.status === "succeeded").map((run) => run.completedAt ?? run.startedAt),
  );
  const latestPublicPmEventAt = latestIso(
    publicEvents
      .filter((event) => event.payload.kind === "pm_decision")
      .map((event) => new Date(event.ts).toISOString()),
  );
  const alertDetails = [
    freshnessAlert({
      missingAlert: "no_recent_cron_job",
      staleAlert: "cron_job_stale",
      value: latestCronJobAt,
      now,
      action: "Verify Vercel cron delivery and strategy-replay job creation.",
    }),
    freshnessAlert({
      missingAlert: "no_recent_successful_run",
      staleAlert: "successful_run_stale",
      value: latestSucceededRunAt,
      now,
      action:
        "Inspect queue consumer, provider errors, and quality gate blocks before widening cadence.",
    }),
    freshnessAlert({
      missingAlert: "no_recent_public_pm_event",
      staleAlert: "public_pm_event_stale",
      value: latestPublicPmEventAt,
      now,
      action: "Inspect public projection/backfill before changing PM execution.",
    }),
  ].filter((detail): detail is DecisionOpsFreshnessAlertDetail => Boolean(detail));

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromAlerts(alertDetails),
    signals: {
      latestCronJobAt,
      latestCronJobAgeMs: ageMs(latestCronJobAt, now),
      latestSucceededRunAt,
      latestSucceededRunAgeMs: ageMs(latestSucceededRunAt, now),
      latestPublicPmEventAt,
      latestPublicPmEventAgeMs: ageMs(latestPublicPmEventAt, now),
    },
    thresholds: {
      degradedAfterMs: DEGRADED_AFTER_MS,
      criticalAfterMs: CRITICAL_AFTER_MS,
    },
    alerts: alertDetails.map((detail) => detail.alert),
    alertDetails,
  };
}

function freshnessAlert({
  missingAlert,
  staleAlert,
  value,
  now,
  action,
}: {
  missingAlert: DecisionOpsFreshnessAlert;
  staleAlert: DecisionOpsFreshnessAlert;
  value: string | null;
  now: number;
  action: string;
}): DecisionOpsFreshnessAlertDetail | null {
  const age = ageMs(value, now);
  if (age === null) {
    return {
      alert: missingAlert,
      severity: "critical",
      ageMs: null,
      thresholdMs: CRITICAL_AFTER_MS,
      action,
    };
  }
  if (age >= CRITICAL_AFTER_MS) {
    return {
      alert: staleAlert,
      severity: "critical",
      ageMs: age,
      thresholdMs: CRITICAL_AFTER_MS,
      action,
    };
  }
  if (age >= DEGRADED_AFTER_MS) {
    return {
      alert: staleAlert,
      severity: "degraded",
      ageMs: age,
      thresholdMs: DEGRADED_AFTER_MS,
      action,
    };
  }
  return null;
}

function latestIso(values: readonly string[]) {
  const latest = values
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return typeof latest === "number" ? new Date(latest).toISOString() : null;
}

function ageMs(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}

function statusFromAlerts(alertDetails: readonly DecisionOpsFreshnessAlertDetail[]) {
  if (alertDetails.some((detail) => detail.severity === "critical")) return "critical";
  if (alertDetails.length > 0) return "degraded";
  return "healthy";
}
