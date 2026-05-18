import type { ProviderTelemetrySummary } from "@/lib/team/providerTelemetry";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { DecisionQualityReport, DecisionQualityWarning } from "@/lib/team/decisionQuality";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

export type DecisionOpsReplayDryRunType = "job_zero_output" | "quality_blocked_run" | "failed_run";

export interface DecisionOpsReplayDryRunProposal {
  type: DecisionOpsReplayDryRunType;
  jobId?: string;
  runId?: string;
  recordId?: string;
  candidateKey?: string;
  symbol?: string | null;
  reason: string;
  executable: false;
}

export interface DecisionOpsDeepDiagnostics {
  schemaVersion: 1;
  generatedAt: string;
  quality: {
    scoredRuns: number;
    publishableRuns: number;
    blockedRuns: number;
    averageScore: number | null;
    warningCounts: Partial<Record<DecisionQualityWarning, number>>;
    blockingWarningCounts: Partial<Record<DecisionQualityWarning, number>>;
    lowEvidenceRuns: number;
    lowRoleCoverageRuns: number;
    leakRuns: number;
    duplicateRationaleRuns: number;
  };
  provider: {
    recordModelProviderCounts: Record<string, number>;
    stageModelProviderCounts: Record<string, number>;
    telemetry: ProviderTelemetrySummary | null;
  };
  replayDryRun: {
    proposals: DecisionOpsReplayDryRunProposal[];
  };
  regression: {
    recentWindowSize: number;
    previousWindowSize: number;
    recentAverageScore: number | null;
    previousAverageScore: number | null;
    delta: number | null;
    status: "insufficient_data" | "stable" | "improved" | "regressed";
    recentRunIds: string[];
    previousRunIds: string[];
  };
}

const REGRESSION_WINDOW_SIZE = 3;
const REGRESSION_THRESHOLD = 10;
const LOW_EVIDENCE_THRESHOLD = 2;
const LOW_ROLE_COVERAGE_THRESHOLD = 6;

export function buildDecisionOpsDeepDiagnostics({
  jobs,
  runs,
  records,
  providerTelemetry = null,
  now = Date.now(),
}: {
  jobs: readonly PmDecisionJobRecord[];
  runs: readonly DecisionRunRecord[];
  records: readonly StrategyDecisionRecord[];
  providerTelemetry?: ProviderTelemetrySummary | null;
  now?: number;
}): DecisionOpsDeepDiagnostics {
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    quality: buildQualityDiagnostics(runs),
    provider: {
      recordModelProviderCounts: countRecordProviders(records),
      stageModelProviderCounts: countStageProviders(records),
      telemetry: providerTelemetry,
    },
    replayDryRun: {
      proposals: buildReplayDryRunProposals(jobs, runs),
    },
    regression: buildRegressionSnapshot(runs),
  };
}

function buildQualityDiagnostics(
  runs: readonly DecisionRunRecord[],
): DecisionOpsDeepDiagnostics["quality"] {
  const qualityReports = runs
    .map((run) => run.quality)
    .filter((quality): quality is DecisionQualityReport => Boolean(quality));
  const warningCounts: Partial<Record<DecisionQualityWarning, number>> = {};
  const blockingWarningCounts: Partial<Record<DecisionQualityWarning, number>> = {};

  for (const quality of qualityReports) {
    for (const warning of quality.warnings) {
      warningCounts[warning] = (warningCounts[warning] ?? 0) + 1;
    }
    for (const warning of quality.blockingWarnings) {
      blockingWarningCounts[warning] = (blockingWarningCounts[warning] ?? 0) + 1;
    }
  }

  return {
    scoredRuns: qualityReports.length,
    publishableRuns: qualityReports.filter((quality) => quality.publishable).length,
    blockedRuns: runs.filter(
      (run) =>
        run.skipReason === "public_quality_gate_failed" || run.quality?.publishable === false,
    ).length,
    averageScore: average(qualityReports.map((quality) => quality.score)),
    warningCounts,
    blockingWarningCounts,
    lowEvidenceRuns: qualityReports.filter(
      (quality) => quality.evidence.citedEvidenceCount < LOW_EVIDENCE_THRESHOLD,
    ).length,
    lowRoleCoverageRuns: qualityReports.filter(
      (quality) => quality.roleCoverage.active < LOW_ROLE_COVERAGE_THRESHOLD,
    ).length,
    leakRuns: qualityReports.filter((quality) => quality.leakCount > 0).length,
    duplicateRationaleRuns: qualityReports.filter((quality) => quality.duplicateRationaleCount > 0)
      .length,
  };
}

