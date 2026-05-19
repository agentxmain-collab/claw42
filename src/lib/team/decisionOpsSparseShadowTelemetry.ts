import type {
  DecisionOpsSparseShadowReport,
  DecisionOpsSparseShadowRisk,
} from "@/lib/team/decisionOpsSparseShadow";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";

export type DecisionOpsSparseShadowTelemetryStatus =
  | "insufficient_data"
  | "risk_detected"
  | "telemetry_ready";

export type DecisionOpsSparseShadowTelemetryRecommendation =
  | "collect_more_trace"
  | "keep_full_team"
  | "candidate_ready_for_shadow";

export interface DecisionOpsSparseShadowTelemetryCandidateType {
  candidateType: CandidateType;
  recordsEvaluated: number;
  safeRecords: number;
  riskyRecords: number;
  avoidedCallRate: number | null;
  riskCounts: {
    missedContributions: number;
    missedWarnings: number;
    traceGaps: number;
  };
  recommendation: DecisionOpsSparseShadowTelemetryRecommendation;
}

export interface DecisionOpsSparseShadowTelemetryRoleRisk {
  memberId: TeamMemberId;
  riskCount: number;
  riskTypes: string[];
}

export interface DecisionOpsSparseShadowTelemetryAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseShadowTelemetryReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseShadowTelemetryStatus;
  telemetryMode: "shadow_only";
  canRecordShadowTelemetry: boolean;
  liveFanoutChanged: false;
  publicBehaviorChanged: false;
  summary: {
    recordsEvaluated: number;
    safeRecords: number;
    riskyRecords: number;
    avoidedCallRate: number | null;
    missedContributions: number;
    missedWarnings: number;
    traceGaps: number;
  };
  candidateTypes: DecisionOpsSparseShadowTelemetryCandidateType[];
  roleRiskHighlights: DecisionOpsSparseShadowTelemetryRoleRisk[];
  recommendations: DecisionOpsSparseShadowTelemetryAction[];
}

const CANDIDATE_TYPES: CandidateType[] = ["market_overview", "hotspot", "symbol"];

export function buildDecisionOpsSparseShadowTelemetry({
  records,
  sparseShadow,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  sparseShadow: DecisionOpsSparseShadowReport;
  now?: number;
}): DecisionOpsSparseShadowTelemetryReport {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const outcomes = sparseShadow.recordOutcomes;
  const safeRecords = outcomes.filter((outcome) => outcome.safe).length;
  const riskyRecords = outcomes.length - safeRecords;
  const status = statusFor({ sparseShadow, recordsEvaluated: outcomes.length, riskyRecords });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    telemetryMode: "shadow_only",
    canRecordShadowTelemetry: status === "telemetry_ready",
    liveFanoutChanged: false,
    publicBehaviorChanged: false,
    summary: {
      recordsEvaluated: outcomes.length,
      safeRecords,
      riskyRecords,
      avoidedCallRate: sparseShadow.callModel.avoidedCallRate,
      missedContributions: sparseShadow.riskCounts.missedContributions,
      missedWarnings: sparseShadow.riskCounts.missedWarnings,
      traceGaps: sparseShadow.riskCounts.traceGaps,
    },
    candidateTypes: candidateTelemetryFor({
      sparseShadow,
      recordsById,
    }),
    roleRiskHighlights: roleRiskHighlights(
      sparseShadow.recordOutcomes.flatMap((outcome) => outcome.risks),
    ),
    recommendations: recommendationsFor(status),
  };
}

function statusFor({
  sparseShadow,
  recordsEvaluated,
  riskyRecords,
}: {
  sparseShadow: DecisionOpsSparseShadowReport;
  recordsEvaluated: number;
  riskyRecords: number;
}): DecisionOpsSparseShadowTelemetryStatus {
  if (sparseShadow.status === "insufficient_trace_data" || recordsEvaluated === 0) {
    return "insufficient_data";
  }
  if (
    !sparseShadow.safeToTrial ||
    sparseShadow.status === "shadow_risk_detected" ||
    riskyRecords > 0
  ) {
    return "risk_detected";
  }
  return "telemetry_ready";
}

