import type { DecisionRunRecord, DecisionRunStatus } from "@/lib/team/decisionRunLedger";
import type { PmDecisionJobRecord, PmDecisionJobStatus } from "@/lib/watch/pmDecisionJobLedger";

export type DecisionOpsHealthAlert =
  | "queue_overdue_retry"
  | "queue_stale_running"
  | "queue_failed"
  | "run_failed"
  | "quality_blocking";

export interface DecisionOpsHealthSummary {
  schemaVersion: 1;
  generatedAt: string;
  queue: {
    total: number;
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    retryBacklog: number;
    overdueRetry: number;
    staleRunning: number;
    oldestQueuedAgeMs: number | null;
    oldestRunningAgeMs: number | null;
  };
  runs: {
    total: number;
    running: number;
    succeeded: number;
    skipped: number;
    failed: number;
    qualityBlocked: number;
    p95DurationMs: number | null;
    latestStartedAt: string | null;
  };
  quality: {
    blockedPublications: number;
    warningCounts: Record<string, number>;
  };
  alerts: DecisionOpsHealthAlert[];
}

const QUEUE_RUNNING_STALE_MS = 30 * 60_000;

export function summarizeDecisionOpsHealth({
  jobs,
  runs,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  now?: number;
}): DecisionOpsHealthSummary {
  const queueCounts = countByStatus<PmDecisionJobStatus>(jobs, [
    "queued",
    "running",
    "succeeded",
    "failed",
  ]);
  const runCounts = countByStatus<DecisionRunStatus>(runs, [
    "running",
    "succeeded",
    "skipped",
    "failed",
  ]);
  const retryBacklog = jobs.filter((job) => job.status === "failed" && job.nextRunAt).length;
  const overdueRetry = jobs.filter((job) => {
    if (job.status !== "queued" && job.status !== "failed") return false;
    return isPastOrNow(job.nextRunAt, now);
  }).length;
  const staleRunning = jobs.filter((job) => {
    if (job.status !== "running") return false;
    const startedAtMs = Date.parse(job.startedAt ?? "");
    return Number.isFinite(startedAtMs) && now - startedAtMs >= QUEUE_RUNNING_STALE_MS;
  }).length;
  const qualityBlocked = runs.filter((run) => run.skipReason === "public_quality_gate_failed");
  const warningCounts = warningCountsFor(runs);
  const alerts = Array.from(
    new Set<DecisionOpsHealthAlert>(
      [
        overdueRetry > 0 ? "queue_overdue_retry" : null,
        staleRunning > 0 ? "queue_stale_running" : null,
        queueCounts.failed > 0 ? "queue_failed" : null,
        runCounts.failed > 0 ? "run_failed" : null,
        qualityBlocked.length > 0 ? "quality_blocking" : null,
      ].filter((alert): alert is DecisionOpsHealthAlert => Boolean(alert)),
    ),
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    queue: {
      total: jobs.length,
      queued: queueCounts.queued,
      running: queueCounts.running,
      succeeded: queueCounts.succeeded,
      failed: queueCounts.failed,
      retryBacklog,
      overdueRetry,
      staleRunning,
      oldestQueuedAgeMs: oldestJobAgeMs(
        jobs.filter((job) => job.status === "queued"),
        "createdAt",
        now,
      ),
      oldestRunningAgeMs: oldestJobAgeMs(
        jobs.filter((job) => job.status === "running"),
        "startedAt",
        now,
      ),
    },
    runs: {
      total: runs.length,
      running: runCounts.running,
      succeeded: runCounts.succeeded,
      skipped: runCounts.skipped,
      failed: runCounts.failed,
      qualityBlocked: qualityBlocked.length,
      p95DurationMs: percentile(durationMsForRuns(runs), 0.95),
      latestStartedAt: latestStartedAt(runs),
    },
    quality: {
      blockedPublications: qualityBlocked.length,
      warningCounts,
    },
    alerts,
  };
}

function countByStatus<TStatus extends string>(
  items: readonly { status: TStatus }[],
  statuses: readonly TStatus[],
): Record<TStatus, number> {
  return Object.fromEntries(
    statuses.map((status) => [status, items.filter((item) => item.status === status).length]),
  ) as Record<TStatus, number>;
}

function isPastOrNow(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp <= now;
}

function oldestJobAgeMs(
  items: readonly PmDecisionJobRecord[],
  field: "createdAt" | "startedAt",
  now: number,
) {
  const ages = items
    .map((item) => Date.parse(item[field] ?? ""))
    .filter(Number.isFinite)
    .map((timestamp) => Math.max(0, now - timestamp));
  return ages.length ? Math.max(...ages) : null;
}

function durationMsForRuns(runs: readonly DecisionRunRecord[]) {
  return runs
    .map((run) => {
      const startedAt = Date.parse(run.startedAt);
      const completedAt = Date.parse(run.completedAt ?? "");
      if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) return null;
      return Math.max(0, completedAt - startedAt);
    })
    .filter((value): value is number => typeof value === "number");
}

function percentile(values: readonly number[], ratio: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? null;
}

function latestStartedAt(runs: readonly DecisionRunRecord[]) {
  const latest = runs
    .map((run) => Date.parse(run.startedAt))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return typeof latest === "number" ? new Date(latest).toISOString() : null;
}

function warningCountsFor(runs: readonly DecisionRunRecord[]) {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    for (const warning of run.quality?.warnings ?? []) {
      counts[warning] = (counts[warning] ?? 0) + 1;
    }
  }
  return counts;
}
