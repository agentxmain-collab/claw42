import {
  TEAM_ROLE_EXECUTION_CONTRACTS,
  type RoleResponsibilityContract,
} from "@/lib/team/roleExecutionPolicy";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  RoleExecutionMode,
  RoleExecutionTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";

export type DecisionOpsSparseExecutionStatus =
  | "insufficient_trace_data"
  | "monitor_trace_gaps"
  | "ready_for_sparse_trial";

export type SparseExecutionPolicy =
  | "always_execute"
  | "execute_when_evidence_present"
  | "derive_visible_from_synthesis"
  | "silent_until_signal"
  | "needs_more_trace_data";

export interface DecisionOpsSparseExecutionTraceCoverage {
  totalRecords: number;
  recordsWithTrace: number;
  missingTraceRecords: number;
  coverageRate: number | null;
  minimumTracedRecordsForPolicy: number;
}

export interface DecisionOpsSparseExecutionCallModel {
  fullTeamCalls: number;
  observedSparseCalls: number;
  avoidedCalls: number;
  avoidedCallRate: number | null;
  fullTeamSize: number;
}

export interface DecisionOpsSparseExecutionRole {
  memberId: TeamMemberId;
  uniqueQuestion: string;
  mayBlockDecision: boolean;
  tracedRecords: number;
  missingTraceRows: number;
  coreActive: number;
  conditionalActive: number;
  derivedVisible: number;
  silentEvaluator: number;
  skippedByPolicy: number;
  contributionCount: number;
  warningCount: number;
  evidenceCount: number;
  executionRate: number | null;
  contributionRate: number | null;
  warningRate: number | null;
  evidenceCoverageRate: number | null;
  recommendedPolicy: SparseExecutionPolicy;
  recommendationReason: string;
}

export interface DecisionOpsSparseExecutionRecommendation {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseExecutionReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseExecutionStatus;
  traceCoverage: DecisionOpsSparseExecutionTraceCoverage;
  callModel: DecisionOpsSparseExecutionCallModel;
  roles: DecisionOpsSparseExecutionRole[];
  recommendations: DecisionOpsSparseExecutionRecommendation[];
}

const MIN_TRACED_RECORDS_FOR_POLICY = 3;
const EXECUTED_MODES = new Set<RoleExecutionMode>(["core_active", "conditional_active"]);

export function buildDecisionOpsSparseExecution({
  records,
  now = Date.now(),
}: {
  records: readonly StrategyDecisionRecord[];
  now?: number;
}): DecisionOpsSparseExecutionReport {
  const tracedRecords = records.filter(
    (record) => Array.isArray(record.roleExecutionTrace) && record.roleExecutionTrace.length > 0,
  );
  const traceCoverage = traceCoverageFor(records, tracedRecords);
  const enoughTraceData = tracedRecords.length >= MIN_TRACED_RECORDS_FOR_POLICY;
  const roles = TEAM_MEMBER_IDS.map((memberId) =>
    roleReadinessFor({
      memberId,
      tracedRecords,
      enoughTraceData,
    }),
  );
  const status = statusFor({ tracedRecords, roles });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    traceCoverage,
    callModel: callModelFor(tracedRecords),
    roles,
    recommendations: recommendationsFor({ status, roles }),
  };
}

function traceCoverageFor(
  records: readonly StrategyDecisionRecord[],
  tracedRecords: readonly StrategyDecisionRecord[],
): DecisionOpsSparseExecutionTraceCoverage {
  return {
    totalRecords: records.length,
    recordsWithTrace: tracedRecords.length,
    missingTraceRecords: records.length - tracedRecords.length,
    coverageRate: records.length > 0 ? roundRatio(tracedRecords.length / records.length) : null,
    minimumTracedRecordsForPolicy: MIN_TRACED_RECORDS_FOR_POLICY,
  };
}

function callModelFor(
  tracedRecords: readonly StrategyDecisionRecord[],
): DecisionOpsSparseExecutionCallModel {
  const fullTeamCalls = tracedRecords.length * TEAM_MEMBER_IDS.length;
  const observedSparseCalls = tracedRecords.reduce(
    (total, record) =>
      total +
      (record.roleExecutionTrace ?? []).filter((entry) => EXECUTED_MODES.has(entry.executionMode))
        .length,
    0,
  );
  const avoidedCalls = Math.max(0, fullTeamCalls - observedSparseCalls);
  return {
    fullTeamCalls,
    observedSparseCalls,
    avoidedCalls,
    avoidedCallRate: fullTeamCalls > 0 ? roundRatio(avoidedCalls / fullTeamCalls) : null,
    fullTeamSize: TEAM_MEMBER_IDS.length,
  };
}

