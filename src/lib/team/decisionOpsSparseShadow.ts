import {
  buildDecisionOpsSparseExecution,
  type DecisionOpsSparseExecutionRole,
  type DecisionOpsSparseExecutionStatus,
  type SparseExecutionPolicy,
} from "@/lib/team/decisionOpsSparseExecution";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  RoleExecutionTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsSparseShadowStatus =
  | "insufficient_trace_data"
  | "shadow_risk_detected"
  | "ready_for_shadow_trial";

export type DecisionOpsSparseShadowAction =
  | "would_execute"
  | "would_derive"
  | "would_stay_silent"
  | "needs_more_trace_data";

export type DecisionOpsSparseShadowRiskType =
  | "would_skip_contributor"
  | "would_skip_warning"
  | "trace_gap";

export interface DecisionOpsSparseShadowRisk {
  recordId: string;
  memberId: TeamMemberId;
  riskType: DecisionOpsSparseShadowRiskType;
  recommendedPolicy: SparseExecutionPolicy;
  reason: string;
}

export interface DecisionOpsSparseShadowRoleOutcome {
  memberId: TeamMemberId;
  recommendedPolicy: SparseExecutionPolicy;
  shadowAction: DecisionOpsSparseShadowAction;
  tracedRecords: number;
  shadowCalls: number;
  missedContributionCount: number;
  missedWarningCount: number;
  traceGapCount: number;
}

export interface DecisionOpsSparseShadowRecordOutcome {
  recordId: string;
  safe: boolean;
  fullTeamCalls: number;
  shadowCalls: number;
  avoidedCalls: number;
  risks: DecisionOpsSparseShadowRisk[];
}

export interface DecisionOpsSparseShadowCallModel {
  fullTeamCalls: number;
  shadowCalls: number;
  avoidedCalls: number;
  avoidedCallRate: number | null;
}

export interface DecisionOpsSparseShadowRecommendation {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseShadowReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseShadowStatus;
  safeToTrial: boolean;
  sourceSparseStatus: DecisionOpsSparseExecutionStatus;
  callModel: DecisionOpsSparseShadowCallModel;
  riskCounts: {
    missedContributions: number;
    missedWarnings: number;
    traceGaps: number;
  };
  roleOutcomes: DecisionOpsSparseShadowRoleOutcome[];
  recordOutcomes: DecisionOpsSparseShadowRecordOutcome[];
  recommendations: DecisionOpsSparseShadowRecommendation[];
}

