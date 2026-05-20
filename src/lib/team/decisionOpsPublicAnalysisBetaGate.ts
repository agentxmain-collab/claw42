import type { DecisionOpsGlobalProgressGateReport } from "@/lib/team/decisionOpsGlobalProgressGate";
import type { DecisionOpsMemoryLearningReport } from "@/lib/team/decisionOpsMemoryLearning";
import type { DecisionOpsQualityGateReport } from "@/lib/team/decisionOpsQualityGate";
import type { DecisionOpsResidentQueueCanaryReport } from "@/lib/team/decisionOpsResidentQueueCanary";
import type { DecisionOpsRuntimeQualityGateReport } from "@/lib/team/decisionOpsRuntimeQualityGate";
import {
  HOTSPOT_WINDOW_HOURS,
  MARKET_OVERVIEW_INTERVAL_HOURS,
} from "@/lib/watch/residentCandidate";

export type DecisionOpsPublicAnalysisBetaGateStatus =
  | "hold"
  | "ready_for_public_analysis_beta"
  | "ready_for_trusted_learning_beta";

export interface DecisionOpsPublicAnalysisBetaAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsPublicAnalysisBetaCostPolicy {
  queuePublishExplicitOptIn: boolean;
  maxVisitResidentJobs: number;
  maxVisitSymbolJobs: number;
}

export interface DecisionOpsPublicAnalysisBetaGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsPublicAnalysisBetaGateStatus;
  publicAnalysisBetaAllowed: boolean;
  trustedLearningClaimAllowed: boolean;
  productionReleaseAllowed: false;
  realTradeExecutionAllowed: false;
  feedbackCaptureReady: boolean;
  utcPolicy: {
    clock: "UTC";
    marketOverviewIntervalHours: number;
    hotspotIntervalHours: number;
  };
  costPolicy: DecisionOpsPublicAnalysisBetaCostPolicy;
  sourceStatuses: {
    globalProgress: DecisionOpsGlobalProgressGateReport["status"];
    residentQueueCanary: DecisionOpsResidentQueueCanaryReport["status"];
    qualityGate: DecisionOpsQualityGateReport["status"];
    runtimeQualityGate: DecisionOpsRuntimeQualityGateReport["status"];
    memoryLearning: DecisionOpsMemoryLearningReport["status"];
  };
  blockingReasons: string[];
  watchItems: string[];
  actions: DecisionOpsPublicAnalysisBetaAction[];
}

type GlobalProgressInput = Pick<
  DecisionOpsGlobalProgressGateReport,
  "status" | "readiness" | "blockingReasons"
>;
type ResidentQueueCanaryInput = Pick<
  DecisionOpsResidentQueueCanaryReport,
  "status" | "allResidentClosedLoopReady" | "blockingReasons"
>;
type QualityGateInput = Pick<DecisionOpsQualityGateReport, "status"> & {
  issues: readonly Pick<DecisionOpsQualityGateReport["issues"][number], "type" | "severity">[];
};
type RuntimeQualityGateInput = Pick<
  DecisionOpsRuntimeQualityGateReport,
  "status" | "longRunningPreviewAllowed" | "blockingReasons"
>;
type MemoryLearningInput = Pick<
  DecisionOpsMemoryLearningReport,
  "status" | "memoryLoopLearningReady" | "blockingReasons"
>;

export function buildDecisionOpsPublicAnalysisBetaGate({
  globalProgress,
  residentQueueCanary,
  qualityGate,
  runtimeQualityGate,
  memoryLearning,
  feedbackCaptureReady,
  costPolicy,
  now = Date.now(),
}: {
  globalProgress: GlobalProgressInput;
  residentQueueCanary: ResidentQueueCanaryInput;
  qualityGate: QualityGateInput;
  runtimeQualityGate: RuntimeQualityGateInput;
  memoryLearning: MemoryLearningInput;
  feedbackCaptureReady: boolean;
  costPolicy: DecisionOpsPublicAnalysisBetaCostPolicy;
  now?: number;
}): DecisionOpsPublicAnalysisBetaGateReport {
  const blockingReasons = blockingReasonsFor({
    globalProgress,
    residentQueueCanary,
    qualityGate,
    runtimeQualityGate,
    feedbackCaptureReady,
    costPolicy,
  });
  const publicAnalysisBetaAllowed = blockingReasons.length === 0;
  const trustedLearningClaimAllowed =
    publicAnalysisBetaAllowed && memoryLearning.memoryLoopLearningReady;
  const status = statusFor({ publicAnalysisBetaAllowed, trustedLearningClaimAllowed });
  const watchItems = watchItemsFor({ publicAnalysisBetaAllowed, memoryLearning });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    publicAnalysisBetaAllowed,
    trustedLearningClaimAllowed,
    productionReleaseAllowed: false,
    realTradeExecutionAllowed: false,
    feedbackCaptureReady,
    utcPolicy: {
      clock: "UTC",
      marketOverviewIntervalHours: MARKET_OVERVIEW_INTERVAL_HOURS,
      hotspotIntervalHours: HOTSPOT_WINDOW_HOURS,
    },
    costPolicy,
    sourceStatuses: {
      globalProgress: globalProgress.status,
      residentQueueCanary: residentQueueCanary.status,
      qualityGate: qualityGate.status,
      runtimeQualityGate: runtimeQualityGate.status,
      memoryLearning: memoryLearning.status,
    },
    blockingReasons,
    watchItems,
    actions: actionsFor(status),
  };
}

