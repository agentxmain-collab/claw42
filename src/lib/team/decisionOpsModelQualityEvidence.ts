import type {
  DecisionOpsModelQualityReport,
  DecisionOpsModelQualityStatus,
} from "@/lib/team/decisionOpsModelQuality";
import type {
  DecisionOpsQualityBaselineIssueType,
  DecisionOpsQualityBaselineReport,
  DecisionOpsQualityBaselineStatus,
} from "@/lib/team/decisionOpsQualityBaseline";

export type DecisionOpsModelQualityEvidenceStatus = "hold" | "collecting_evidence" | "ready";

export interface DecisionOpsModelQualityEvidenceAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsModelQualityEvidenceReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsModelQualityEvidenceStatus;
  evidenceReady: boolean;
  canIncreaseModelCost: false;
  canReduceModelFanout: false;
  sourceStatuses: {
    qualityBaseline: DecisionOpsQualityBaselineStatus;
    modelQuality: DecisionOpsModelQualityStatus;
  };
  summary: {
    scoredRuns: number;
    candidateTypesCovered: number;
    publishableRate: number | null;
    averageScore: number | null;
    primaryRisk: DecisionOpsModelQualityReport["primaryRisk"];
  };
  blockingReasons: string[];
  nextActions: DecisionOpsModelQualityEvidenceAction[];
}

const COLLECTING_ISSUES = new Set<DecisionOpsQualityBaselineIssueType>([
  "candidate_type_sample_gap",
  "insufficient_scored_runs",
]);

export function buildDecisionOpsModelQualityEvidence({
  qualityBaseline,
  modelQuality,
  now = Date.now(),
}: {
  qualityBaseline: DecisionOpsQualityBaselineReport;
  modelQuality: DecisionOpsModelQualityReport;
  now?: number;
}): DecisionOpsModelQualityEvidenceReport {
  const blockingReasons = blockingReasonsFor({ qualityBaseline, modelQuality });
  const status = statusFor({ qualityBaseline, modelQuality, blockingReasons });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    evidenceReady: status === "ready",
    canIncreaseModelCost: false,
    canReduceModelFanout: false,
    sourceStatuses: {
      qualityBaseline: qualityBaseline.status,
      modelQuality: modelQuality.status,
    },
    summary: {
      scoredRuns: qualityBaseline.baseline.scoredRuns,
      candidateTypesCovered: qualityBaseline.baseline.candidateTypesCovered,
      publishableRate: qualityBaseline.sample.publishableRate,
      averageScore: qualityBaseline.sample.averageScore,
      primaryRisk: modelQuality.primaryRisk,
    },
    blockingReasons,
    nextActions: nextActionsFor(status),
  };
}

function blockingReasonsFor({
  qualityBaseline,
  modelQuality,
}: {
  qualityBaseline: DecisionOpsQualityBaselineReport;
  modelQuality: DecisionOpsModelQualityReport;
}) {
  const reasons: string[] = [];
  if (modelQuality.status !== "healthy") {
    reasons.push("model_quality_not_ready");
  }
  if (!qualityBaseline.baseline.ready || qualityBaseline.status !== "healthy") {
    reasons.push("quality_baseline_not_ready");
  }
  if (qualityBaseline.primaryIssue) reasons.push(qualityBaseline.primaryIssue);
  if (modelQuality.primaryRisk) reasons.push(modelQuality.primaryRisk);
  return Array.from(new Set(reasons));
}

function statusFor({
  qualityBaseline,
  modelQuality,
  blockingReasons,
}: {
  qualityBaseline: DecisionOpsQualityBaselineReport;
  modelQuality: DecisionOpsModelQualityReport;
  blockingReasons: readonly string[];
}): DecisionOpsModelQualityEvidenceStatus {
  if (blockingReasons.length === 0) return "ready";
  if (
    modelQuality.status === "healthy" &&
    qualityBaseline.primaryIssue &&
    COLLECTING_ISSUES.has(qualityBaseline.primaryIssue)
  ) {
    return "collecting_evidence";
  }
  return "hold";
}

function nextActionsFor(
  status: DecisionOpsModelQualityEvidenceStatus,
): DecisionOpsModelQualityEvidenceAction[] {
  if (status === "ready") return [];
  if (status === "collecting_evidence") {
    return [
      {
        title: "Collect more scored candidate-type samples",
        description:
          "Do not judge model drift or sparse readiness until market, hotspot, and symbol lanes all have clean scored samples.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Hold model-quality release expansion",
      description:
        "Public guardrails, regression checks, evidence depth, and provider mix must be clean before expanding cadence or fan-out changes.",
      executable: false,
    },
  ];
}