export function buildDecisionOpsSparseShadow({
  records,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsSparseShadowReport {
  const sparseExecution = buildDecisionOpsSparseExecution({ records, now });
  const tracedRecords = records.filter(
    (record) => Array.isArray(record.roleExecutionTrace) && record.roleExecutionTrace.length > 0,
  );

  if (sparseExecution.status === "insufficient_trace_data") {
    return {
      schemaVersion: 1,
      generatedAt: new Date(now).toISOString(),
      status: "insufficient_trace_data",
      safeToTrial: false,
      sourceSparseStatus: sparseExecution.status,
      callModel: {
        fullTeamCalls: sparseExecution.callModel.fullTeamCalls,
        shadowCalls: 0,
        avoidedCalls: 0,
        avoidedCallRate: null,
      },
      riskCounts: {
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: sparseExecution.traceCoverage.missingTraceRecords,
      },
      roleOutcomes: sparseExecution.roles.map((role) => emptyRoleOutcome(role)),
      recordOutcomes: [],
      recommendations: [
        {
          title: "Collect more traced PM records before shadow sparse evaluation",
          description:
            "Keep full PM fan-out unchanged until sparse readiness has enough complete roleExecutionTrace history.",
          executable: false,
        },
      ],
    };
  }

  const rolesById = new Map(sparseExecution.roles.map((role) => [role.memberId, role]));
  const roleAccumulators = new Map(
    TEAM_MEMBER_IDS.map((memberId) => [
      memberId,
      {
        shadowCalls: 0,
        missedContributionCount: 0,
        missedWarningCount: 0,
        traceGapCount: 0,
      },
    ]),
  );
  const recordOutcomes = tracedRecords.map((record) =>
    shadowRecordOutcome({
      record,
      rolesById,
      roleAccumulators,
    }),
  );
  const callModel = callModelFor(recordOutcomes);
  const riskCounts = riskCountsFor(recordOutcomes);
  const status: DecisionOpsSparseShadowStatus =
    riskCounts.missedContributions > 0 || riskCounts.missedWarnings > 0 || riskCounts.traceGaps > 0
      ? "shadow_risk_detected"
      : "ready_for_shadow_trial";

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    safeToTrial: status === "ready_for_shadow_trial",
    sourceSparseStatus: sparseExecution.status,
    callModel,
    riskCounts,
    roleOutcomes: sparseExecution.roles.map((role) =>
      roleOutcomeFromAccumulator(role, roleAccumulators.get(role.memberId)!),
    ),
    recordOutcomes,
    recommendations: recommendationsFor(status, riskCounts),
  };
}

function shadowRecordOutcome({
  record,
  rolesById,
  roleAccumulators,
}: {
  record: StrategyDecisionRecord;
  rolesById: ReadonlyMap<TeamMemberId, DecisionOpsSparseExecutionRole>;
  roleAccumulators: Map<
    TeamMemberId,
    {
      shadowCalls: number;
      missedContributionCount: number;
      missedWarningCount: number;
      traceGapCount: number;
    }
  >;
}): DecisionOpsSparseShadowRecordOutcome {
  let shadowCalls = 0;
  const risks: DecisionOpsSparseShadowRisk[] = [];

  for (const memberId of TEAM_MEMBER_IDS) {
    const role = rolesById.get(memberId)!;
    const entry = record.roleExecutionTrace?.find((candidate) => candidate.memberId === memberId);
    const accumulator = roleAccumulators.get(memberId)!;

    if (!entry) {
      accumulator.traceGapCount += 1;
      risks.push({
        recordId: record.id,
        memberId,
        riskType: "trace_gap",
        recommendedPolicy: role.recommendedPolicy,
        reason: "Role trace row is missing for this record.",
      });
      continue;
    }

    const wouldExecute = shouldShadowExecute(role.recommendedPolicy, entry);
    if (wouldExecute) {
      accumulator.shadowCalls += 1;
      shadowCalls += 1;
      continue;
    }

    if (entry.contributedToPmDecision) {
      accumulator.missedContributionCount += 1;
      risks.push({
        recordId: record.id,
        memberId,
        riskType: "would_skip_contributor",
        recommendedPolicy: role.recommendedPolicy,
        reason: "Sparse policy would skip a role that contributed to PM synthesis.",
      });
    }
    if (entry.vetoOrWarning) {
      accumulator.missedWarningCount += 1;
      risks.push({
        recordId: record.id,
        memberId,
        riskType: "would_skip_warning",
        recommendedPolicy: role.recommendedPolicy,
        reason: "Sparse policy would skip a role that produced a veto or warning.",
      });
    }
  }

  return {
    recordId: record.id,
    safe: risks.length === 0,
    fullTeamCalls: TEAM_MEMBER_IDS.length,
    shadowCalls,
    avoidedCalls: Math.max(0, TEAM_MEMBER_IDS.length - shadowCalls),
    risks,
  };
}

function shouldShadowExecute(policy: SparseExecutionPolicy, entry: RoleExecutionTraceEntry) {
  if (policy === "always_execute") return true;
  if (policy === "needs_more_trace_data") return false;
  if (policy === "derive_visible_from_synthesis") return false;
  if (policy === "execute_when_evidence_present") {
    return entry.evidenceIdsUsed.length > 0 || entry.vetoOrWarning;
  }
  return (entry.evidenceIdsUsed.length > 0 || entry.vetoOrWarning) && entry.contributedToPmDecision;
}

function callModelFor(
  recordOutcomes: readonly DecisionOpsSparseShadowRecordOutcome[],
): DecisionOpsSparseShadowCallModel {
  const fullTeamCalls = recordOutcomes.reduce((total, record) => total + record.fullTeamCalls, 0);
  const shadowCalls = recordOutcomes.reduce((total, record) => total + record.shadowCalls, 0);
  const avoidedCalls = Math.max(0, fullTeamCalls - shadowCalls);
  return {
    fullTeamCalls,
    shadowCalls,
    avoidedCalls,
    avoidedCallRate: fullTeamCalls > 0 ? roundRatio(avoidedCalls / fullTeamCalls) : null,
  };
}

function riskCountsFor(recordOutcomes: readonly DecisionOpsSparseShadowRecordOutcome[]) {
  let missedContributions = 0;
  let missedWarnings = 0;
  let traceGaps = 0;
  for (const record of recordOutcomes) {
    for (const risk of record.risks) {
      if (risk.riskType === "would_skip_contributor") missedContributions += 1;
      if (risk.riskType === "would_skip_warning") missedWarnings += 1;
      if (risk.riskType === "trace_gap") traceGaps += 1;
    }
  }
  return {
    missedContributions,
    missedWarnings,
    traceGaps,
  };
}

function emptyRoleOutcome(
  role: DecisionOpsSparseExecutionRole,
): DecisionOpsSparseShadowRoleOutcome {
  return {
    memberId: role.memberId,
    recommendedPolicy: role.recommendedPolicy,
    shadowAction: "needs_more_trace_data",
    tracedRecords: role.tracedRecords,
    shadowCalls: 0,
    missedContributionCount: 0,
    missedWarningCount: 0,
    traceGapCount: role.missingTraceRows,
  };
}

function roleOutcomeFromAccumulator(
  role: DecisionOpsSparseExecutionRole,
  accumulator: {
    shadowCalls: number;
    missedContributionCount: number;
    missedWarningCount: number;
    traceGapCount: number;
  },
): DecisionOpsSparseShadowRoleOutcome {
  return {
    memberId: role.memberId,
    recommendedPolicy: role.recommendedPolicy,
    shadowAction: shadowActionFor(role.recommendedPolicy),
    tracedRecords: role.tracedRecords,
    ...accumulator,
  };
}

function shadowActionFor(policy: SparseExecutionPolicy): DecisionOpsSparseShadowAction {
  if (policy === "needs_more_trace_data") return "needs_more_trace_data";
  if (policy === "always_execute" || policy === "execute_when_evidence_present") {
    return "would_execute";
  }
  if (policy === "silent_until_signal") return "would_stay_silent";
  return "would_derive";
}

function recommendationsFor(
  status: DecisionOpsSparseShadowStatus,
  riskCounts: DecisionOpsSparseShadowReport["riskCounts"],
): DecisionOpsSparseShadowRecommendation[] {
  if (status === "ready_for_shadow_trial") {
    return [
      {
        title: "Run shadow sparse fan-out against the next live PM batch",
        description:
          "Keep public output and live fan-out unchanged while comparing sparse policy predictions against full traces.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Do not reduce PM fan-out for roles with missed contribution risk",
      description: `Shadow policy risk counts: ${riskCounts.missedContributions} missed contributions, ${riskCounts.missedWarnings} missed warnings, ${riskCounts.traceGaps} trace gaps.`,
      executable: false,
    },
  ];
}

function roundRatio(value: number) {
  return Math.round(value * 1000) / 1000;
}
