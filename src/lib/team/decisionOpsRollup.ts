import type { DecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import type { DecisionOpsFreshnessReport } from "@/lib/team/decisionOpsFreshness";
import type { DecisionOpsHealthSummary } from "@/lib/team/decisionOpsHealth";
import type { DecisionOpsReconciliationReport } from "@/lib/team/decisionOpsReconciliation";

export type DecisionOpsRollupStatus = "healthy" | "degraded" | "critical";
export type DecisionOpsRollupSource = "freshness" | "health" | "reconciliation" | "deepDiagnostics";

export interface DecisionOpsRollupIssue {
  source: DecisionOpsRollupSource;
  severity: Exclude<DecisionOpsRollupStatus, "healthy">;
  code: string;
  title: string;
  message: string;
  action: string;
  count: number;
  runId?: string;
  jobId?: string;
  recordId?: string;
  candidateKey?: string;
}

export interface DecisionOpsRollupRunbookAction {
  source: DecisionOpsRollupSource;
  severity: Exclude<DecisionOpsRollupStatus, "healthy">;
  title: string;
  action: string;
  reason: string;
  executable: false;
}

export interface DecisionOpsRollupReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsRollupStatus;
  counts: {
    criticalIssues: number;
    degradedIssues: number;
    totalIssues: number;
    runbookActions: number;
  };
  sourceStatuses: Record<DecisionOpsRollupSource, DecisionOpsRollupStatus>;
  topIssues: DecisionOpsRollupIssue[];
  runbookActions: DecisionOpsRollupRunbookAction[];
}

export function buildDecisionOpsRollup({
  health,
  reconciliation,
  freshness,
  deepDiagnostics,
  now = Date.now(),
}: {
  health: DecisionOpsHealthSummary;
  reconciliation: DecisionOpsReconciliationReport;
  freshness: DecisionOpsFreshnessReport;
  deepDiagnostics: DecisionOpsDeepDiagnostics;
  now?: number;
}): DecisionOpsRollupReport {
  const issues = sortIssues([
    ...healthIssues(health),
    ...reconciliationIssues(reconciliation),
    ...freshnessIssues(freshness),
    ...deepDiagnosticIssues(deepDiagnostics),
  ]);
  const runbookActions = uniqueSourceRunbookActions(issues, 3);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromIssues(issues),
    counts: {
      criticalIssues: issues.filter((issue) => issue.severity === "critical").length,
      degradedIssues: issues.filter((issue) => issue.severity === "degraded").length,
      totalIssues: issues.length,
      runbookActions: runbookActions.length,
    },
    sourceStatuses: {
      freshness: freshness.status,
      health: health.status,
      reconciliation: reconciliation.status,
      deepDiagnostics: statusFromDeepDiagnostics(deepDiagnostics),
    },
    topIssues: issues.slice(0, 3),
    runbookActions,
  };
}

function healthIssues(health: DecisionOpsHealthSummary): DecisionOpsRollupIssue[] {
  return health.alertDetails.map((detail) => ({
    source: "health",
    severity: detail.severity,
    code: detail.alert,
    title: humanize(detail.alert),
    message: `${detail.count} health alert(s) reported by PM job/run diagnostics.`,
    action: detail.action,
    count: detail.count,
  }));
}

function reconciliationIssues(
  reconciliation: DecisionOpsReconciliationReport,
): DecisionOpsRollupIssue[] {
  return reconciliation.issues.map((issue) => ({
    source: "reconciliation",
    severity: issue.severity,
    code: issue.type,
    title: humanize(issue.type),
    message: issue.message,
    action: issue.repairProposal.reason,
    count: 1,
    runId: issue.runId,
    jobId: issue.jobId,
    recordId: issue.recordId,
    candidateKey: issue.candidateKey,
  }));
}

function freshnessIssues(freshness: DecisionOpsFreshnessReport): DecisionOpsRollupIssue[] {
  return freshness.alertDetails.map((detail) => ({
    source: "freshness",
    severity: detail.severity,
    code: detail.alert,
    title: humanize(detail.alert),
    message:
      detail.ageMs === null
        ? "No recent PM freshness signal exists."
        : `Freshness signal age is ${Math.round(detail.ageMs / 60_000)} minutes.`,
    action: detail.action,
    count: 1,
  }));
}