function roleReadinessFor({
  memberId,
  tracedRecords,
  enoughTraceData,
}: {
  memberId: TeamMemberId;
  tracedRecords: readonly StrategyDecisionRecord[];
  enoughTraceData: boolean;
}): DecisionOpsSparseExecutionRole {
  const contract = TEAM_ROLE_EXECUTION_CONTRACTS[memberId];
  const entries = tracedRecords
    .map((record) => record.roleExecutionTrace?.find((entry) => entry.memberId === memberId))
    .filter((entry): entry is RoleExecutionTraceEntry => Boolean(entry));
  const counts = modeCounts(entries);
  const missingTraceRows = tracedRecords.length - entries.length;
  const executionCount = counts.core_active + counts.conditional_active;
  const contributionCount = entries.filter((entry) => entry.contributedToPmDecision).length;
  const warningCount = entries.filter((entry) => entry.vetoOrWarning).length;
  const evidenceCount = entries.filter((entry) => entry.evidenceIdsUsed.length > 0).length;
  const rates = {
    executionRate: rate(executionCount, tracedRecords.length),
    contributionRate: rate(contributionCount, tracedRecords.length),
    warningRate: rate(warningCount, tracedRecords.length),
    evidenceCoverageRate: rate(evidenceCount, tracedRecords.length),
  };
  const recommendedPolicy = policyFor({
    contract,
    counts,
    enoughTraceData,
    contributionRate: rates.contributionRate,
    warningRate: rates.warningRate,
  });

  return {
    memberId,
    uniqueQuestion: contract.uniqueQuestion,
    mayBlockDecision: contract.mayBlockDecision,
    tracedRecords: entries.length,
    missingTraceRows,
    coreActive: counts.core_active,
    conditionalActive: counts.conditional_active,
    derivedVisible: counts.derived_visible,
    silentEvaluator: counts.silent_evaluator,
    skippedByPolicy: counts.skipped_by_policy,
    contributionCount,
    warningCount,
    evidenceCount,
    ...rates,
    recommendedPolicy,
    recommendationReason: reasonFor({
      contract,
      recommendedPolicy,
      counts,
      contributionRate: rates.contributionRate,
      warningRate: rates.warningRate,
    }),
  };
}

function modeCounts(entries: readonly RoleExecutionTraceEntry[]) {
  const counts: Record<RoleExecutionMode, number> = {
    core_active: 0,
    conditional_active: 0,
    derived_visible: 0,
    silent_evaluator: 0,
    skipped_by_policy: 0,
  };
  for (const entry of entries) {
    counts[entry.executionMode] += 1;
  }
  return counts;
}

function policyFor({
  contract,
  counts,
  enoughTraceData,
  contributionRate,
  warningRate,
}: {
  contract: RoleResponsibilityContract;
  counts: Record<RoleExecutionMode, number>;
  enoughTraceData: boolean;
  contributionRate: number | null;
  warningRate: number | null;
}): SparseExecutionPolicy {
  if (!enoughTraceData) return "needs_more_trace_data";
  if (counts.core_active > 0) return "always_execute";
  if (contract.mayBlockDecision || (warningRate ?? 0) > 0) {
    return "execute_when_evidence_present";
  }
  if ((contributionRate ?? 0) >= 0.5 || counts.conditional_active > 0) {
    return "execute_when_evidence_present";
  }
  if (counts.skipped_by_policy > 0 || counts.silent_evaluator > 0) {
    return "silent_until_signal";
  }
  return "derive_visible_from_synthesis";
}

function reasonFor({
  contract,
  recommendedPolicy,
  counts,
  contributionRate,
  warningRate,
}: {
  contract: RoleResponsibilityContract;
  recommendedPolicy: SparseExecutionPolicy;
  counts: Record<RoleExecutionMode, number>;
  contributionRate: number | null;
  warningRate: number | null;
}) {
  if (recommendedPolicy === "needs_more_trace_data") {
    return "Trace history is too short to change execution policy.";
  }
  if (recommendedPolicy === "always_execute") {
    return "Core synthesis, risk, and final-decision roles remain always-on.";
  }
  if (recommendedPolicy === "execute_when_evidence_present") {
    return contract.mayBlockDecision || (warningRate ?? 0) > 0
      ? "Role can block or downgrade a decision, so it should run when its trigger is present."
      : `Role has material contribution rate ${formatRate(contributionRate)} in traced records.`;
  }
  if (recommendedPolicy === "silent_until_signal") {
    return `Role was skipped or silent in ${counts.skipped_by_policy + counts.silent_evaluator} traced records.`;
  }
  return "Role has been visible but non-material in traced records and can be derived from synthesis.";
}

function statusFor({
  tracedRecords,
  roles,
}: {
  tracedRecords: readonly StrategyDecisionRecord[];
  roles: readonly DecisionOpsSparseExecutionRole[];
}): DecisionOpsSparseExecutionStatus {
  if (tracedRecords.length < MIN_TRACED_RECORDS_FOR_POLICY) return "insufficient_trace_data";
  if (roles.some((role) => role.missingTraceRows > 0)) return "monitor_trace_gaps";
  return "ready_for_sparse_trial";
}

function recommendationsFor({
  status,
  roles,
}: {
  status: DecisionOpsSparseExecutionStatus;
  roles: readonly DecisionOpsSparseExecutionRole[];
}): DecisionOpsSparseExecutionRecommendation[] {
  if (status === "insufficient_trace_data") {
    return [
      {
        title: "Collect more role execution traces before reducing model fan-out",
        description:
          "Keep full execution unchanged until at least three recent records include complete roleExecutionTrace rows.",
        executable: false,
      },
    ];
  }

  const derivedRoles = roles.filter(
    (role) => role.recommendedPolicy === "derive_visible_from_synthesis",
  );
  const silentRoles = roles.filter((role) => role.recommendedPolicy === "silent_until_signal");
  const actions: DecisionOpsSparseExecutionRecommendation[] = [];
  if (derivedRoles.length > 0) {
    actions.push({
      title: "Trial derived-visible roles in shadow evaluation",
      description: `${derivedRoles.map((role) => role.memberId).join(", ")} can be tested as visible synthesis projections before changing live fan-out.`,
      executable: false,
    });
  }
  if (silentRoles.length > 0) {
    actions.push({
      title: "Keep skipped roles silent until their activation signal appears",
      description: `${silentRoles.map((role) => role.memberId).join(", ")} should not spend model calls without a trace-backed activation trigger.`,
      executable: false,
    });
  }
  return actions;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? roundRatio(numerator / denominator) : null;
}

function roundRatio(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}
