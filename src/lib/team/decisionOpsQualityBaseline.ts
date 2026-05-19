import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { DecisionQualityWarning } from "@/lib/team/decisionQuality";
import type { ProviderTelemetrySummary } from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";

export type DecisionOpsQualityBaselineStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsQualityBaselineIssueType =
  | "public_content_leak"
  | "recent_score_regression"
  | "publishable_rate_low"
  | "score_floor_low"
  | "duplicate_rationale"
  | "candidate_type_sample_gap"
  | "insufficient_scored_runs"
  | "provider_concentration";

export interface DecisionOpsQualityBaselineBucket {
  totalRuns: number;
  scoredRuns: number;
  publishableRuns: number;
  averageScore: number | null;
  publishableRate: number | null;
  leakRuns: number;
  duplicateRationaleRuns: number;
  warningCounts: Partial<Record<DecisionQualityWarning, number>>;
}

export interface DecisionOpsQualityBaselineIssue {
  type: DecisionOpsQualityBaselineIssueType;
  severity: Exclude<DecisionOpsQualityBaselineStatus, "healthy">;
  targetId: string;
  observedValue: number;
  threshold: number;
  message: string;
  action: string;
}

export interface DecisionOpsQualityBaselineAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsQualityBaselineReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsQualityBaselineStatus;
  primaryIssue: DecisionOpsQualityBaselineIssueType | null;
  thresholds: {
    minimumScoredRuns: number;
    minimumCandidateTypeScoredRuns: number;
    minimumPublishableRate: number;
    minimumAverageScore: number;
    regressionDropThreshold: number;
    providerConcentrationMax: number;
  };
  baseline: {
    ready: boolean;
    scoredRuns: number;
    candidateTypesCovered: number;
    providerCount: number;
  };
  sample: DecisionOpsQualityBaselineBucket;
  byCandidateType: Record<CandidateType, DecisionOpsQualityBaselineBucket>;
  byProvider: Record<string, DecisionOpsQualityBaselineBucket>;
  trend: {
    recentWindowSize: number;
    previousWindowSize: number;
    recentAverageScore: number | null;
    previousAverageScore: number | null;
    delta: number | null;
    status: "insufficient_data" | "stable" | "improved" | "regressed";
    recentRunIds: string[];
    previousRunIds: string[];
  };
  issues: DecisionOpsQualityBaselineIssue[];
  actions: DecisionOpsQualityBaselineAction[];
}

const MINIMUM_SCORED_RUNS = 6;
const MINIMUM_CANDIDATE_TYPE_SCORED_RUNS = 1;
const MINIMUM_PUBLISHABLE_RATE = 0.8;
const MINIMUM_AVERAGE_SCORE = 70;
const REGRESSION_WINDOW_SIZE = 5;
const MINIMUM_TREND_WINDOW_SIZE = 3;
const REGRESSION_DROP_THRESHOLD = 8;
const PROVIDER_CONCENTRATION_MAX = 0.9;

const CANDIDATE_TYPES: CandidateType[] = ["symbol", "market_overview", "hotspot"];
const UNKNOWN_PROVIDER = "unknown";
const ISSUE_PRIORITY: DecisionOpsQualityBaselineIssueType[] = [
  "public_content_leak",
  "recent_score_regression",
  "publishable_rate_low",
  "score_floor_low",
  "duplicate_rationale",
  "candidate_type_sample_gap",
  "insufficient_scored_runs",
  "provider_concentration",
];

