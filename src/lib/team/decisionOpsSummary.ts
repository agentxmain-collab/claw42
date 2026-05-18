import type { DecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type { DecisionOpsLifecycleDiagnostics } from "@/lib/team/decisionOpsLifecycleDiagnostics";
import type { DecisionOpsModelQualityReport } from "@/lib/team/decisionOpsModelQuality";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";

export type DecisionOpsSummaryStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsSummaryAreaId =
  | "public_chain"
  | "recovery_policy"
  | "model_quality"
  | "decision_lifecycle";

export interface DecisionOpsSummaryArea {
  area: DecisionOpsSummaryAreaId;
  status: DecisionOpsSummaryStatus;
  headline: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface DecisionOpsSummaryAction {
  source: DecisionOpsSummaryAreaId;
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSummary {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSummaryStatus;
  primaryArea: DecisionOpsSummaryAreaId | null;
  publicBoardState: DecisionOpsChainRunbook["publicBoardState"];
  headline: string;
  areas: DecisionOpsSummaryArea[];
  nextActions: DecisionOpsSummaryAction[];
}

const AREA_PRIORITY: DecisionOpsSummaryAreaId[] = [
  "public_chain",
  "recovery_policy",
  "model_quality",
  "decision_lifecycle",
];

const STATUS_RANK: Record<DecisionOpsSummaryStatus, number> = {
  healthy: 0,
  degraded: 1,
  critical: 2,
};

export function buildDecisionOpsSummary({
  runbook,
  recoveryPolicy,
  modelQuality,
  lifecycle,
  now = Date.now(),
}: {
  runbook: DecisionOpsChainRunbook;
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  modelQuality: DecisionOpsModelQualityReport;
  lifecycle: DecisionOpsLifecycleDiagnostics;
  now?: number;
}): DecisionOpsSummary {
  const areas = [
    publicChainArea(runbook),
    recoveryPolicyArea(recoveryPolicy),
    modelQualityArea(modelQuality),
    lifecycleArea(lifecycle),
  ];
  const status = highestStatus(areas);
  const primaryArea = primaryAreaFor({ areas, status });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    primaryArea,
    publicBoardState: runbook.publicBoardState,
    headline: headlineFor({
      status,
      primaryArea,
      runbook,
      recoveryPolicy,
      modelQuality,
      lifecycle,
    }),
    areas,
    nextActions: nextActionsFor({ status, runbook, recoveryPolicy, modelQuality, lifecycle }),
  };
}

function publicChainArea(runbook: DecisionOpsChainRunbook): DecisionOpsSummaryArea {
  return {
    area: "public_chain",
    status: runbook.status,
    headline: runbook.summary,
    evidence: {
      rootCause: runbook.rootCause,
      publicBoardState: runbook.publicBoardState,
      latestCronJobAt: runbook.evidence.latestCronJobAt,
      latestSuccessfulRunAt: runbook.evidence.latestSuccessfulRunAt,
      latestPublicPmEventAt: runbook.evidence.latestPublicPmEventAt,
    },
  };
}

function recoveryPolicyArea(
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy,
): DecisionOpsSummaryArea {
  return {
    area: "recovery_policy",
    status: recoveryPolicy.status,
    headline: recoveryPolicy.primaryAction ?? "No recovery action is required.",
    evidence: {
      mode: recoveryPolicy.mode,
      shouldPauseNewTriggers: recoveryPolicy.shouldPauseNewTriggers,
      autoRecoveryAllowed: recoveryPolicy.autoRecoveryAllowed,
    },
  };
}

function modelQualityArea(modelQuality: DecisionOpsModelQualityReport): DecisionOpsSummaryArea {
  return {
    area: "model_quality",
    status: modelQuality.status,
    headline:
      modelQuality.primaryRisk === null
        ? "Model quality is within the current guardrail."
        : `Model quality risk: ${modelQuality.primaryRisk}.`,
    evidence: {
      riskLevel: modelQuality.riskLevel,
      primaryRisk: modelQuality.primaryRisk,
    },
  };
}

function lifecycleArea(lifecycle: DecisionOpsLifecycleDiagnostics): DecisionOpsSummaryArea {
  return {
    area: "decision_lifecycle",
    status: lifecycle.status,
    headline:
      lifecycle.primaryIssue === null
        ? "Decision lifecycle is internally consistent."
        : `Decision lifecycle issue: ${lifecycle.primaryIssue}.`,
    evidence: {
      open: lifecycle.counts.open,
      resolved: lifecycle.counts.resolved,
      staleOpen: lifecycle.counts.staleOpen,
      inconsistentResolution: lifecycle.counts.inconsistentResolution,
      latestResolvedAt: lifecycle.latestResolvedAt,
    },
  };
}

function highestStatus(areas: readonly DecisionOpsSummaryArea[]): DecisionOpsSummaryStatus {
  return areas.reduce<DecisionOpsSummaryStatus>(
    (current, area) => (STATUS_RANK[area.status] > STATUS_RANK[current] ? area.status : current),
    "healthy",
  );
}

function primaryAreaFor({
  areas,
  status,
}: {
  areas: readonly DecisionOpsSummaryArea[];
  status: DecisionOpsSummaryStatus;
}) {
  if (status === "healthy") return null;
  return AREA_PRIORITY.find((area) =>
    areas.some((candidate) => candidate.area === area && candidate.status === status),
  )!;
}

function headlineFor({
  status,
  primaryArea,
  runbook,
  recoveryPolicy,
  modelQuality,
  lifecycle,
}: {
  status: DecisionOpsSummaryStatus;
  primaryArea: DecisionOpsSummaryAreaId | null;
  runbook: DecisionOpsChainRunbook;
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  modelQuality: DecisionOpsModelQualityReport;
  lifecycle: DecisionOpsLifecycleDiagnostics;
}) {
  if (status === "healthy") {
    return "Ops chain, model quality, and decision lifecycle are healthy.";
  }
  if (primaryArea === "public_chain") {
    return `Public decision output is blocked: ${runbook.rootCause}.`;
  }
  if (primaryArea === "recovery_policy") {
    return `Recovery policy requires operator review: ${recoveryPolicy.mode}.`;
  }
  if (primaryArea === "model_quality") {
    return `Model quality risk requires review: ${modelQuality.primaryRisk}.`;
  }
  return `Decision lifecycle needs review: ${lifecycle.primaryIssue}.`;
}

function nextActionsFor({
  status,
  runbook,
  recoveryPolicy,
  modelQuality,
  lifecycle,
}: {
  status: DecisionOpsSummaryStatus;
  runbook: DecisionOpsChainRunbook;
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  modelQuality: DecisionOpsModelQualityReport;
  lifecycle: DecisionOpsLifecycleDiagnostics;
}) {
  if (status === "healthy") return [];

  return uniqueActions([
    ...runbook.runbookActions.map((action) => ({
      source: "public_chain" as const,
      title: action.title,
      description: action.description,
      executable: false as const,
    })),
    ...(recoveryPolicy.primaryAction
      ? [
          {
            source: "recovery_policy" as const,
            title: recoveryPolicy.primaryAction,
            description:
              "Review recovery policy evidence before changing queue or replay behavior.",
            executable: false as const,
          },
        ]
      : []),
    ...modelQuality.recommendations.map((action) => ({
      source: "model_quality" as const,
      title: action.title,
      description: action.description,
      executable: false as const,
    })),
    ...lifecycle.actions.map((action) => ({
      source: "decision_lifecycle" as const,
      title: action.title,
      description: action.description,
      executable: false as const,
    })),
  ]);
}

function uniqueActions(actions: readonly DecisionOpsSummaryAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.title)) return false;
    seen.add(action.title);
    return true;
  });
}
