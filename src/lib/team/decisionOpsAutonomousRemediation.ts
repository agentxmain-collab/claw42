import type { DecisionOpsGlobalPrewarmPlanReport } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import type { DecisionOpsGlobalProgressGateReport } from "@/lib/team/decisionOpsGlobalProgressGate";
import type { DecisionOpsPublicOutputStabilityReport } from "@/lib/team/decisionOpsPublicOutputStability";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import { RESIDENT_PREWARM_EXECUTOR_CONFIRMATION } from "@/lib/team/decisionOpsResidentPrewarmExecutor";

export type DecisionOpsAutonomousRemediationStatus =
  | "observe"
  | "resident_prewarm_ready"
  | "operator_required"
  | "paused";

export type DecisionOpsSafeAutomationLevel = "none" | "resident_prewarm_only";

export type DecisionOpsAutonomousRemediationKind =
  | "enqueue_resident_market_overview"
  | "enqueue_resident_hotspot"
  | "inspect_public_projection"
  | "pause_new_triggers";

export interface DecisionOpsAutonomousRemediationItem {
  kind: DecisionOpsAutonomousRemediationKind;
  title: string;
  description: string;
  executable: false;
  evidence: string[];
  operatorEndpoint?: {
    method: "POST";
    path: string;
    confirmationHeader: "x-claw42-resident-prewarm-confirm";
    confirmationValue: typeof RESIDENT_PREWARM_EXECUTOR_CONFIRMATION;
    requiredEnv: string[];
  };
}

export interface DecisionOpsResidentPrewarmExecutorReadiness {
  ledgerEnqueueReady: boolean;
  queuePublishReady: boolean;
  queuePublishEndpoint: "/api/watch/ops-resident-prewarm?mode=execute&publishQueue=true";
  requiredEnv: {
    executorEnabled: boolean;
    queuePublishEnabled: boolean;
    pmDecisionQueueEnabled: boolean;
  };
}

export interface DecisionOpsAutonomousRemediationReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsAutonomousRemediationStatus;
  safeAutomationLevel: DecisionOpsSafeAutomationLevel;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  sourceStatuses: {
    globalProgress: DecisionOpsGlobalProgressGateReport["status"];
    globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport["status"];
    queueRecoveryPolicy: DecisionOpsQueueRecoveryPolicy["status"];
    outputStability: DecisionOpsPublicOutputStabilityReport["status"];
  };
  blockingReasons: string[];
  residentPrewarmExecutor: DecisionOpsResidentPrewarmExecutorReadiness;
  remediations: DecisionOpsAutonomousRemediationItem[];
}

const OUTPUT_OPERATOR_ISSUES = new Set<DecisionOpsPublicOutputStabilityReport["primaryIssue"]>([
  "duplicate_candidate_card",
  "stage_progress_gap",
  "unstable_order",
  "missing_stage_trace",
]);

export function buildDecisionOpsAutonomousRemediation({
  globalProgress,
  globalPrewarmPlan,
  queueRecoveryPolicy,
  outputStability,
  residentPrewarmExecutor,
  now = Date.now(),
}: {
  globalProgress: DecisionOpsGlobalProgressGateReport;
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  queueRecoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  outputStability: DecisionOpsPublicOutputStabilityReport;
  residentPrewarmExecutor?: {
    executorEnabled: boolean;
    queuePublishEnabled: boolean;
    queueReady: boolean;
  };
  now?: number;
}): DecisionOpsAutonomousRemediationReport {
  const blockingReasons = blockingReasonsFor({
    queueRecoveryPolicy,
    outputStability,
    globalPrewarmPlan,
  });
  const status = statusFor({ blockingReasons, globalPrewarmPlan, globalProgress });
  const safeAutomationLevel: DecisionOpsSafeAutomationLevel =
    status === "resident_prewarm_ready" ? "resident_prewarm_only" : "none";
  const executorReadiness = residentPrewarmExecutorReadiness(residentPrewarmExecutor);

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    safeAutomationLevel,
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    sourceStatuses: {
      globalProgress: globalProgress.status,
      globalPrewarmPlan: globalPrewarmPlan.status,
      queueRecoveryPolicy: queueRecoveryPolicy.status,
      outputStability: outputStability.status,
    },
    blockingReasons,
    residentPrewarmExecutor: executorReadiness,
    remediations: remediationsFor({
      status,
      globalPrewarmPlan,
      outputStability,
      residentPrewarmExecutor: executorReadiness,
    }),
  };
}

function residentPrewarmExecutorReadiness(
  value:
    | {
        executorEnabled: boolean;
        queuePublishEnabled: boolean;
        queueReady: boolean;
      }
    | undefined,
): DecisionOpsResidentPrewarmExecutorReadiness {
  const executorEnabled = value?.executorEnabled === true;
  const queuePublishEnabled = value?.queuePublishEnabled === true;
  const pmDecisionQueueEnabled = value?.queueReady === true;
  return {
    ledgerEnqueueReady: executorEnabled,
    queuePublishReady: executorEnabled && queuePublishEnabled && pmDecisionQueueEnabled,
    queuePublishEndpoint: "/api/watch/ops-resident-prewarm?mode=execute&publishQueue=true",
    requiredEnv: {
      executorEnabled,
      queuePublishEnabled,
      pmDecisionQueueEnabled,
    },
  };
}

