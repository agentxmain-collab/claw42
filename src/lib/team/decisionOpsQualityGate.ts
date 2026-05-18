import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { DecisionQualityWarning } from "@/lib/team/decisionQuality";
import type { ProviderTelemetrySummary } from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";

export type DecisionOpsQualityGateStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsQualityGateIssueType =
  | "public_content_leak"
  | "duplicate_rationale"
  | "low_evidence"
  | "low_role_coverage"
  | "provider_concentration"
  | "provider_fallback_rate_high"
  | "provider_failure_rate_high"
  | "candidate_type_low_publishable_rate";

export interface DecisionOpsQualityGateIssue {
  type: DecisionOpsQualityGateIssueType;
  severity: Exclude<DecisionOpsQualityGateStatus, "healthy">;
  targetId: string;
  candidateType?: CandidateType;
  provider?: string;
  observedValue: number;
  threshold: number;
  message: string;
  action: string;
}

export interface DecisionOpsQualityGateBucket {
  totalRuns: number;
  scoredRuns: number;
  publishableRuns: number;
  blockedRuns: number;
  averageScore: number | null;
  publishableRate: number | null;
  warningCounts: Partial<Record<DecisionQualityWarning, number>>;
  lowEvidenceRuns: number;
  lowRoleCoverageRuns: number;
  leakRuns: number;
  duplicateRationaleRuns: number;
}

export interface DecisionOpsQualityGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsQualityGateStatus;
  thresholds: {
    lowEvidenceCitationsBelow: number;
    lowRoleCoverageBelow: number;
    maxProviderFallbackRate: number;
    maxProviderFailureRate: number;
    minCandidateTypePublishableRate: number;
  };
  publicRisk: DecisionOpsQualityGateBucket;
  byCandidateType: Record<CandidateType, DecisionOpsQualityGateBucket>;
  byProvider: Record<string, DecisionOpsQualityGateBucket>;
  providerTelemetry: {
    totalCalls: number;
    fallbackRate: number | null;
    failureRate: number | null;
    concentration: ProviderTelemetrySummary["singleProviderConcentration"];
  } | null;
  issues: DecisionOpsQualityGateIssue[];
}

const LOW_EVIDENCE_CITATIONS_BELOW = 2;
const LOW_ROLE_COVERAGE_BELOW = 6;
const MAX_PROVIDER_FALLBACK_RATE = 0.25;
const MAX_PROVIDER_FAILURE_RATE = 0.05;
const MIN_CANDIDATE_TYPE_PUBLISHABLE_RATE = 0.5;

const CANDIDATE_TYPES: CandidateType[] = ["symbol", "market_overview", "hotspot"];
const UNKNOWN_PROVIDER = "unknown";

