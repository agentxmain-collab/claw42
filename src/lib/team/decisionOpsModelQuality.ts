import type { DecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import type {
  DecisionOpsQualityGateIssueType,
  DecisionOpsQualityGateReport,
  DecisionOpsQualityGateStatus,
} from "@/lib/team/decisionOpsQualityGate";

export type DecisionOpsModelQualityStatus = DecisionOpsQualityGateStatus;
export type DecisionOpsModelQualityRiskLevel = "low" | "medium" | "high";

export type DecisionOpsModelQualityRisk =
  | DecisionOpsQualityGateIssueType
  | "quality_regression"
  | "insufficient_scored_runs";

export interface DecisionOpsModelQualityDimension {
  status: DecisionOpsModelQualityStatus;
  headline: string;
  evidence: Record<string, number | string | null | boolean>;
}

export interface DecisionOpsModelQualityRecommendation {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsModelQualityReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsModelQualityStatus;
  riskLevel: DecisionOpsModelQualityRiskLevel;
  primaryRisk: DecisionOpsModelQualityRisk | null;
  dimensions: {
    publicGuardrail: DecisionOpsModelQualityDimension;
    evidenceDepth: DecisionOpsModelQualityDimension;
    roleCoverage: DecisionOpsModelQualityDimension;
    providerMix: DecisionOpsModelQualityDimension;
    regression: DecisionOpsModelQualityDimension;
  };
  issueCounts: Partial<Record<DecisionOpsModelQualityRisk, number>>;
  recommendations: DecisionOpsModelQualityRecommendation[];
}

const RISK_PRIORITY: DecisionOpsModelQualityRisk[] = [
  "public_content_leak",
  "provider_failure_rate_high",
  "quality_regression",
  "duplicate_rationale",
  "low_evidence",
  "low_role_coverage",
  "provider_concentration",
  "provider_fallback_rate_high",
  "candidate_type_low_publishable_rate",
  "insufficient_scored_runs",
];

export function buildDecisionOpsModelQuality({
  qualityGate,
  deepDiagnostics,
  now = Date.now(),
}: {
  qualityGate: DecisionOpsQualityGateReport;
  deepDiagnostics: DecisionOpsDeepDiagnostics;
  now?: number;
}): DecisionOpsModelQualityReport {
  const issueCounts = issueCountsFor({ qualityGate, deepDiagnostics });
  const primaryRisk = primaryRiskFor(issueCounts);
  const status = statusFor({ qualityGate, deepDiagnostics, primaryRisk });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    riskLevel: riskLevelFor(status),
    primaryRisk,
    dimensions: {
      publicGuardrail: publicGuardrailDimension(qualityGate, deepDiagnostics),
      evidenceDepth: evidenceDepthDimension(qualityGate),
      roleCoverage: roleCoverageDimension(qualityGate),
      providerMix: providerMixDimension(qualityGate),
      regression: regressionDimension(deepDiagnostics),
    },
    issueCounts,
    recommendations: recommendationsFor(primaryRisk),
  };
}

function issueCountsFor({
  qualityGate,
  deepDiagnostics,
}: {
  qualityGate: DecisionOpsQualityGateReport;
  deepDiagnostics: DecisionOpsDeepDiagnostics;
}): Partial<Record<DecisionOpsModelQualityRisk, number>> {
  const counts: Partial<Record<DecisionOpsModelQualityRisk, number>> = {};
  for (const issue of qualityGate.issues) {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  }
  if (deepDiagnostics.regression.status === "regressed") {
    counts.quality_regression = 1;
  }
  if (qualityGate.publicRisk.scoredRuns === 0) {
    counts.insufficient_scored_runs = 1;
  }
  return counts;
}

function primaryRiskFor(
  issueCounts: Partial<Record<DecisionOpsModelQualityRisk, number>>,
): DecisionOpsModelQualityRisk | null {
  return RISK_PRIORITY.find((risk) => (issueCounts[risk] ?? 0) > 0) ?? null;
}

function statusFor({
  qualityGate,
  deepDiagnostics,
  primaryRisk,
}: {
  qualityGate: DecisionOpsQualityGateReport;
  deepDiagnostics: DecisionOpsDeepDiagnostics;
  primaryRisk: DecisionOpsModelQualityRisk | null;
}): DecisionOpsModelQualityStatus {
  if (qualityGate.status === "critical" || primaryRisk === "public_content_leak") {
    return "critical";
  }
  if (qualityGate.status === "degraded" || deepDiagnostics.regression.status === "regressed") {
    return "degraded";
  }
  return "healthy";
}

function riskLevelFor(status: DecisionOpsModelQualityStatus): DecisionOpsModelQualityRiskLevel {
  if (status === "critical") return "high";
  if (status === "degraded") return "medium";
  return "low";
}