function blockingReasonsFor({
  globalProgress,
  residentQueueCanary,
  qualityGate,
  runtimeQualityGate,
  feedbackCaptureReady,
  costPolicy,
}: {
  globalProgress: GlobalProgressInput;
  residentQueueCanary: ResidentQueueCanaryInput;
  qualityGate: QualityGateInput;
  runtimeQualityGate: RuntimeQualityGateInput;
  feedbackCaptureReady: boolean;
  costPolicy: DecisionOpsPublicAnalysisBetaCostPolicy;
}) {
  const reasons: string[] = [];

  if (!globalProgress.readiness.globalResidentLanesReady) {
    reasons.push("global_resident_lanes_not_ready");
  }
  if (!globalProgress.readiness.queueDrainReady) {
    reasons.push("resident_queue_not_drained");
  }
  if (!globalProgress.readiness.runtimeQualityReady) {
    reasons.push(...globalProgress.blockingReasons, "global_runtime_quality_not_ready");
  }
  if (!residentQueueCanary.allResidentClosedLoopReady) {
    reasons.push(...residentQueueCanary.blockingReasons);
  }
  if (qualityGate.status === "critical") {
    reasons.push(...qualityGate.issues.map((issue) => `quality_${issue.type}`));
  }
  if (!runtimeQualityGate.longRunningPreviewAllowed) {
    reasons.push(...runtimeQualityGate.blockingReasons, "runtime_quality_not_ready");
  }
  if (!feedbackCaptureReady) {
    reasons.push("feedback_capture_not_ready");
  }
  if (
    !costPolicy.queuePublishExplicitOptIn ||
    costPolicy.maxVisitResidentJobs > 1 ||
    costPolicy.maxVisitSymbolJobs > 3
  ) {
    reasons.push("cost_policy_not_ready");
  }

  return Array.from(new Set(reasons));
}

function watchItemsFor({
  publicAnalysisBetaAllowed,
  memoryLearning,
}: {
  publicAnalysisBetaAllowed: boolean;
  memoryLearning: MemoryLearningInput;
}) {
  if (!publicAnalysisBetaAllowed || memoryLearning.memoryLoopLearningReady) return [];
  return memoryLearning.blockingReasons.filter((reason) =>
    reason.startsWith("memory_loop_sample_size"),
  );
}

function statusFor({
  publicAnalysisBetaAllowed,
  trustedLearningClaimAllowed,
}: {
  publicAnalysisBetaAllowed: boolean;
  trustedLearningClaimAllowed: boolean;
}): DecisionOpsPublicAnalysisBetaGateStatus {
  if (!publicAnalysisBetaAllowed) return "hold";
  return trustedLearningClaimAllowed
    ? "ready_for_trusted_learning_beta"
    : "ready_for_public_analysis_beta";
}

function actionsFor(
  status: DecisionOpsPublicAnalysisBetaGateStatus,
): DecisionOpsPublicAnalysisBetaAction[] {
  if (status === "ready_for_trusted_learning_beta") {
    return [
      {
        title: "Continue preview beta with learning claims gated",
        description:
          "Public analysis beta and private memory-learning evidence are both clean. Production and real trading remain locked.",
        executable: false,
      },
    ];
  }
  if (status === "ready_for_public_analysis_beta") {
    return [
      {
        title: "Open public analysis beta in preview only",
        description:
          "Global resident analysis, public output, cost boundaries, and feedback capture are ready for external preview. Do not claim learned win rates yet.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Hold public analysis beta",
      description:
        "Resolve resident coverage, runtime quality, cost, or feedback blockers before showing this preview to external reviewers.",
      executable: false,
    },
  ];
}
