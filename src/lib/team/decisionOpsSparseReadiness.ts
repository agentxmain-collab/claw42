import type { DecisionOpsSparseConfigGateReport } from "@/lib/team/decisionOpsSparseConfigGate";
import type { DecisionOpsSparseExecutionReport } from "@/lib/team/decisionOpsSparseExecution";
import type { DecisionOpsSparseShadowReport } from "@/lib/team/decisionOpsSparseShadow";
import type { DecisionOpsSparseShadowHistoryReport } from "@/lib/team/decisionOpsSparseShadowHistory";

export type DecisionOpsSparseReadinessStatus =
  | "collecting_trace"
  | "blocked_by_shadow_risk"
  | "ready_for_shadow_config"
  | "ready_for_shadow_telemetry";

export type DecisionOpsSparseReadinessLevel = "blocked" | "waiting" | "ready";

export interface DecisionOpsSparseReadinessAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseReadinessReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseReadinessStatus;
  readinessLevel: DecisionOpsSparseReadinessLevel;
  canProceedToShadowTelemetry: boolean;
  canChangeLiveFanout: false;
  canChangePublicBehavior: false;
  sourceStatuses: {
    sparseExecution: DecisionOpsSparseExecutionReport["status"];
    sparseShadow: DecisionOpsSparseShadowReport["status"];
    sparseShadowHistory: DecisionOpsSparseShadowHistoryReport["status"];
    sparseConfigGate: DecisionOpsSparseConfigGateReport["status"];
  };
  summary: {
    tracedRecords: number;
    traceCoverageRate: number | null;
    consecutiveSafeBatches: number;
    avoidedCallRate: number | null;
    missedContributions: number;
    missedWarnings: number;
    traceGaps: number;
  };
  blockingReasons: string[];
  nextActions: DecisionOpsSparseReadinessAction[];
}

export function buildDecisionOpsSparseReadiness({
  sparseExecution,
  sparseShadow,
  sparseShadowHistory,
  sparseConfigGate,
  now = Date.now(),
}: {
  sparseExecution: DecisionOpsSparseExecutionReport;
  sparseShadow: DecisionOpsSparseShadowReport;
  sparseShadowHistory: DecisionOpsSparseShadowHistoryReport;
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
  now?: number;
}): DecisionOpsSparseReadinessReport {
  const blockingReasons = blockingReasonsFor({
    sparseExecution,
    sparseShadow,
    sparseShadowHistory,
    sparseConfigGate,
  });
  const status = statusFor({
    sparseExecution,
    sparseShadow,
    sparseShadowHistory,
    sparseConfigGate,
  });
  const readinessLevel = readinessLevelFor(status);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    readinessLevel,
    canProceedToShadowTelemetry: status === "ready_for_shadow_telemetry",
    canChangeLiveFanout: false,
    canChangePublicBehavior: false,
    sourceStatuses: {
      sparseExecution: sparseExecution.status,
      sparseShadow: sparseShadow.status,
      sparseShadowHistory: sparseShadowHistory.status,
      sparseConfigGate: sparseConfigGate.status,
    },
    summary: {
      tracedRecords: sparseExecution.traceCoverage.recordsWithTrace,
      traceCoverageRate: sparseExecution.traceCoverage.coverageRate,
      consecutiveSafeBatches: sparseShadowHistory.stability.consecutiveSafeBatches,
      avoidedCallRate: sparseShadow.callModel.avoidedCallRate,
      missedContributions: sparseShadow.riskCounts.missedContributions,
      missedWarnings: sparseShadow.riskCounts.missedWarnings,
      traceGaps: sparseShadow.riskCounts.traceGaps,
    },
    blockingReasons,
    nextActions: nextActionsFor(status),
  };
}

function statusFor({
  sparseExecution,
  sparseShadow,
  sparseShadowHistory,
  sparseConfigGate,
}: {
  sparseExecution: DecisionOpsSparseExecutionReport;
  sparseShadow: DecisionOpsSparseShadowReport;
  sparseShadowHistory: DecisionOpsSparseShadowHistoryReport;
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
}): DecisionOpsSparseReadinessStatus {
  if (sparseExecution.status === "insufficient_trace_data") return "collecting_trace";
  if (!sparseShadow.safeToTrial || !sparseShadowHistory.safeToPrepareConfigGate) {
    return "blocked_by_shadow_risk";
  }
  if (!sparseConfigGate.configGateOpen || sparseConfigGate.status !== "shadow_ready") {
    return "ready_for_shadow_config";
  }
  return "ready_for_shadow_telemetry";
}

function readinessLevelFor(
  status: DecisionOpsSparseReadinessStatus,
): DecisionOpsSparseReadinessLevel {
  if (status === "blocked_by_shadow_risk") return "blocked";
  if (status === "ready_for_shadow_telemetry") return "ready";
  return "waiting";
}

function blockingReasonsFor({
  sparseExecution,
  sparseShadow,
  sparseShadowHistory,
  sparseConfigGate,
}: {
  sparseExecution: DecisionOpsSparseExecutionReport;
  sparseShadow: DecisionOpsSparseShadowReport;
  sparseShadowHistory: DecisionOpsSparseShadowHistoryReport;
  sparseConfigGate: DecisionOpsSparseConfigGateReport;
}) {
  const reasons: string[] = [];
  if (sparseExecution.status === "insufficient_trace_data") {
    reasons.push("insufficient_sparse_trace_data");
  }
  if (!sparseShadow.safeToTrial) {
    reasons.push("sparse_shadow_not_safe");
  }
  if (!sparseShadowHistory.safeToPrepareConfigGate) {
    reasons.push("sparse_shadow_history_not_ready");
  }
  if (sparseShadow.safeToTrial && sparseShadowHistory.safeToPrepareConfigGate) {
    if (!sparseConfigGate.configGateOpen || sparseConfigGate.status !== "shadow_ready") {
      reasons.push("sparse_config_gate_not_shadow_ready");
    }
  }
  return Array.from(new Set(reasons));
}

function nextActionsFor(
  status: DecisionOpsSparseReadinessStatus,
): DecisionOpsSparseReadinessAction[] {
  if (status === "ready_for_shadow_telemetry") {
    return [
      {
        title: "Add shadow telemetry without changing live fan-out",
        description:
          "The sparse diagnostics, shadow batches, and disabled config gate are aligned. The next step is telemetry-only shadow instrumentation; full PM fan-out and public behavior must remain unchanged.",
        executable: false,
      },
    ];
  }
  if (status === "ready_for_shadow_config") {
    return [
      {
        title: "Review sparse config gate before telemetry wiring",
        description:
          "Sparse shadow history is safe, but the runtime config gate is not open for shadow telemetry preparation yet.",
        executable: false,
      },
    ];
  }
  if (status === "blocked_by_shadow_risk") {
    return [
      {
        title: "Keep full PM fan-out until shadow risk is zero",
        description:
          "Sparse shadow diagnostics still show missed contributor, missed warning, or batch-history risk.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Collect more traced PM records",
      description:
        "Sparse execution policy needs more complete roleExecutionTrace coverage before shadow readiness can be evaluated.",
      executable: false,
    },
  ];
}
