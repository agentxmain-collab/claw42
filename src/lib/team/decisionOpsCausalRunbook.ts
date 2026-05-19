import type {
  DecisionOpsChainRootCause,
  DecisionOpsChainRunbook,
} from "@/lib/team/decisionOpsChainRunbook";
import type {
  DecisionOpsPublicOutputStabilityIssueType,
  DecisionOpsPublicOutputStabilityReport,
} from "@/lib/team/decisionOpsPublicOutputStability";
import type {
  DecisionOpsQualityBaselineIssueType,
  DecisionOpsQualityBaselineReport,
} from "@/lib/team/decisionOpsQualityBaseline";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import type {
  DecisionOpsStabilityIssueType,
  DecisionOpsStabilityReport,
} from "@/lib/team/decisionOpsStability";

export type DecisionOpsCausalRunbookStatus = "healthy" | "degraded" | "critical";

export type DecisionOpsCausalLayerId =
  | "schedule_to_public_chain"
  | "queue_and_cron_stability"
  | "public_output_surface"
  | "model_quality_baseline"
  | "recovery_policy";

export type DecisionOpsCausalIssue =
  | DecisionOpsChainRootCause
  | DecisionOpsStabilityIssueType
  | DecisionOpsPublicOutputStabilityIssueType
  | DecisionOpsQualityBaselineIssueType
  | DecisionOpsQueueRecoveryPolicy["mode"];

export interface DecisionOpsCausalDiagnosisStep {
  layer: DecisionOpsCausalLayerId;
  status: DecisionOpsCausalRunbookStatus;
  issue: DecisionOpsCausalIssue | null;
  headline: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface DecisionOpsCausalRunbookAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsCausalRunbook {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsCausalRunbookStatus;
  primaryLayer: DecisionOpsCausalLayerId | null;
  primaryIssue: DecisionOpsCausalIssue | null;
  alert: {
    severity: DecisionOpsCausalRunbookStatus;
    shouldNotify: boolean;
    dedupeKey: string | null;
    cooldownMs: number | null;
  };
  summary: string;
  diagnosis: DecisionOpsCausalDiagnosisStep[];
  actions: DecisionOpsCausalRunbookAction[];
}

const LAYER_PRIORITY: DecisionOpsCausalLayerId[] = [
  "schedule_to_public_chain",
  "queue_and_cron_stability",
  "public_output_surface",
  "model_quality_baseline",
  "recovery_policy",
];

const STATUS_RANK: Record<DecisionOpsCausalRunbookStatus, number> = {
  healthy: 0,
  degraded: 1,
  critical: 2,
};

const CRITICAL_ALERT_COOLDOWN_MS = 15 * 60_000;
const DEGRADED_ALERT_COOLDOWN_MS = 60 * 60_000;

export function buildDecisionOpsCausalRunbook({
  runbook,
  recoveryPolicy,
  stability,
  outputStability,
  qualityBaseline,
  now = Date.now(),
}: {
  runbook: DecisionOpsChainRunbook;
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy;
  stability: DecisionOpsStabilityReport;
  outputStability: DecisionOpsPublicOutputStabilityReport;
  qualityBaseline: DecisionOpsQualityBaselineReport;
  now?: number;
}): DecisionOpsCausalRunbook {
  const diagnosis = [
    scheduleToPublicStep(runbook),
    queueAndCronStep(stability),
    publicOutputStep(outputStability),
    qualityBaselineStep(qualityBaseline),
    recoveryPolicyStep(recoveryPolicy),
  ];
  const status = highestStatus(diagnosis);
  const primary = primaryStepFor(diagnosis, status) ?? null;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    primaryLayer: primary?.layer ?? null,
    primaryIssue: primary?.issue ?? null,
    alert: alertFor(status, primary),
    summary: summaryFor(status, primary),
    diagnosis,
    actions: actionsFor(primary, {
      runbook,
      recoveryPolicy,
      stability,
      outputStability,
      qualityBaseline,
    }),
  };
}

