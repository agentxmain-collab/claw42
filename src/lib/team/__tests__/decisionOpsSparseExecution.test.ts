import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsSparseExecution,
  type DecisionOpsSparseExecutionReport,
} from "@/lib/team/decisionOpsSparseExecution";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  RoleExecutionMode,
  RoleExecutionTraceEntry,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-19T10:30:00.000Z");

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
    createdAt: "2026-05-19T10:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
  };
}

function role(report: DecisionOpsSparseExecutionReport, memberId: TeamMemberId) {
  const found = report.roles.find((entry) => entry.memberId === memberId);
  expect(found).toBeDefined();
  return found!;
}

describe("buildDecisionOpsSparseExecution", () => {
  it("turns role execution traces into sparse-vs-full cost and policy recommendations", () => {
    const report = buildDecisionOpsSparseExecution({
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
      status: "ready_for_sparse_trial",
      traceCoverage: {
        totalRecords: 4,
        recordsWithTrace: 4,
        coverageRate: 1,
      },
      callModel: {
        fullTeamCalls: 56,
        observedSparseCalls: 18,
        avoidedCalls: 38,
        avoidedCallRate: 0.679,
      },
    });
    expect(role(report, "pm")).toMatchObject({
      recommendedPolicy: "always_execute",
      executionRate: 1,
      contributionRate: 1,
    });
    expect(role(report, "chart_analyst")).toMatchObject({
      recommendedPolicy: "execute_when_evidence_present",
      executionRate: 0.75,
      contributionRate: 0.75,
    });
    expect(role(report, "onchain_analyst")).toMatchObject({
      recommendedPolicy: "derive_visible_from_synthesis",
      executionRate: 0,
      contributionRate: 0,
    });
    expect(role(report, "bullish_researcher")).toMatchObject({
      recommendedPolicy: "silent_until_signal",
      skippedByPolicy: 3,
    });
    expect(role(report, "trader")).toMatchObject({
      recommendedPolicy: "execute_when_evidence_present",
      mayBlockDecision: true,
    });
  });

  it("does not recommend sparse execution when there is not enough traced history", () => {
    const report = buildDecisionOpsSparseExecution({
      records: [record("pm:BTC:1", fullTrace()), record("pm:BTC:2")],
      now,
    });

    expect(report.status).toBe("insufficient_trace_data");
    expect(report.traceCoverage).toMatchObject({
      totalRecords: 2,
      recordsWithTrace: 1,
      missingTraceRecords: 1,
      coverageRate: 0.5,
    });
    expect(report.roles.every((entry) => entry.recommendedPolicy === "needs_more_trace_data")).toBe(
      true,
    );
    expect(report.recommendations[0]).toMatchObject({
      title: "Collect more role execution traces before reducing model fan-out",
      executable: false,
    });
  });
});
