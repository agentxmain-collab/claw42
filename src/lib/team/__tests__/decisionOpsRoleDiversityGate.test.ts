import { describe, expect, it } from "vitest";
import { buildDecisionOpsRoleDiversityGate } from "@/lib/team/decisionOpsRoleDiversityGate";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-20T09:00:00.000Z");

describe("buildDecisionOpsRoleDiversityGate", () => {
  it("is ready when analyst directions and summaries show differentiated role work", () => {
    const report = buildDecisionOpsRoleDiversityGate({
      records: [
        record("BTC", [
          ["chart_analyst", "long", "趋势突破后量能确认"],
          ["risk_lead", "wait", "杠杆资金过热，仓位需要下调"],
          ["news_analyst", "short", "宏观新闻压制风险偏好"],
          ["memory_loop", "neutral", "历史类似突破后容易回踩"],
        ]),
        record("ETH", [
          ["chart_analyst", "short", "均线结构转弱"],
          ["risk_lead", "wait", "止损空间不足"],
          ["news_analyst", "long", "ETF 资金流改善"],
          ["memory_loop", "neutral", "历史样本提示等确认"],
        ]),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      roleDiversityReady: true,
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      counts: {
        evaluatedRecords: 2,
        evaluatedRoleInputs: 8,
      },
      blockingReasons: [],
    });
    expect(report.metrics.uniqueSummaryRate).toBe(1);
  });

  it("blocks expansion when records collapse into one direction and duplicated rationale", () => {
    const report = buildDecisionOpsRoleDiversityGate({
      records: [
        record("BTC", [
          ["chart_analyst", "wait", "等待更多确认"],
          ["risk_lead", "wait", "等待更多确认"],
          ["news_analyst", "wait", "等待更多确认"],
          ["memory_loop", "wait", "等待更多确认"],
        ]),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      roleDiversityReady: false,
      blockingReasons: [
        "insufficient_role_diversity_samples",
        "role_direction_monoculture",
        "role_summary_duplication",
        "pm_wait_bias_high",
      ],
    });
    expect(report.metrics.directionDominance).toBe(1);
    expect(report.metrics.uniqueSummaryRate).toBe(0.25);
  });
});

function record(
  symbol: string,
  inputs: Array<
    [
      StrategyDecisionRecord["analystInputs"][number]["memberId"],
      StrategyDecisionRecord["analystInputs"][number]["direction"],
      string,
    ]
  >,
): StrategyDecisionRecord {
  return {
    id: `pm:${symbol}:1`,
    schemaVersion: 2,
    recordSource: "live",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: inputs.map(([memberId]) => memberId),
    analystInputs: inputs.map(([memberId, direction, summary]) => ({
      memberId,
      direction,
      confidence: 0.7,
      rationale: summary,
      oneLineSummary: summary,
      detailedRationale: summary,
      dataStatus: "ok",
      evidenceIds: [`ev:${symbol}:${memberId}`],
    })),
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-20T08:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek",
  };
}