function scheduleToPublicStep(runbook: DecisionOpsChainRunbook): DecisionOpsCausalDiagnosisStep {
  return {
    layer: "schedule_to_public_chain",
    status: runbook.status,
    issue: runbook.rootCause === "public_output_recent" ? null : runbook.rootCause,
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

function queueAndCronStep(stability: DecisionOpsStabilityReport): DecisionOpsCausalDiagnosisStep {
  return {
    layer: "queue_and_cron_stability",
    status: stability.status,
    issue: stability.primaryIssue,
    headline:
      stability.primaryIssue === null
        ? "Long-window queue and cron stability are within guardrails."
        : `Queue or cron stability issue: ${stability.primaryIssue}.`,
    evidence: {
      primaryIssue: stability.primaryIssue,
      issueCount: stability.issues.length,
      windowCount: stability.windows.length,
    },
  };
}

function publicOutputStep(
  outputStability: DecisionOpsPublicOutputStabilityReport,
): DecisionOpsCausalDiagnosisStep {
  return {
    layer: "public_output_surface",
    status: outputStability.status,
    issue: outputStability.primaryIssue,
    headline:
      outputStability.primaryIssue === null
        ? "Public output cards are unique, ordered, and stage-complete."
        : `Public output surface issue: ${outputStability.primaryIssue}.`,
    evidence: {
      publicPmEvents: outputStability.counts.publicPmEvents,
      uniqueCandidateCards: outputStability.counts.uniqueCandidateCards,
      duplicateCandidateCards: outputStability.counts.duplicateCandidateCards,
      unstableOrderEvents: outputStability.counts.unstableOrderEvents,
      stageProgressGaps: outputStability.counts.stageProgressGaps,
      missingStageTraceEvents: outputStability.counts.missingStageTraceEvents,
    },
  };
}

function qualityBaselineStep(
  qualityBaseline: DecisionOpsQualityBaselineReport,
): DecisionOpsCausalDiagnosisStep {
  return {
    layer: "model_quality_baseline",
    status: qualityBaseline.status,
    issue: qualityBaseline.primaryIssue,
    headline:
      qualityBaseline.primaryIssue === null
        ? "Model quality baseline has enough clean public samples."
        : `Model quality baseline issue: ${qualityBaseline.primaryIssue}.`,
    evidence: {
      primaryIssue: qualityBaseline.primaryIssue,
      ready: qualityBaseline.baseline.ready,
      scoredRuns: qualityBaseline.baseline.scoredRuns,
      candidateTypesCovered: qualityBaseline.baseline.candidateTypesCovered,
      providerCount: qualityBaseline.baseline.providerCount,
    },
  };
}

function recoveryPolicyStep(
  recoveryPolicy: DecisionOpsQueueRecoveryPolicy,
): DecisionOpsCausalDiagnosisStep {
  return {
    layer: "recovery_policy",
    status: recoveryPolicy.status,
    issue: recoveryPolicy.status === "healthy" ? null : recoveryPolicy.mode,
    headline: recoveryPolicy.primaryAction ?? "Recovery policy does not require intervention.",
    evidence: {
      mode: recoveryPolicy.mode,
      shouldPauseNewTriggers: recoveryPolicy.shouldPauseNewTriggers,
      autoRecoveryAllowed: recoveryPolicy.autoRecoveryAllowed,
      recoverySteps: recoveryPolicy.recoverySteps.length,
    },
  };
}

function highestStatus(
  diagnosis: readonly DecisionOpsCausalDiagnosisStep[],
): DecisionOpsCausalRunbookStatus {
  return diagnosis.reduce<DecisionOpsCausalRunbookStatus>(
    (current, step) => (STATUS_RANK[step.status] > STATUS_RANK[current] ? step.status : current),
    "healthy",
  );
}

function primaryStepFor(
  diagnosis: readonly DecisionOpsCausalDiagnosisStep[],
  status: DecisionOpsCausalRunbookStatus,
) {
  if (status === "healthy") return null;
  return LAYER_PRIORITY.map((layer) => diagnosis.find((step) => step.layer === layer)).find(
    (step): step is DecisionOpsCausalDiagnosisStep => Boolean(step && step.status === status),
  );
}

function alertFor(
  status: DecisionOpsCausalRunbookStatus,
  primary: DecisionOpsCausalDiagnosisStep | null,
) {
  return {
    severity: status,
    shouldNotify: status !== "healthy",
    dedupeKey: primary && primary.issue ? `ops-causal:${primary.layer}:${primary.issue}` : null,
    cooldownMs:
      status === "critical"
        ? CRITICAL_ALERT_COOLDOWN_MS
        : status === "degraded"
          ? DEGRADED_ALERT_COOLDOWN_MS
          : null,
  };
}

function summaryFor(
  status: DecisionOpsCausalRunbookStatus,
  primary: DecisionOpsCausalDiagnosisStep | null,
) {
  if (status === "healthy" || !primary || !primary.issue) {
    return "Ops diagnostics do not currently require an alert.";
  }
  return `Primary ops cause is ${primary.issue} in ${primary.layer}.`;
}

function actionsFor(
  primary: DecisionOpsCausalDiagnosisStep | null,
  reports: {
    runbook: DecisionOpsChainRunbook;
    recoveryPolicy: DecisionOpsQueueRecoveryPolicy;
    stability: DecisionOpsStabilityReport;
    outputStability: DecisionOpsPublicOutputStabilityReport;
    qualityBaseline: DecisionOpsQualityBaselineReport;
  },
): DecisionOpsCausalRunbookAction[] {
  if (!primary) return [];
  if (primary.layer === "schedule_to_public_chain") return reports.runbook.runbookActions;
  if (primary.layer === "queue_and_cron_stability") return reports.stability.actions;
  if (primary.layer === "public_output_surface") return reports.outputStability.actions;
  if (primary.layer === "model_quality_baseline") return reports.qualityBaseline.actions;
  return reports.recoveryPolicy.primaryAction
    ? [
        {
          title: reports.recoveryPolicy.primaryAction,
          description: "Review recovery policy evidence before changing queue or replay behavior.",
          executable: false,
        },
      ]
    : [];
}
