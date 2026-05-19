import type { DecisionOpsSparseReadinessReport } from "@/lib/team/decisionOpsSparseReadiness";
import type { DecisionOpsSparseShadowTelemetryReport } from "@/lib/team/decisionOpsSparseShadowTelemetry";

export type DecisionOpsSparseOperatorReportStatus = "hold" | "shadow_telemetry_ready";

export interface DecisionOpsSparseOperatorDecision {
  area: "readiness" | "telemetry" | "runtime_boundary";
  status: "pass" | "hold";
  rationale: string;
}

export interface DecisionOpsSparseOperatorAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseOperatorReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseOperatorReportStatus;
  headline: string;
  canProceedToShadowTelemetry: boolean;
  canChangeLiveFanout: false;
  canChangePublicBehavior: false;
  decisions: DecisionOpsSparseOperatorDecision[];
  blockingReasons: string[];
  nextActions: DecisionOpsSparseOperatorAction[];
}

export function buildDecisionOpsSparseOperatorReport({
  sparseReadiness,
  sparseTelemetry,
  now = Date.now(),
}: {
  sparseReadiness: DecisionOpsSparseReadinessReport;
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
  now?: number;
}): DecisionOpsSparseOperatorReport {
  const blockingReasons = blockingReasonsFor({ sparseReadiness, sparseTelemetry });
  const canProceedToShadowTelemetry = blockingReasons.length === 0;
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: canProceedToShadowTelemetry ? "shadow_telemetry_ready" : "hold",
    headline: canProceedToShadowTelemetry
      ? "Sparse diagnostics are ready for telemetry-only shadow work."
      : "Sparse diagnostics are not ready for the next shadow step.",
    canProceedToShadowTelemetry,
    canChangeLiveFanout: false,
    canChangePublicBehavior: false,
    decisions: [
      {
        area: "readiness",
        status: sparseReadiness.canProceedToShadowTelemetry ? "pass" : "hold",
        rationale: sparseReadiness.blockingReasons.join(", ") || sparseReadiness.status,
      },
      {
        area: "telemetry",
        status: sparseTelemetry.canRecordShadowTelemetry ? "pass" : "hold",
        rationale: sparseTelemetry.status,
      },
      {
        area: "runtime_boundary",
        status: "pass",
        rationale: "Live PM fan-out and public behavior remain locked.",
      },
    ],
    blockingReasons,
    nextActions: nextActionsFor(canProceedToShadowTelemetry),
  };
}

function blockingReasonsFor({
  sparseReadiness,
  sparseTelemetry,
}: {
  sparseReadiness: DecisionOpsSparseReadinessReport;
  sparseTelemetry: DecisionOpsSparseShadowTelemetryReport;
}) {
  const reasons: string[] = [];
  if (!sparseReadiness.canProceedToShadowTelemetry) {
    reasons.push(...sparseReadiness.blockingReasons);
  }
  if (!sparseTelemetry.canRecordShadowTelemetry) {
    reasons.push("sparse_shadow_telemetry_risk_detected");
  }
  return Array.from(new Set(reasons));
}

function nextActionsFor(canProceedToShadowTelemetry: boolean): DecisionOpsSparseOperatorAction[] {
  if (canProceedToShadowTelemetry) {
    return [
      {
        title: "Prepare telemetry-only sparse shadow runtime",
        description:
          "Operators can wire the runtime plan to record sparse choices without changing live PM fan-out.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Hold sparse runtime work",
      description:
        "Resolve readiness or telemetry blockers before planning sparse runtime instrumentation.",
      executable: false,
    },
  ];
}