function countRecordProviders(records: readonly StrategyDecisionRecord[]) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    increment(counts, record.modelProvider);
  }
  return counts;
}

function countStageProviders(records: readonly StrategyDecisionRecord[]) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    for (const stage of record.stageTrace ?? []) {
      increment(counts, stage.modelProvider);
    }
  }
  return counts;
}

function buildReplayDryRunProposals(
  jobs: readonly PmDecisionJobRecord[],
  runs: readonly DecisionRunRecord[],
): DecisionOpsReplayDryRunProposal[] {
  const proposals: DecisionOpsReplayDryRunProposal[] = [
    ...jobs
      .filter((job) => job.status === "succeeded" && job.outputCount === 0)
      .map((job) => ({
        type: "job_zero_output" as const,
        jobId: job.id,
        candidateKey: job.candidate?.candidateKey ?? job.symbol ?? undefined,
        symbol: job.symbol,
        reason: "Succeeded job wrote no public records; replay requires operator review first.",
        executable: false as const,
      })),
    ...runs
      .filter((run) => run.skipReason === "public_quality_gate_failed")
      .map((run) => ({
        type: "quality_blocked_run" as const,
        runId: run.id,
        recordId: run.decisionRecordId ?? undefined,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        reason:
          "Public quality gate blocked the run; replay requires prompt/evidence review first.",
        executable: false as const,
      })),
    ...runs
      .filter((run) => run.status === "failed")
      .map((run) => ({
        type: "failed_run" as const,
        runId: run.id,
        recordId: run.decisionRecordId ?? undefined,
        candidateKey: run.candidate.candidateKey,
        symbol: run.symbol,
        reason: "Decision run failed; replay requires provider/error inspection first.",
        executable: false as const,
      })),
  ];
  return proposals.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      (a.jobId ?? a.runId ?? "").localeCompare(b.jobId ?? b.runId ?? ""),
  );
}

function buildRegressionSnapshot(
  runs: readonly DecisionRunRecord[],
): DecisionOpsDeepDiagnostics["regression"] {
  const scoredRuns = [...runs]
    .filter((run) => typeof run.quality?.score === "number")
    .sort((a, b) => safeTime(b.startedAt) - safeTime(a.startedAt) || a.id.localeCompare(b.id));
  const recentRuns = scoredRuns.slice(0, REGRESSION_WINDOW_SIZE);
  const previousRuns = scoredRuns.slice(REGRESSION_WINDOW_SIZE, REGRESSION_WINDOW_SIZE * 2);
  const recentAverageScore = average(recentRuns.map((run) => run.quality?.score ?? 0));
  const previousAverageScore = average(previousRuns.map((run) => run.quality?.score ?? 0));
  const delta =
    recentAverageScore === null || previousAverageScore === null
      ? null
      : recentAverageScore - previousAverageScore;

  return {
    recentWindowSize: recentRuns.length,
    previousWindowSize: previousRuns.length,
    recentAverageScore,
    previousAverageScore,
    delta,
    status: regressionStatus(delta),
    recentRunIds: recentRuns.map((run) => run.id),
    previousRunIds: previousRuns.map((run) => run.id),
  };
}

function regressionStatus(
  delta: number | null,
): DecisionOpsDeepDiagnostics["regression"]["status"] {
  if (delta === null) return "insufficient_data";
  if (delta <= -REGRESSION_THRESHOLD) return "regressed";
  if (delta >= REGRESSION_THRESHOLD) return "improved";
  return "stable";
}

function increment(counts: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  counts[key] = (counts[key] ?? 0) + 1;
}

function average(values: readonly number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return Math.round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