function candidateTelemetryFor({
  sparseShadow,
  recordsById,
}: {
  sparseShadow: DecisionOpsSparseShadowReport;
  recordsById: ReadonlyMap<string, StrategyDecisionRecord>;
}) {
  return CANDIDATE_TYPES.map((candidateType) => {
    const outcomes = sparseShadow.recordOutcomes.filter((outcome) => {
      const record = recordsById.get(outcome.recordId);
      return normalizeCandidateType(record?.candidate?.candidateType) === candidateType;
    });
    const fullTeamCalls = outcomes.reduce((total, outcome) => total + outcome.fullTeamCalls, 0);
    const avoidedCalls = outcomes.reduce((total, outcome) => total + outcome.avoidedCalls, 0);
    const risks = outcomes.flatMap((outcome) => outcome.risks);
    const safeRecords = outcomes.filter((outcome) => outcome.safe).length;
    const riskyRecords = outcomes.length - safeRecords;
    return {
      candidateType,
      recordsEvaluated: outcomes.length,
      safeRecords,
      riskyRecords,
      avoidedCallRate: fullTeamCalls > 0 ? roundRatio(avoidedCalls / fullTeamCalls) : null,
      riskCounts: riskCountsFor(risks),
      recommendation: recommendationFor({
        candidateType,
        recordsEvaluated: outcomes.length,
        riskyRecords,
      }),
    };
  }).filter((entry) => entry.recordsEvaluated > 0);
}

function recommendationFor({
  candidateType,
  recordsEvaluated,
  riskyRecords,
}: {
  candidateType: CandidateType;
  recordsEvaluated: number;
  riskyRecords: number;
}): DecisionOpsSparseShadowTelemetryRecommendation {
  if (recordsEvaluated === 0) return "collect_more_trace";
  if (candidateType === "market_overview" || riskyRecords > 0) return "keep_full_team";
  return "candidate_ready_for_shadow";
}

function riskCountsFor(risks: readonly DecisionOpsSparseShadowRisk[]) {
  return {
    missedContributions: risks.filter((risk) => risk.riskType === "would_skip_contributor").length,
    missedWarnings: risks.filter((risk) => risk.riskType === "would_skip_warning").length,
    traceGaps: risks.filter((risk) => risk.riskType === "trace_gap").length,
  };
}

function roleRiskHighlights(risks: readonly DecisionOpsSparseShadowRisk[]) {
  const byMember = new Map<TeamMemberId, DecisionOpsSparseShadowTelemetryRoleRisk>();
  for (const risk of risks) {
    const entry =
      byMember.get(risk.memberId) ??
      ({
        memberId: risk.memberId,
        riskCount: 0,
        riskTypes: [],
      } satisfies DecisionOpsSparseShadowTelemetryRoleRisk);
    entry.riskCount += 1;
    if (!entry.riskTypes.includes(risk.riskType)) entry.riskTypes.push(risk.riskType);
    byMember.set(risk.memberId, entry);
  }
  return Array.from(byMember.values()).sort((left, right) => {
    const countDelta = right.riskCount - left.riskCount;
    if (countDelta !== 0) return countDelta;
    return left.memberId.localeCompare(right.memberId);
  });
}

function recommendationsFor(
  status: DecisionOpsSparseShadowTelemetryStatus,
): DecisionOpsSparseShadowTelemetryAction[] {
  if (status === "telemetry_ready") {
    return [
      {
        title: "Record telemetry-only sparse shadow decisions",
        description:
          "Sparse shadow outcomes are safe enough to measure in runtime telemetry while live PM fan-out remains unchanged.",
        executable: false,
      },
    ];
  }
  if (status === "risk_detected") {
    return [
      {
        title: "Keep sparse execution out of runtime",
        description:
          "Shadow telemetry still shows missed contribution, missed warning, or trace-gap risk.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Collect more sparse shadow outcomes",
      description:
        "The telemetry layer needs complete shadow record outcomes before runtime planning.",
      executable: false,
    },
  ];
}

function roundRatio(value: number) {
  return Math.round(value * 1000) / 1000;
}