function deepDiagnosticIssues(
  deepDiagnostics: DecisionOpsDeepDiagnostics,
): DecisionOpsRollupIssue[] {
  const issues: DecisionOpsRollupIssue[] = [];
  if (deepDiagnostics.quality.blockedRuns > 0) {
    issues.push({
      source: "deepDiagnostics",
      severity: "degraded",
      code: "quality_blocked_runs",
      title: "Quality blocked runs",
      message: `${deepDiagnostics.quality.blockedRuns} run(s) were blocked by quality diagnostics.`,
      action: "Inspect quality gate warnings before replay or prompt changes.",
      count: deepDiagnostics.quality.blockedRuns,
    });
  }
  if (deepDiagnostics.quality.lowEvidenceRuns > 0) {
    issues.push({
      source: "deepDiagnostics",
      severity: "degraded",
      code: "low_evidence_runs",
      title: "Low evidence runs",
      message: `${deepDiagnostics.quality.lowEvidenceRuns} run(s) used thin evidence.`,
      action: "Inspect evidence fetch and role-specific evidence routing.",
      count: deepDiagnostics.quality.lowEvidenceRuns,
    });
  }
  if (deepDiagnostics.quality.leakRuns > 0) {
    issues.push({
      source: "deepDiagnostics",
      severity: "critical",
      code: "public_content_leak",
      title: "Public content leak risk",
      message: `${deepDiagnostics.quality.leakRuns} run(s) reported public leak warnings.`,
      action: "Block publication and inspect public payload filters.",
      count: deepDiagnostics.quality.leakRuns,
    });
  }
  if (deepDiagnostics.provider.telemetry?.singleProviderConcentration.alert) {
    const concentration = deepDiagnostics.provider.telemetry.singleProviderConcentration;
    issues.push({
      source: "deepDiagnostics",
      severity: "degraded",
      code: "single_provider_concentration",
      title: "Single provider concentration",
      message: `${concentration.provider ?? "unknown"} handled ${Math.round(
        concentration.ratio * 100,
      )}% of recent calls.`,
      action: "Inspect provider routing and fallback before changing model mix.",
      count: concentration.count,
    });
  }
  if (deepDiagnostics.regression.status === "regressed") {
    issues.push({
      source: "deepDiagnostics",
      severity: "degraded",
      code: "quality_regression",
      title: "Quality regression",
      message: `Recent quality score delta is ${deepDiagnostics.regression.delta}.`,
      action: "Compare recent and previous decision runs before prompt changes.",
      count: 1,
    });
  }
  return issues;
}

function uniqueSourceRunbookActions(
  issues: readonly DecisionOpsRollupIssue[],
  limit: number,
): DecisionOpsRollupRunbookAction[] {
  const seen = new Set<DecisionOpsRollupSource>();
  const actions: DecisionOpsRollupRunbookAction[] = [];
  for (const issue of issues) {
    if (seen.has(issue.source)) continue;
    seen.add(issue.source);
    actions.push({
      source: issue.source,
      severity: issue.severity,
      title: issue.title,
      action: issue.action,
      reason: issue.message,
      executable: false,
    });
    if (actions.length >= limit) break;
  }
  return actions;
}

function sortIssues(issues: readonly DecisionOpsRollupIssue[]) {
  return [...issues].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      sourceRank(a.source) - sourceRank(b.source) ||
      b.count - a.count ||
      a.code.localeCompare(b.code) ||
      (a.recordId ?? a.runId ?? a.jobId ?? "").localeCompare(
        b.recordId ?? b.runId ?? b.jobId ?? "",
      ),
  );
}

function statusFromIssues(issues: readonly DecisionOpsRollupIssue[]): DecisionOpsRollupStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function statusFromDeepDiagnostics(
  deepDiagnostics: DecisionOpsDeepDiagnostics,
): DecisionOpsRollupStatus {
  if (deepDiagnostics.quality.leakRuns > 0) return "critical";
  if (
    deepDiagnostics.quality.blockedRuns > 0 ||
    deepDiagnostics.quality.lowEvidenceRuns > 0 ||
    deepDiagnostics.provider.telemetry?.singleProviderConcentration.alert ||
    deepDiagnostics.regression.status === "regressed"
  ) {
    return "degraded";
  }
  return "healthy";
}

function severityRank(severity: Exclude<DecisionOpsRollupStatus, "healthy">) {
  return severity === "critical" ? 0 : 1;
}

function sourceRank(source: DecisionOpsRollupSource) {
  return {
    freshness: 0,
    health: 1,
    reconciliation: 2,
    deepDiagnostics: 3,
  }[source];
}

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