function publicGuardrailDimension(
  qualityGate: DecisionOpsQualityGateReport,
  deepDiagnostics: DecisionOpsDeepDiagnostics,
): DecisionOpsModelQualityDimension {
  const leakRuns = qualityGate.publicRisk.leakRuns + deepDiagnostics.quality.leakRuns;
  const duplicateRuns =
    qualityGate.publicRisk.duplicateRationaleRuns + deepDiagnostics.quality.duplicateRationaleRuns;
  const status =
    leakRuns > 0
      ? "critical"
      : duplicateRuns > 0 || qualityGate.publicRisk.blockedRuns > 0
        ? "degraded"
        : "healthy";

  return {
    status,
    headline:
      status === "healthy"
        ? "No public leak or duplicate-rationale risk is visible."
        : leakRuns > 0
          ? "Public output has leak findings."
          : "Public output has repeated or blocked rationale patterns.",
    evidence: {
      leakRuns,
      duplicateRationaleRuns: duplicateRuns,
      blockedRuns: qualityGate.publicRisk.blockedRuns,
      publishableRate: qualityGate.publicRisk.publishableRate,
    },
  };
}

function evidenceDepthDimension(
  qualityGate: DecisionOpsQualityGateReport,
): DecisionOpsModelQualityDimension {
  const lowEvidenceRuns = qualityGate.publicRisk.lowEvidenceRuns;
  return {
    status: lowEvidenceRuns > 0 ? "degraded" : "healthy",
    headline:
      lowEvidenceRuns > 0
        ? "Some recent scored runs cite too little evidence."
        : "Evidence citation depth is within the current guardrail.",
    evidence: {
      lowEvidenceRuns,
      citedEvidenceThreshold: qualityGate.thresholds.lowEvidenceCitationsBelow,
      scoredRuns: qualityGate.publicRisk.scoredRuns,
    },
  };
}

function roleCoverageDimension(
  qualityGate: DecisionOpsQualityGateReport,
): DecisionOpsModelQualityDimension {
  const lowRoleCoverageRuns = qualityGate.publicRisk.lowRoleCoverageRuns;
  return {
    status: lowRoleCoverageRuns > 0 ? "degraded" : "healthy",
    headline:
      lowRoleCoverageRuns > 0
        ? "Some recent scored runs have too few active roles."
        : "Role coverage is within the current guardrail.",
    evidence: {
      lowRoleCoverageRuns,
      activeRoleThreshold: qualityGate.thresholds.lowRoleCoverageBelow,
      scoredRuns: qualityGate.publicRisk.scoredRuns,
    },
  };
}

function providerMixDimension(
  qualityGate: DecisionOpsQualityGateReport,
): DecisionOpsModelQualityDimension {
  const concentration = qualityGate.providerTelemetry?.concentration ?? null;
  const fallbackRate = qualityGate.providerTelemetry?.fallbackRate ?? null;
  const failureRate = qualityGate.providerTelemetry?.failureRate ?? null;
  const hasFailureRisk =
    failureRate !== null && failureRate > qualityGate.thresholds.maxProviderFailureRate;
  const hasFallbackRisk =
    fallbackRate !== null && fallbackRate > qualityGate.thresholds.maxProviderFallbackRate;
  const status = hasFailureRisk
    ? "critical"
    : concentration?.alert || hasFallbackRisk
      ? "degraded"
      : "healthy";

  return {
    status,
    headline:
      concentration?.alert && concentration.provider
        ? `Provider mix is concentrated in ${concentration.provider}.`
        : hasFallbackRisk
          ? "Provider fallback rate is elevated."
          : hasFailureRisk
            ? "Provider failure rate is elevated."
            : "Provider mix is within the current guardrail.",
    evidence: {
      totalCalls: qualityGate.providerTelemetry?.totalCalls ?? null,
      fallbackRate,
      failureRate,
      concentratedProvider: concentration?.provider ?? null,
      concentrationRatio: concentration?.ratio ?? null,
    },
  };
}

function regressionDimension(
  deepDiagnostics: DecisionOpsDeepDiagnostics,
): DecisionOpsModelQualityDimension {
  const regression = deepDiagnostics.regression;
  return {
    status: regression.status === "regressed" ? "degraded" : "healthy",
    headline:
      regression.status === "regressed" && regression.delta !== null
        ? `Recent quality score regressed by ${Math.abs(regression.delta)} points.`
        : regression.status === "insufficient_data"
          ? "Not enough scored runs to judge quality regression."
          : "Recent quality score trend is stable or improving.",
    evidence: {
      recentAverageScore: regression.recentAverageScore,
      previousAverageScore: regression.previousAverageScore,
      delta: regression.delta,
      recentWindowSize: regression.recentWindowSize,
      previousWindowSize: regression.previousWindowSize,
    },
  };
}

function recommendationsFor(
  primaryRisk: DecisionOpsModelQualityRisk | null,
): DecisionOpsModelQualityRecommendation[] {
  if (!primaryRisk) return [];
  if (primaryRisk === "public_content_leak") {
    return [
      {
        title: "Stop public release expansion until leak output is inspected",
        description:
          "Review raw PM and role rationale before increasing cadence or exposing more public cards.",
        executable: false,
      },
    ];
  }
  if (primaryRisk === "quality_regression") {
    return [
      {
        title: "Inspect recent regressed runs before prompt changes",
        description:
          "Compare recent and previous run evidence, role coverage, and provider mix before changing routing.",
        executable: false,
      },
    ];
  }
  if (primaryRisk === "provider_concentration") {
    return [
      {
        title: "Inspect provider routing diversity",
        description:
          "Verify provider override and fallback behavior before treating multi-provider quality as stable.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Inspect model-quality guardrail evidence",
      description:
        "Use the reported dimension evidence before changing prompts, providers, cadence, or replay policy.",
      executable: false,
    },
  ];
}
