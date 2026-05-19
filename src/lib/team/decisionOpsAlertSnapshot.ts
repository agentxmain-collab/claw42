import type {
  DecisionOpsCausalDiagnosisStep,
  DecisionOpsCausalIssue,
  DecisionOpsCausalLayerId,
  DecisionOpsCausalRunbook,
  DecisionOpsCausalRunbookAction,
  DecisionOpsCausalRunbookStatus,
} from "@/lib/team/decisionOpsCausalRunbook";

export interface DecisionOpsActiveAlert {
  severity: Exclude<DecisionOpsCausalRunbookStatus, "healthy">;
  layer: DecisionOpsCausalLayerId;
  issue: DecisionOpsCausalIssue;
  evidence: Record<string, string | number | boolean | null>;
}

export interface DecisionOpsAlertSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsCausalRunbookStatus;
  shouldNotify: boolean;
  activeAlert: DecisionOpsActiveAlert | null;
  repeatGuard: {
    dedupeKey: string | null;
    cooldownMs: number | null;
    nextEligibleAt: string | null;
  };
  operatorSummary: string;
  recommendedActions: DecisionOpsCausalRunbookAction[];
}

export function buildDecisionOpsAlertSnapshot({
  causalRunbook,
  now = Date.now(),
}: {
  causalRunbook: DecisionOpsCausalRunbook;
  now?: number;
}): DecisionOpsAlertSnapshot {
  const activeStep = activeStepFor(causalRunbook);
  const cooldownMs = causalRunbook.alert.cooldownMs;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: causalRunbook.status,
    shouldNotify: causalRunbook.alert.shouldNotify,
    activeAlert:
      activeStep && activeStep.issue && activeStep.status !== "healthy"
        ? {
            severity: activeStep.status,
            layer: activeStep.layer,
            issue: activeStep.issue,
            evidence: activeStep.evidence,
          }
        : null,
    repeatGuard: {
      dedupeKey: causalRunbook.alert.dedupeKey,
      cooldownMs,
      nextEligibleAt:
        cooldownMs === null || !causalRunbook.alert.dedupeKey
          ? null
          : new Date(now + cooldownMs).toISOString(),
    },
    operatorSummary: operatorSummaryFor(causalRunbook),
    recommendedActions: causalRunbook.actions,
  };
}

function activeStepFor(
  causalRunbook: DecisionOpsCausalRunbook,
): DecisionOpsCausalDiagnosisStep | null {
  if (!causalRunbook.primaryLayer) return null;
  return causalRunbook.diagnosis.find((step) => step.layer === causalRunbook.primaryLayer) ?? null;
}

function operatorSummaryFor(causalRunbook: DecisionOpsCausalRunbook) {
  if (
    !causalRunbook.alert.shouldNotify ||
    !causalRunbook.primaryLayer ||
    !causalRunbook.primaryIssue
  ) {
    return "No ops alert is active.";
  }
  return `Active ops alert: ${causalRunbook.primaryIssue} in ${causalRunbook.primaryLayer}.`;
}
