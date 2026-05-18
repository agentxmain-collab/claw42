import type { DecisionOutcome, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsLifecycleStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsLifecycleIssueType =
  | "stale_open_decision"
  | "resolution_field_mismatch"
  | "missing_evaluation_window";

export interface DecisionOpsLifecycleIssue {
  type: DecisionOpsLifecycleIssueType;
  severity: Exclude<DecisionOpsLifecycleStatus, "healthy">;
  recordId: string;
  ageMs: number | null;
  message: string;
  action: string;
}

export interface DecisionOpsLifecycleAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsLifecycleDiagnostics {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsLifecycleStatus;
  primaryIssue: DecisionOpsLifecycleIssueType | null;
  counts: {
    total: number;
    open: number;
    resolved: number;
    staleOpen: number;
    missingEvaluationWindow: number;
    inconsistentResolution: number;
  };
  outcomeCounts: Partial<Record<Exclude<DecisionOutcome, null>, number>>;
  oldestOpenAgeMs: number | null;
  latestResolvedAt: string | null;
  issues: DecisionOpsLifecycleIssue[];
  actions: DecisionOpsLifecycleAction[];
}

const ISSUE_PRIORITY: DecisionOpsLifecycleIssueType[] = [
  "resolution_field_mismatch",
  "stale_open_decision",
  "missing_evaluation_window",
];

export function buildDecisionOpsLifecycleDiagnostics({
  records,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsLifecycleDiagnostics {
  const issues = sortIssues(records.flatMap((record) => issuesForRecord(record, now)));
  const primaryIssue = primaryIssueFor(issues);
  const openRecords = records.filter((record) => !isResolved(record));
  const resolvedRecords = records.filter(isResolved);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFor(issues),
    primaryIssue,
    counts: {
      total: records.length,
      open: openRecords.length,
      resolved: resolvedRecords.length,
      staleOpen: issues.filter((issue) => issue.type === "stale_open_decision").length,
      missingEvaluationWindow: issues.filter((issue) => issue.type === "missing_evaluation_window")
        .length,
      inconsistentResolution: issues.filter((issue) => issue.type === "resolution_field_mismatch")
        .length,
    },
    outcomeCounts: outcomeCountsFor(resolvedRecords),
    oldestOpenAgeMs: oldestOpenAgeMs(openRecords, now),
    latestResolvedAt: latestResolvedAt(resolvedRecords),
    issues,
    actions: actionsFor(primaryIssue),
  };
}

function issuesForRecord(record: StrategyDecisionRecord, now: number): DecisionOpsLifecycleIssue[] {
  const issues: DecisionOpsLifecycleIssue[] = [];
  const hasResolvedAt = Boolean(record.resolvedAt);
  const hasResolvedOutcome = Boolean(record.resolvedOutcome);
  const isOpen = !hasResolvedAt && !hasResolvedOutcome;

  if (hasResolvedAt !== hasResolvedOutcome) {
    issues.push({
      type: "resolution_field_mismatch",
      severity: "critical",
      recordId: record.id,
      ageMs: ageMs(record.createdAt, now),
      message:
        "Decision resolution fields disagree: resolvedAt and resolvedOutcome must move together.",
      action: "Inspect resolution writer and backfill before trusting lifecycle aggregates.",
    });
  }

  if (isOpen && record.tradeDecision && !record.evaluationWindowEndsAt) {
    issues.push({
      type: "missing_evaluation_window",
      severity: "degraded",
      recordId: record.id,
      ageMs: ageMs(record.createdAt, now),
      message: "Open trade decision is missing an evaluation window.",
      action: "Inspect PM trade card writer before relying on track-record timing.",
    });
  }

  if (isOpen && isPast(record.evaluationWindowEndsAt, now)) {
    issues.push({
      type: "stale_open_decision",
      severity: "critical",
      recordId: record.id,
      ageMs: ageMs(record.evaluationWindowEndsAt, now),
      message: "Decision evaluation window elapsed without a resolution.",
      action: "Inspect resolution writer before adding more lifecycle UI.",
    });
  }

  return issues;
}

function statusFor(issues: readonly DecisionOpsLifecycleIssue[]): DecisionOpsLifecycleStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function primaryIssueFor(
  issues: readonly DecisionOpsLifecycleIssue[],
): DecisionOpsLifecycleIssueType | null {
  return ISSUE_PRIORITY.find((type) => issues.some((issue) => issue.type === type)) ?? null;
}

function outcomeCountsFor(records: readonly StrategyDecisionRecord[]) {
  const counts: Partial<Record<Exclude<DecisionOutcome, null>, number>> = {};
  for (const record of records) {
    if (!record.resolvedOutcome) continue;
    counts[record.resolvedOutcome] = (counts[record.resolvedOutcome] ?? 0) + 1;
  }
  return counts;
}

function oldestOpenAgeMs(records: readonly StrategyDecisionRecord[], now: number) {
  const ages = records
    .map((record) => ageMs(record.createdAt, now))
    .filter((age): age is number => age !== null)
    .sort((left, right) => right - left);
  return ages[0] ?? null;
}

function latestResolvedAt(records: readonly StrategyDecisionRecord[]) {
  const latest = records
    .map((record) => Date.parse(record.resolvedAt ?? ""))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return typeof latest === "number" ? new Date(latest).toISOString() : null;
}

function actionsFor(
  primaryIssue: DecisionOpsLifecycleIssueType | null,
): DecisionOpsLifecycleAction[] {
  if (!primaryIssue) return [];
  if (primaryIssue === "resolution_field_mismatch") {
    return [
      {
        title: "Inspect resolution field integrity before publishing lifecycle metrics",
        description:
          "Find records where resolvedAt and resolvedOutcome diverge before aggregating win/loss state.",
        executable: false,
      },
    ];
  }
  if (primaryIssue === "stale_open_decision") {
    return [
      {
        title: "Inspect resolution writer before adding more lifecycle UI",
        description:
          "Resolution appears overdue. Check cron resolution and market data before exposing new track-record views.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Inspect trade card evaluation windows",
      description:
        "Open trade cards without evaluation windows cannot be closed reliably by lifecycle diagnostics.",
      executable: false,
    },
  ];
}

function sortIssues(issues: readonly DecisionOpsLifecycleIssue[]) {
  return [...issues].sort(
    (left, right) =>
      ISSUE_PRIORITY.indexOf(left.type) - ISSUE_PRIORITY.indexOf(right.type) ||
      left.recordId.localeCompare(right.recordId),
  );
}

function isResolved(record: StrategyDecisionRecord) {
  return Boolean(record.resolvedAt && record.resolvedOutcome);
}

function isPast(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp <= now;
}

function ageMs(value: string | null, now: number) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, now - timestamp);
}