function blockingReasonsFor({
  queueRecoveryPolicy,
  outputStability,
  globalPrewarmPlan,
}: {
  queueRecoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  outputStability: DecisionOpsPublicOutputStabilityReport;
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
}) {
  const reasons: string[] = [];
  if (
    queueRecoveryPolicy.shouldPauseNewTriggers ||
    queueRecoveryPolicy.mode === "pause_new_triggers"
  ) {
    reasons.push("queue_recovery_requires_trigger_pause");
  }
  if (OUTPUT_OPERATOR_ISSUES.has(outputStability.primaryIssue)) {
    reasons.push("public_output_requires_operator_diagnosis");
  }
  if (globalPrewarmPlan.status === "blocked_by_queue") {
    reasons.push(...globalPrewarmPlan.blockingReasons);
  }
  return Array.from(new Set(reasons));
}

function statusFor({
  blockingReasons,
  globalPrewarmPlan,
  globalProgress,
}: {
  blockingReasons: readonly string[];
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  globalProgress: DecisionOpsGlobalProgressGateReport;
}): DecisionOpsAutonomousRemediationStatus {
  if (blockingReasons.includes("queue_recovery_requires_trigger_pause")) return "paused";
  if (blockingReasons.length > 0) return "operator_required";
  if (globalPrewarmPlan.safeToEnqueueResidentPrewarm) return "resident_prewarm_ready";
  return globalProgress.status === "hold" ? "operator_required" : "observe";
}

function remediationsFor({
  status,
  globalPrewarmPlan,
  outputStability,
  residentPrewarmExecutor,
}: {
  status: DecisionOpsAutonomousRemediationStatus;
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  outputStability: DecisionOpsPublicOutputStabilityReport;
  residentPrewarmExecutor: DecisionOpsResidentPrewarmExecutorReadiness;
}): DecisionOpsAutonomousRemediationItem[] {
  if (status === "paused") {
    return [
      {
        kind: "pause_new_triggers",
        title: "Pause new trigger pressure",
        description:
          "Queue recovery has priority. Do not add resident, symbol, or batch work until the queue clears.",
        executable: false,
        evidence: ["queue_recovery_requires_trigger_pause"],
      },
    ];
  }
  if (status === "resident_prewarm_ready") {
    const endpoint = residentPrewarmOperatorEndpoint();
    const executionEvidence = residentPrewarmExecutionEvidence(residentPrewarmExecutor);
    return globalPrewarmPlan.targets
      .filter((target) => target.shouldEnqueue)
      .map((target) => ({
        kind:
          target.kind === "market_overview"
            ? "enqueue_resident_market_overview"
            : "enqueue_resident_hotspot",
        title:
          target.kind === "market_overview"
            ? "Enqueue UTC market overview"
            : "Enqueue UTC hotspot watch",
        description:
          "Safe resident-only remediation. This report remains read-only; an executor must explicitly consume the plan.",
        executable: false,
        evidence: [target.reason, target.candidate.candidateKey, ...executionEvidence],
        operatorEndpoint: endpoint,
      }));
  }
  if (status === "operator_required") {
    return [
      {
        kind: "inspect_public_projection",
        title: "Inspect public output before automation",
        description:
          "Duplicate cards, skipped stages, unstable ordering, or unresolved global blockers require diagnosis before automated replay.",
        executable: false,
        evidence: [
          outputStability.primaryIssue ?? "global_progress_hold",
          ...globalPrewarmPlan.blockingReasons,
        ],
      },
    ];
  }
  return [];
}

function residentPrewarmOperatorEndpoint(): NonNullable<
  DecisionOpsAutonomousRemediationItem["operatorEndpoint"]
> {
  return {
    method: "POST" as const,
    path: "/api/watch/ops-resident-prewarm?mode=execute&publishQueue=true",
    confirmationHeader: "x-claw42-resident-prewarm-confirm" as const,
    confirmationValue: RESIDENT_PREWARM_EXECUTOR_CONFIRMATION,
    requiredEnv: [
      "OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED=true",
      "OPS_RESIDENT_PREWARM_QUEUE_PUBLISH_ENABLED=true",
      "PM_DECISION_QUEUE_ENABLED=true",
    ],
  };
}

function residentPrewarmExecutionEvidence(readiness: DecisionOpsResidentPrewarmExecutorReadiness) {
  const evidence = [
    readiness.ledgerEnqueueReady
      ? "resident_ledger_enqueue_ready"
      : "resident_ledger_enqueue_not_ready",
    readiness.queuePublishReady
      ? "resident_queue_publish_ready"
      : "resident_queue_publish_not_ready",
  ];
  if (!readiness.requiredEnv.executorEnabled) {
    evidence.push("OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED=false");
  }
  if (!readiness.requiredEnv.queuePublishEnabled) {
    evidence.push("OPS_RESIDENT_PREWARM_QUEUE_PUBLISH_ENABLED=false");
  }
  if (!readiness.requiredEnv.pmDecisionQueueEnabled) {
    evidence.push("PM_DECISION_QUEUE_ENABLED=false");
  }
  return evidence;
}