export function buildDecisionOpsQualityGate({
  runs,
  records,
  providerTelemetry = null,
  now = Date.now(),
}: {
  runs: readonly DecisionRunRecord[];
  records: readonly StrategyDecisionRecord[];
  providerTelemetry?: ProviderTelemetrySummary | null;
  now?: number;
}): DecisionOpsQualityGateReport {
  const recordProviderById = new Map(records.map((record) => [record.id, record.modelProvider]));
  const publicRisk = bucketFromRuns(runs);
  const byCandidateType = Object.fromEntries(
    CANDIDATE_TYPES.map((candidateType) => [
      candidateType,
      bucketFromRuns(runs.filter((run) => candidateTypeForRun(run) === candidateType)),
    ]),
  ) as Record<CandidateType, DecisionOpsQualityGateBucket>;
  const byProvider = buildProviderBuckets(runs, recordProviderById);
  const normalizedTelemetry = normalizeProviderTelemetry(providerTelemetry);
  const issues = sortIssues([
    ...publicRiskIssues(publicRisk),
    ...candidateTypeIssues(byCandidateType),
    ...providerTelemetryIssues(normalizedTelemetry),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromIssues(issues),
    thresholds: {
      lowEvidenceCitationsBelow: LOW_EVIDENCE_CITATIONS_BELOW,
      lowRoleCoverageBelow: LOW_ROLE_COVERAGE_BELOW,
      maxProviderFallbackRate: MAX_PROVIDER_FALLBACK_RATE,
      maxProviderFailureRate: MAX_PROVIDER_FAILURE_RATE,
      minCandidateTypePublishableRate: MIN_CANDIDATE_TYPE_PUBLISHABLE_RATE,
    },
    publicRisk,
    byCandidateType,
    byProvider,
    providerTelemetry: normalizedTelemetry,
    issues,
  };
}

function bucketFromRuns(runs: readonly DecisionRunRecord[]): DecisionOpsQualityGateBucket {
  const scores: number[] = [];
  const warningCounts: Partial<Record<DecisionQualityWarning, number>> = {};
  let publishableRuns = 0;
  let blockedRuns = 0;
  let lowEvidenceRuns = 0;
  let lowRoleCoverageRuns = 0;
  let leakRuns = 0;
  let duplicateRationaleRuns = 0;

  for (const run of runs) {
    const quality = run.quality;
    if (!quality) {
      if (run.skipReason === "public_quality_gate_failed") blockedRuns += 1;
      continue;
    }

    scores.push(quality.score);
    if (quality.publishable) publishableRuns += 1;
    if (!quality.publishable || run.skipReason === "public_quality_gate_failed") {
      blockedRuns += 1;
    }
    if (quality.evidence.citedEvidenceCount < LOW_EVIDENCE_CITATIONS_BELOW) {
      lowEvidenceRuns += 1;
    }
    if (quality.roleCoverage.active < LOW_ROLE_COVERAGE_BELOW) {
      lowRoleCoverageRuns += 1;
    }
    if (quality.leakCount > 0) leakRuns += 1;
    if (quality.duplicateRationaleCount > 0) duplicateRationaleRuns += 1;

    for (const warning of quality.warnings) {
      warningCounts[warning] = (warningCounts[warning] ?? 0) + 1;
    }
  }

  return {
    totalRuns: runs.length,
    scoredRuns: scores.length,
    publishableRuns,
    blockedRuns,
    averageScore: average(scores),
    publishableRate: scores.length > 0 ? roundRatio(publishableRuns / scores.length) : null,
    warningCounts,
    lowEvidenceRuns,
    lowRoleCoverageRuns,
    leakRuns,
    duplicateRationaleRuns,
  };
}

function buildProviderBuckets(
  runs: readonly DecisionRunRecord[],
  recordProviderById: ReadonlyMap<string, string>,
) {
  const runsByProvider = new Map<string, DecisionRunRecord[]>();
  for (const run of runs) {
    const provider = providerForRun(run, recordProviderById);
    runsByProvider.set(provider, [...(runsByProvider.get(provider) ?? []), run]);
  }

  return Object.fromEntries(
    Array.from(runsByProvider.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, providerRuns]) => [provider, bucketFromRuns(providerRuns)]),
  );
}

function publicRiskIssues(bucket: DecisionOpsQualityGateBucket): DecisionOpsQualityGateIssue[] {
  const issues: DecisionOpsQualityGateIssue[] = [];
  if (bucket.leakRuns > 0) {
    issues.push({
      type: "public_content_leak",
      severity: "critical",
      targetId: "public-risk",
      observedValue: bucket.leakRuns,
      threshold: 0,
      message: "Public quality reports contain content leak findings.",
      action: "Inspect prompts and public guardrail output before increasing cadence.",
    });
  }
  if (bucket.duplicateRationaleRuns > 0) {
    issues.push({
      type: "duplicate_rationale",
      severity: "degraded",
      targetId: "public-risk",
      observedValue: bucket.duplicateRationaleRuns,
      threshold: 0,
      message: "Public output contains repeated rationale patterns.",
      action: "Inspect role prompts and PM synthesis before treating the output as stable.",
    });
  }
  if (bucket.lowEvidenceRuns > 0) {
    issues.push({
      type: "low_evidence",
      severity: "degraded",
      targetId: "public-risk",
      observedValue: bucket.lowEvidenceRuns,
      threshold: LOW_EVIDENCE_CITATIONS_BELOW,
      message: "Recent scored runs cite too little evidence.",
      action: "Inspect evidence dispatch and source availability before replaying candidates.",
    });
  }
  if (bucket.lowRoleCoverageRuns > 0) {
    issues.push({
      type: "low_role_coverage",
      severity: "degraded",
      targetId: "public-risk",
      observedValue: bucket.lowRoleCoverageRuns,
      threshold: LOW_ROLE_COVERAGE_BELOW,
      message: "Recent scored runs have too few active role contributors.",
      action: "Inspect abstain/fallback behavior before changing cadence.",
    });
  }
  return issues;
}

