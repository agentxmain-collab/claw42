import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseShadow } from "@/lib/team/decisionOpsSparseShadow";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  RoleExecutionMode,
  RoleExecutionTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-19T12:00:00.000Z");

function traceEntry(
  memberId: TeamMemberId,
  executionMode: RoleExecutionMode,
  overrides: Partial<RoleExecutionTraceEntry> = {},
): RoleExecutionTraceEntry {
  return {
    memberId,
    executionMode,
    activationReason: `${memberId} ${executionMode}`,
    evidenceIdsUsed:
      executionMode === "conditional_active" || executionMode === "core_active"
        ? [`evidence:${memberId}`]
        : [],
    contributedToPmDecision:
      executionMode === "conditional_active" || memberId === "pm" || memberId === "risk_lead",
    vetoOrWarning: memberId === "risk_lead",
    ...overrides,
  };
}

function fullTrace(
  overrides: Partial<Record<TeamMemberId, Partial<RoleExecutionTraceEntry>>> = {},
): RoleExecutionTraceEntry[] {
  return TEAM_MEMBER_IDS.map((memberId) => {
    const baseMode: RoleExecutionMode =
      memberId === "research_lead" || memberId === "risk_lead" || memberId === "pm"
        ? "core_active"
        : "derived_visible";
    return traceEntry(
      memberId,
      overrides[memberId]?.executionMode ?? baseMode,
      overrides[memberId],
    );
  });
}

function record(
  id: string,
  roleExecutionTrace?: RoleExecutionTraceEntry[],
): StrategyDecisionRecord {
  return {
    id,
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: [],
    analystInputs: [],
    roleExecutionTrace,
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-19T11:30:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
  };
}

describe("buildDecisionOpsSparseShadow", () => {
  it("approves a read-only shadow trial when sparse policy would not skip contributors", () => {
    const report = buildDecisionOpsSparseShadow({
      records: [
        record(
          "pm:BTC:1",
          fullTrace({
            chart_analyst: { executionMode: "conditional_active" },
            news_analyst: { executionMode: "conditional_active" },
            trader: { executionMode: "conditional_active" },
            bullish_researcher: { executionMode: "skipped_by_policy" },
          }),
        ),
        record(
          "pm:BTC:2",
          fullTrace({
            chart_analyst: { executionMode: "conditional_active" },
            news_analyst: { executionMode: "conditional_active" },
            bullish_researcher: { executionMode: "skipped_by_policy" },
          }),
        ),
        record(
          "pm:BTC:3",
          fullTrace({
            chart_analyst: { executionMode: "conditional_active" },
            bullish_researcher: { executionMode: "skipped_by_policy" },
          }),
        ),
        record("pm:BTC:4", fullTrace()),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_shadow_trial",
      safeToTrial: true,
      sourceSparseStatus: "ready_for_sparse_trial",
      callModel: {
        fullTeamCalls: 56,
        shadowCalls: 18,
        avoidedCalls: 38,
        avoidedCallRate: 0.679,
      },
      riskCounts: {
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: 0,
      },
    });
    expect(report.roleOutcomes.find((role) => role.memberId === "chart_analyst")).toMatchObject({
      recommendedPolicy: "execute_when_evidence_present",
      shadowCalls: 3,
      missedContributionCount: 0,
    });
    expect(report.roleOutcomes.find((role) => role.memberId === "onchain_analyst")).toMatchObject({
      recommendedPolicy: "derive_visible_from_synthesis",
      shadowCalls: 0,
      missedContributionCount: 0,
    });
    expect(report.recordOutcomes.every((recordOutcome) => recordOutcome.safe)).toBe(true);
  });

  it("blocks sparse shadow approval when a derived role would have skipped material input", () => {
    const report = buildDecisionOpsSparseShadow({
      records: [
        record("pm:BTC:1", fullTrace()),
        record(
          "pm:BTC:2",
          fullTrace({
            neutral_reviewer: {
              executionMode: "derived_visible",
              contributedToPmDecision: true,
              evidenceIdsUsed: [],
            },
          }),
        ),
        record("pm:BTC:3", fullTrace()),
        record("pm:BTC:4", fullTrace()),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "shadow_risk_detected",
      safeToTrial: false,
      riskCounts: {
        missedContributions: 1,
        missedWarnings: 0,
      },
    });
    expect(report.recordOutcomes.find((outcome) => outcome.recordId === "pm:BTC:2")).toMatchObject({
      safe: false,
      risks: [
        expect.objectContaining({
          memberId: "neutral_reviewer",
          riskType: "would_skip_contributor",
        }),
      ],
    });
    expect(report.roleOutcomes.find((role) => role.memberId === "neutral_reviewer")).toMatchObject({
      recommendedPolicy: "derive_visible_from_synthesis",
      missedContributionCount: 1,
    });
    expect(report.recommendations[0]).toMatchObject({
      title: "Do not reduce PM fan-out for roles with missed contribution risk",
      executable: false,
    });
  });

  it("waits when B96 sparse readiness still needs more trace data", () => {
    const report = buildDecisionOpsSparseShadow({
      records: [record("pm:BTC:1", fullTrace()), record("pm:BTC:2")],
      now,
    });

    expect(report).toMatchObject({
      status: "insufficient_trace_data",
      safeToTrial: false,
      sourceSparseStatus: "insufficient_trace_data",
    });
    expect(report.recommendations[0]).toMatchObject({
      title: "Collect more traced PM records before shadow sparse evaluation",
      executable: false,
    });
  });
});
