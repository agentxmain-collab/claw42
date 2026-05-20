import type { DecisionOpsMemoryLearningReport } from "@/lib/team/decisionOpsMemoryLearning";
import type { DecisionOpsQueuePriorityPolicyReport } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import type { DecisionOpsResidentPublicVisibilityReport } from "@/lib/team/decisionOpsResidentPublicVisibility";
import type { DecisionOpsResidentPrewarmCoverageReport } from "@/lib/team/decisionOpsResidentPrewarmCoverage";
import type { DecisionOpsRuntimeQualityGateReport } from "@/lib/team/decisionOpsRuntimeQualityGate";

export type DecisionOpsGlobalProgressGateStatus =
  | "hold"
  | "ready_for_global_runtime_observe"
  | "ready_for_memory_learning_observe";

export interface DecisionOpsGlobalProgressGateAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsGlobalProgressGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsGlobalProgressGateStatus;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  sourceStatuses: {
    residentCoverage: DecisionOpsResidentPrewarmCoverageReport["status"];
    residentVisibility: DecisionOpsResidentPublicVisibilityReport["status"];
    queuePriority: DecisionOpsQueuePriorityPolicyReport["status"];
    runtimeQualityGate: DecisionOpsRuntimeQualityGateReport["status"];
    memoryLearning: DecisionOpsMemoryLearningReport["status"];
  };
  readiness: {
    globalResidentLanesReady: boolean;
    queueDrainReady: boolean;
    runtimeQualityReady: boolean;
    memoryLearningReady: boolean;
  };
  summary: {
    utcClock: "UTC";
    allGlobalLanesCovered: boolean;
    allResidentCardsVisible: boolean;
    residentPriorityActive: boolean;
    blockedLowerPriorityJobs: number;
    longRunningPreviewAllowed: boolean;
    memoryLoopLearningReady: boolean;
  };
  blockingReasons: string[];
  nextActions: DecisionOpsGlobalProgressGateAction[];
}

export function buildDecisionOpsGlobalProgressGate({
  residentCoverage,
  residentVisibility,
  queuePriority,
  runtimeQualityGate,
  memoryLearning,
  now = Date.now(),
}: {
  residentCoverage: DecisionOpsResidentPrewarmCoverageReport;
  residentVisibility: DecisionOpsResidentPublicVisibilityReport;
  queuePriority: DecisionOpsQueuePriorityPolicyReport;
  runtimeQualityGate: DecisionOpsRuntimeQualityGateReport;
  memoryLearning: DecisionOpsMemoryLearningReport;
  now?: number;
}): DecisionOpsGlobalProgressGateReport {
  const readiness = {
    globalResidentLanesReady:
      residentCoverage.status === "ready" &&
      residentCoverage.allGlobalLanesCovered &&
      residentVisibility.status === "ready" &&
      residentVisibility.allResidentCardsVisible,
    queueDrainReady:
      !queuePriority.residentPriorityActive && queuePriority.blockedLowerPriorityJobs.length === 0,
    runtimeQualityReady: runtimeQualityGate.longRunningPreviewAllowed,
    memoryLearningReady: memoryLearning.memoryLoopLearningReady,
  };
  const blockingReasons = blockingReasonsFor({
    residentCoverage,
    residentVisibility,
    runtimeQualityGate,
    memoryLearning,
    readiness,
  });
  const status = statusFor(readiness);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    sourceStatuses: {
      residentCoverage: residentCoverage.status,
      residentVisibility: residentVisibility.status,
      queuePriority: queuePriority.status,
      runtimeQualityGate: runtimeQualityGate.status,
      memoryLearning: memoryLearning.status,
    },
    readiness,
    summary: {
      utcClock: "UTC",
      allGlobalLanesCovered: residentCoverage.allGlobalLanesCovered,
      allResidentCardsVisible: residentVisibility.allResidentCardsVisible,
      residentPriorityActive: queuePriority.residentPriorityActive,
      blockedLowerPriorityJobs: queuePriority.blockedLowerPriorityJobs.length,
      longRunningPreviewAllowed: runtimeQualityGate.longRunningPreviewAllowed,
      memoryLoopLearningReady: memoryLearning.memoryLoopLearningReady,
    },
    blockingReasons,
    nextActions: nextActionsFor(status),
  };
}

function blockingReasonsFor({
  residentCoverage,
  residentVisibility,
  runtimeQualityGate,
  memoryLearning,
  readiness,
}: {
  residentCoverage: DecisionOpsResidentPrewarmCoverageReport;
  residentVisibility: DecisionOpsResidentPublicVisibilityReport;
  runtimeQualityGate: DecisionOpsRuntimeQualityGateReport;
  memoryLearning: DecisionOpsMemoryLearningReport;
  readiness: DecisionOpsGlobalProgressGateReport["readiness"];
}) {
  const reasons: string[] = [];
  if (
    residentCoverage.status !== "ready" ||
    !residentCoverage.allGlobalLanesCovered ||
    !readiness.globalResidentLanesReady
  ) {
    reasons.push(...residentCoverage.blockingReasons, "resident_prewarm_not_ready");
  }
  if (residentVisibility.status !== "ready" || !residentVisibility.allResidentCardsVisible) {
    reasons.push(...residentVisibility.blockingReasons, "resident_public_visibility_not_ready");
  }
  if (!readiness.queueDrainReady) {
    reasons.push("resident_queue_draining");
  }
  if (!readiness.runtimeQualityReady) {
    reasons.push(...runtimeQualityGate.blockingReasons, "runtime_quality_gate_not_ready");
  }
  if (!readiness.memoryLearningReady) {
    reasons.push(...memoryLearning.blockingReasons, "memory_learning_not_ready");
  }
  return Array.from(new Set(reasons));
}

function statusFor(
  readiness: DecisionOpsGlobalProgressGateReport["readiness"],
): DecisionOpsGlobalProgressGateStatus {
  if (
    !readiness.globalResidentLanesReady ||
    !readiness.queueDrainReady ||
    !readiness.runtimeQualityReady
  ) {
    return "hold";
  }
  return readiness.memoryLearningReady
    ? "ready_for_memory_learning_observe"
    : "ready_for_global_runtime_observe";
}

function nextActionsFor(
  status: DecisionOpsGlobalProgressGateStatus,
): DecisionOpsGlobalProgressGateAction[] {
  if (status === "ready_for_memory_learning_observe") {
    return [
      {
        title: "Continue B-line preview observation",
        description:
          "Global resident lanes, queue drain, runtime quality, and memory learning gates are clean. Production remains locked.",
        executable: false,
      },
    ];
  }
  if (status === "ready_for_global_runtime_observe") {
    return [
      {
        title: "Keep memory loop in observe mode",
        description:
          "Global resident analysis can keep running, but memory learning must accumulate resolved samples before becoming a product claim.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Hold global B-line expansion",
      description:
        "Resolve resident coverage, public visibility, queue drain, or runtime quality blockers before increasing cadence or model cost.",
      executable: false,
    },
  ];
}
