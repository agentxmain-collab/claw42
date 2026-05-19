import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseShadowHistory } from "@/lib/team/decisionOpsSparseShadowHistory";
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

function record({
  id,
  createdAt,
  roleExecutionTrace,
}: {
  id: string;
  createdAt: string;
  roleExecutionTrace?: RoleExecutionTraceEntry[];
}): StrategyDecisionRecord {
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
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
  };
}

function safeRecord(index: number) {
  return record({
    id: `pm:BTC:${index}`,
    createdAt: new Date(Date.parse("2026-05-19T11:00:00.000Z") - index * 60_000).toISOString(),
    roleExecutionTrace: fullTrace({
      chart_analyst: { executionMode: "conditional_active" },
      news_analyst: { executionMode: "conditional_active" },
      bullish_researcher: { executionMode: "skipped_by_policy" },
    }),
  });
}

describe("buildDecisionOpsSparseShadowHistory", () => {
  it("approves config-gate preparation only after consecutive safe shadow batches", () => {
    const report = buildDecisionOpsSparseShadowHistory({
      records: Array.from({ length: 6 }, (_, index) => safeRecord(index + 1)),
      batchSize: 3,
      minimumSafeBatches: 2,
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_config_gate",
      safeToPrepareConfigGate: true,
      parameters: {
        batchSize: 3,
        minimumSafeBatches: 2,
      },
      stability: {
        totalBatches: 2,
        evaluatedBatches: 2,
        safeBatches: 2,
        riskyBatches: 0,
        consecutiveSafeBatches: 2,
      },
    });
    expect(report.batchOutcomes).toHaveLength(2);
    expect(report.batchOutcomes[0]).toMatchObject({
      batchIndex: 1,
      safeToTrial: true,
      recordIds: ["pm:BTC:1", "pm:BTC:2", "pm:BTC:3"],
    });
    expect(report.recommendations[0]).toMatchObject({
      title: "Prepare a disabled sparse fan-out config gate",
      executable: false,
    });
  });

  it("blocks config-gate preparation when any recent batch would skip material input", () => {
    const records = Array.from({ length: 6 }, (_, index) => safeRecord(index + 1));
    records[1] = record({
      id: "pm:BTC:2",
      createdAt: "2026-05-19T10:58:00.000Z",
      roleExecutionTrace: fullTrace({
        neutral_reviewer: {
          executionMode: "derived_visible",
          contributedToPmDecision: true,
          evidenceIdsUsed: [],
        },
      }),
    });

    const report = buildDecisionOpsSparseShadowHistory({
      records,
      batchSize: 3,
      minimumSafeBatches: 2,
      now,
    });

    expect(report).toMatchObject({
      status: "shadow_risk_detected",
      safeToPrepareConfigGate: false,
      stability: {
        totalBatches: 2,
        evaluatedBatches: 2,
        safeBatches: 1,
        riskyBatches: 1,
        consecutiveSafeBatches: 0,
      },
    });
    expect(report.batchOutcomes[0]).toMatchObject({
      safeToTrial: false,
      riskCounts: {
        missedContributions: 1,
      },
    });
  });

  it("waits when there are not enough complete shadow batches", () => {
    const report = buildDecisionOpsSparseShadowHistory({
      records: [safeRecord(1), safeRecord(2), safeRecord(3), safeRecord(4)],
      batchSize: 3,
      minimumSafeBatches: 2,
      now,
    });

    expect(report).toMatchObject({
      status: "insufficient_shadow_batches",
      safeToPrepareConfigGate: false,
      stability: {
        totalBatches: 1,
        evaluatedBatches: 1,
        safeBatches: 1,
        consecutiveSafeBatches: 1,
      },
    });
  });
});