function candidateTypeIssues(byCandidateType: Record<CandidateType, DecisionOpsQualityGateBucket>) {
  const issues: DecisionOpsQualityGateIssue[] = [];
  for (const candidateType of CANDIDATE_TYPES) {
    const bucket = byCandidateType[candidateType];
    if (
      bucket.scoredRuns > 0 &&
      bucket.publishableRate !== null &&
      bucket.publishableRate < MIN_CANDIDATE_TYPE_PUBLISHABLE_RATE
    ) {
      issues.push({
        type: "candidate_type_low_publishable_rate",
        severity: "degraded",
        targetId: candidateType,
        candidateType,
        observedValue: bucket.publishableRate,
        threshold: MIN_CANDIDATE_TYPE_PUBLISHABLE_RATE,
        message: `${candidateType} output is often blocked by the public quality gate.`,
        action: "Inspect candidate-type prompts before increasing this lane's exposure.",
      });
    }
  }
  return issues;
}

function providerTelemetryIssues(
  telemetry: DecisionOpsQualityGateReport["providerTelemetry"],
): DecisionOpsQualityGateIssue[] {
  if (!telemetry) return [];
  const issues: DecisionOpsQualityGateIssue[] = [];
  if (telemetry.concentration.alert && telemetry.concentration.provider) {
    issues.push({
      type: "provider_concentration",
      severity: "degraded",
      targetId: telemetry.concentration.provider,
      provider: telemetry.concentration.provider,
      observedValue: roundRatio(telemetry.concentration.ratio),
      threshold: telemetry.concentration.threshold,
      message: "Provider telemetry is concentrated on one model provider.",
      action: "Inspect provider routing and fallback before expanding traffic.",
    });
  }
  if (telemetry.fallbackRate !== null && telemetry.fallbackRate > MAX_PROVIDER_FALLBACK_RATE) {
    issues.push({
      type: "provider_fallback_rate_high",
      severity: "degraded",
      targetId: "provider-telemetry",
      observedValue: telemetry.fallbackRate,
      threshold: MAX_PROVIDER_FALLBACK_RATE,
      message: "Provider fallback rate is above the quality gate threshold.",
      action: "Inspect provider availability and routing overrides before replaying runs.",
    });
  }
  if (telemetry.failureRate !== null && telemetry.failureRate > MAX_PROVIDER_FAILURE_RATE) {
    issues.push({
      type: "provider_failure_rate_high",
      severity: "critical",
      targetId: "provider-telemetry",
      observedValue: telemetry.failureRate,
      threshold: MAX_PROVIDER_FAILURE_RATE,
      message: "Provider failure rate is above the quality gate threshold.",
      action: "Inspect provider errors before changing queue cadence.",
    });
  }
  return issues;
}

function normalizeProviderTelemetry(summary: ProviderTelemetrySummary | null) {
  if (!summary) return null;
  return {
    totalCalls: summary.totalCalls,
    fallbackRate:
      summary.totalCalls > 0 ? roundRatio(summary.fallbackCalls / summary.totalCalls) : null,
    failureRate:
      summary.totalCalls > 0 ? roundRatio(summary.failureCalls / summary.totalCalls) : null,
    concentration: summary.singleProviderConcentration,
  };
}

function providerForRun(run: DecisionRunRecord, recordProviderById: ReadonlyMap<string, string>) {
  if (!run.decisionRecordId) return UNKNOWN_PROVIDER;
  return recordProviderById.get(run.decisionRecordId) ?? UNKNOWN_PROVIDER;
}

function candidateTypeForRun(run: DecisionRunRecord) {
  return normalizeCandidateType(run.candidate?.candidateType);
}

function statusFromIssues(
  issues: readonly DecisionOpsQualityGateIssue[],
): DecisionOpsQualityGateStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function sortIssues(issues: readonly DecisionOpsQualityGateIssue[]) {
  const severityRank: Record<DecisionOpsQualityGateIssue["severity"], number> = {
    critical: 0,
    degraded: 1,
  };
  return [...issues].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.type.localeCompare(b.type) ||
      a.targetId.localeCompare(b.targetId),
  );
}

function average(values: readonly number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return Math.round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function roundRatio(value: number) {
  return Math.round(value * 1_000) / 1_000;
}