export function buildDecisionOpsQualityBaseline({
  runs,
  records,
  providerTelemetry = null,
  now = Date.now(),
}: {
  runs: readonly DecisionRunRecord[];
  records: readonly StrategyDecisionRecord[];
  providerTelemetry?: ProviderTelemetrySummary | null;
  now?: number;
}): DecisionOpsQualityBaselineReport {
  const recordProviderById = new Map(records.map((record) => [record.id, record.modelProvider]));
  const sample = bucketFromRuns(runs);
  const byCandidateType = Object.fromEntries(
    CANDIDATE_TYPES.map((candidateType) => [
      candidateType,
      bucketFromRuns(runs.filter((run) => candidateTypeForRun(run) === candidateType)),
    ]),
  ) as Record<CandidateType, DecisionOpsQualityBaselineBucket>;
  const byProvider = providerBucketsFromRuns(runs, recordProviderById);
  const trend = trendFromRuns(runs);
  const issues = sortIssues([
    ...sampleIssues(sample),
    ...candidateTypeIssues(byCandidateType),
    ...trendIssues(trend),
    ...providerIssues(providerTelemetry),
  ]);
  const primaryIssue = primaryIssueFor(issues);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: statusFromIssues(issues),
    primaryIssue,
    thresholds: {
      minimumScoredRuns: MINIMUM_SCORED_RUNS,
      minimumCandidateTypeScoredRuns: MINIMUM_CANDIDATE_TYPE_SCORED_RUNS,
      minimumPublishableRate: MINIMUM_PUBLISHABLE_RATE,
      minimumAverageScore: MINIMUM_AVERAGE_SCORE,
      regressionDropThreshold: REGRESSION_DROP_THRESHOLD,
      providerConcentrationMax: PROVIDER_CONCENTRATION_MAX,
    },
    baseline: {
      ready: baselineReady(sample, byCandidateType),
      scoredRuns: sample.scoredRuns,
      candidateTypesCovered: CANDIDATE_TYPES.filter(
        (candidateType) =>
          byCandidateType[candidateType].scoredRuns >= MINIMUM_CANDIDATE_TYPE_SCORED_RUNS,
      ).length,
      providerCount: Object.keys(byProvider).filter((provider) => provider !== UNKNOWN_PROVIDER)
        .length,
    },
    sample,
    byCandidateType,
    byProvider,
    trend,
    issues,
    actions: actionsFor(primaryIssue),
  };
}

function bucketFromRuns(runs: readonly DecisionRunRecord[]): DecisionOpsQualityBaselineBucket {
  const scores: number[] = [];
  const warningCounts: Partial<Record<DecisionQualityWarning, number>> = {};
  let publishableRuns = 0;
  let leakRuns = 0;
  let duplicateRationaleRuns = 0;

  for (const run of runs) {
    const quality = run.quality;
    if (!quality) continue;
    scores.push(quality.score);
    if (quality.publishable) publishableRuns += 1;
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
    averageScore: average(scores),
    publishableRate: scores.length > 0 ? roundRatio(publishableRuns / scores.length) : null,
    leakRuns,
    duplicateRationaleRuns,
    warningCounts,
  };
}

function providerBucketsFromRuns(
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

function trendFromRuns(
  runs: readonly DecisionRunRecord[],
): DecisionOpsQualityBaselineReport["trend"] {
  const scoredRuns = [...runs]
    .filter((run) => typeof run.quality?.score === "number")
    .sort((a, b) => safeTime(b.startedAt) - safeTime(a.startedAt) || a.id.localeCompare(b.id));
  const recentRuns = scoredRuns.slice(0, REGRESSION_WINDOW_SIZE);
  const previousRuns = scoredRuns.slice(REGRESSION_WINDOW_SIZE, REGRESSION_WINDOW_SIZE * 2);
  const recentAverageScore = average(recentRuns.map((run) => run.quality?.score ?? 0));
  const previousAverageScore = average(previousRuns.map((run) => run.quality?.score ?? 0));
  const hasEnoughTrendData =
    recentRuns.length >= MINIMUM_TREND_WINDOW_SIZE &&
    previousRuns.length >= MINIMUM_TREND_WINDOW_SIZE &&
    recentAverageScore !== null &&
    previousAverageScore !== null;
  const delta = hasEnoughTrendData ? recentAverageScore - previousAverageScore : null;

  return {
    recentWindowSize: recentRuns.length,
    previousWindowSize: previousRuns.length,
    recentAverageScore,
    previousAverageScore,
    delta,
    status: trendStatus(delta),
    recentRunIds: recentRuns.map((run) => run.id),
    previousRunIds: previousRuns.map((run) => run.id),
  };
}

function sampleIssues(bucket: DecisionOpsQualityBaselineBucket): DecisionOpsQualityBaselineIssue[] {
  const issues: DecisionOpsQualityBaselineIssue[] = [];
  if (bucket.leakRuns > 0) {
    issues.push({
      type: "public_content_leak",
      severity: "critical",
      targetId: "public-baseline",
      observedValue: bucket.leakRuns,
      threshold: 0,
      message: "Recent scored runs include public content leak findings.",
      action: "Freeze release expansion and inspect public guardrail inputs before replaying.",
    });
  }
  if (bucket.duplicateRationaleRuns > 0) {
    issues.push({
      type: "duplicate_rationale",
      severity: "degraded",
      targetId: "public-baseline",
      observedValue: bucket.duplicateRationaleRuns,
      threshold: 0,
      message: "Recent scored runs include duplicate public rationale patterns.",
      action: "Inspect role prompts and PM synthesis before treating output diversity as stable.",
    });
  }
  if (bucket.scoredRuns < MINIMUM_SCORED_RUNS) {
    issues.push({
      type: "insufficient_scored_runs",
      severity: "degraded",
      targetId: "public-baseline",
      observedValue: bucket.scoredRuns,
      threshold: MINIMUM_SCORED_RUNS,
      message: "The quality baseline does not have enough scored runs yet.",
      action: "Collect more scored runs before judging model quality drift.",
    });
  }
  if (
    bucket.publishableRate !== null &&
    bucket.scoredRuns >= MINIMUM_SCORED_RUNS &&
    bucket.publishableRate < MINIMUM_PUBLISHABLE_RATE
  ) {
    issues.push({
      type: "publishable_rate_low",
      severity: "degraded",
      targetId: "public-baseline",
      observedValue: bucket.publishableRate,
      threshold: MINIMUM_PUBLISHABLE_RATE,
      message: "Recent scored runs publish too few clean public outputs.",
      action: "Inspect quality-gate blocking reasons before increasing cadence.",
    });
  }
  if (
    bucket.averageScore !== null &&
    bucket.scoredRuns >= MINIMUM_SCORED_RUNS &&
    bucket.averageScore < MINIMUM_AVERAGE_SCORE
  ) {
    issues.push({
      type: "score_floor_low",
      severity: "degraded",
      targetId: "public-baseline",
      observedValue: bucket.averageScore,
      threshold: MINIMUM_AVERAGE_SCORE,
      message: "Recent average quality score is below the baseline floor.",
      action: "Review prompt routing and evidence coverage before accepting this model mix.",
    });
  }
  return issues;
}

function candidateTypeIssues(
  byCandidateType: Record<CandidateType, DecisionOpsQualityBaselineBucket>,
) {
  return CANDIDATE_TYPES.filter(
    (candidateType) =>
      byCandidateType[candidateType].scoredRuns < MINIMUM_CANDIDATE_TYPE_SCORED_RUNS,
  ).map(
    (candidateType): DecisionOpsQualityBaselineIssue => ({
      type: "candidate_type_sample_gap",
      severity: "degraded",
      targetId: candidateType,
      observedValue: byCandidateType[candidateType].scoredRuns,
      threshold: MINIMUM_CANDIDATE_TYPE_SCORED_RUNS,
      message: `${candidateType} has not contributed enough scored samples to the baseline.`,
      action: "Keep candidate-type rollout decisions conservative until every lane has samples.",
    }),
  );
}

function trendIssues(
  trend: DecisionOpsQualityBaselineReport["trend"],
): DecisionOpsQualityBaselineIssue[] {
  if (trend.status !== "regressed" || trend.delta === null) return [];
  return [
    {
      type: "recent_score_regression",
      severity: "degraded",
      targetId: "quality-trend",
      observedValue: trend.delta,
      threshold: -REGRESSION_DROP_THRESHOLD,
      message: "Recent scored runs fell below the reference quality window.",
      action:
        "Compare recent run prompts, providers, and evidence sources before merging model changes.",
    },
  ];
}

function providerIssues(
  providerTelemetry: ProviderTelemetrySummary | null,
): DecisionOpsQualityBaselineIssue[] {
  const concentration = providerTelemetry?.singleProviderConcentration;
  if (!concentration?.alert || !concentration.provider) return [];
  return [
    {
      type: "provider_concentration",
      severity: "degraded",
      targetId: concentration.provider,
      observedValue: concentration.ratio,
      threshold: PROVIDER_CONCENTRATION_MAX,
      message: `Provider baseline is concentrated in ${concentration.provider}.`,
      action: "Treat model-diversity conclusions as weak until provider routing broadens again.",
    },
  ];
}

function actionsFor(
  primaryIssue: DecisionOpsQualityBaselineIssueType | null,
): DecisionOpsQualityBaselineAction[] {
  if (!primaryIssue) return [];
  const shared = {
    executable: false as const,
  };
  if (primaryIssue === "public_content_leak") {
    return [
      {
        title: "Inspect public guardrail leak samples",
        description:
          "Review the scored run text that triggered leak findings before accepting new public output.",
        ...shared,
      },
    ];
  }
  if (primaryIssue === "recent_score_regression") {
    return [
      {
        title: "Compare recent and reference run windows",
        description:
          "Review the recent run IDs against the previous window to isolate prompt, provider, or evidence changes.",
        ...shared,
      },
    ];
  }
  return [
    {
      title: "Collect more clean scored samples",
      description:
        "Keep the model-quality baseline in observe mode until sample coverage and public-output quality are stable.",
      ...shared,
    },
  ];
}

function baselineReady(
  sample: DecisionOpsQualityBaselineBucket,
  byCandidateType: Record<CandidateType, DecisionOpsQualityBaselineBucket>,
) {
  return (
    sample.scoredRuns >= MINIMUM_SCORED_RUNS &&
    CANDIDATE_TYPES.every(
      (candidateType) =>
        byCandidateType[candidateType].scoredRuns >= MINIMUM_CANDIDATE_TYPE_SCORED_RUNS,
    )
  );
}

function primaryIssueFor(
  issues: readonly DecisionOpsQualityBaselineIssue[],
): DecisionOpsQualityBaselineIssueType | null {
  return ISSUE_PRIORITY.find((type) => issues.some((issue) => issue.type === type)) ?? null;
}

function statusFromIssues(
  issues: readonly DecisionOpsQualityBaselineIssue[],
): DecisionOpsQualityBaselineStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.length > 0) return "degraded";
  return "healthy";
}

function sortIssues(issues: DecisionOpsQualityBaselineIssue[]) {
  return [...issues].sort(
    (a, b) =>
      ISSUE_PRIORITY.indexOf(a.type) - ISSUE_PRIORITY.indexOf(b.type) ||
      a.targetId.localeCompare(b.targetId),
  );
}

function candidateTypeForRun(run: DecisionRunRecord) {
  return normalizeCandidateType(run.candidate.candidateType);
}

function providerForRun(run: DecisionRunRecord, recordProviderById: ReadonlyMap<string, string>) {
  if (run.decisionRecordId) return recordProviderById.get(run.decisionRecordId) ?? UNKNOWN_PROVIDER;
  return UNKNOWN_PROVIDER;
}

function trendStatus(delta: number | null): DecisionOpsQualityBaselineReport["trend"]["status"] {
  if (delta === null) return "insufficient_data";
  if (delta <= -REGRESSION_DROP_THRESHOLD) return "regressed";
  if (delta >= REGRESSION_DROP_THRESHOLD) return "improved";
  return "stable";
}

function average(values: readonly number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return Math.round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
}

function roundRatio(value: number) {
  return Math.round(value * 1000) / 1000;
}

function safeTime(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
