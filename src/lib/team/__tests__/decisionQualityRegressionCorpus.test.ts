import { describe, expect, it } from "vitest";
import { assessDecisionQuality } from "@/lib/team/decisionQuality";
import type {
  DecisionStageTraceId,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { containsPublicContentLeak } from "@/lib/watch/publicContentGuardrails";

const createdAt = "2026-05-18T12:00:00.000Z";
const publicStageOrder: DecisionStageTraceId[] = [
  "analyst_inputs",
  "research_lead",
  "trade_decision",
  "risk_lead",
  "record_write",
  "public_timeline",
];

const leakCorpus = [
  "无止损参考，维持 wait。",
  "无成交量验证，等待链上资金流更新。",
  "无事件驱动分析，暂时不可用。",
  "链上数据缺失，数据不足。",
  "前轮 chartanalyst 与 bullish_researcher 分歧。",
  "memory_loop reports no usable sample.",
  "missing onchain evidence, awaiting update.",
];

function tradeDecision(): TradeDecision {
  return {
    id: "trade-1",
    schemaVersion: 1,
    symbol: "BTC",
    generatedBy: "pm",
    generatedAt: createdAt,
    direction: "long",
    entryType: "market",
    entryPrice: 76000,
    entryRange: { low: 75500, high: 76500 },
    stopLoss: 74800,
    takeProfit: [78000, 79200],
    positionSizing: 0.12,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.76,
    evidenceIds: ["chart-1", "news-1"],
    riskNote: "Flow rotation supports the setup while 74800 remains the invalidation.",
    invalidatesIf: "BTC loses 74800 with expanding downside volume",
    promptVersion: "test",
    modelProvider: "stub",
    severity: "high",
  };
}

function analyst(
  memberId: TeamMemberId,
  overrides: Partial<StrategyDecisionRecord["analystInputs"][number]> = {},
): StrategyDecisionRecord["analystInputs"][number] {
  const marker = memberId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    memberId,
    direction: "long",
    confidence: 0.72,
    rationale: `Role ${marker} sees confirmed BTC momentum with fresh flow and defined invalidation.`,
    oneLineSummary: `Role ${marker} supports a disciplined long bias.`,
    detailedRationale: `Role ${marker} ties the setup to momentum, flow, and invalidation.`,
    dataStatus: "ok",
    evidenceIds: ["chart-1", "news-1"],
    rounds: [],
    ...overrides,
  };
}

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  const memberIds: TeamMemberId[] = [
    "fundamental_analyst",
    "news_analyst",
    "chart_analyst",
    "onchain_analyst",
    "bullish_researcher",
    "bearish_researcher",
    "trader",
    "aggressive_reviewer",
    "neutral_reviewer",
    "conservative_reviewer",
    "memory_loop",
    "research_lead",
    "risk_lead",
    "pm",
  ];

  return {
    id: "pm:BTC:1779105600000",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    candidate: {
      candidateType: "symbol",
      candidateKey: "symbol:BTC",
      symbol: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      cadence: "intraday",
      score: 90,
      reasons: [{ kind: "executable", label: "Executable", detail: "Liquid symbol", score: 20 }],
    },
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: memberIds,
    analystInputs: memberIds.map((memberId) => analyst(memberId)),
    sourceThreadId: null,
    tradeDecision: tradeDecision(),
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "stub",
    ...overrides,
  };
}

describe("decision quality regression corpus", () => {
  it("keeps known backend-status wording and internal role IDs out of public payloads", () => {
    for (const sample of leakCorpus) {
      expect(containsPublicContentLeak(sample), sample).toBe(true);
    }
  });

  it("blocks publication when any earlier public stage is missing while a later stage advanced", () => {
    for (let index = 0; index < publicStageOrder.length - 1; index += 1) {
      const skippedStage = publicStageOrder[index];
      const laterStage = publicStageOrder[index + 1];
      const report = assessDecisionQuality(
        record({
          stageTrace: [
            {
              stageId: skippedStage,
              label: skippedStage,
              status: "pending",
              observedAt: createdAt,
            },
            {
              stageId: laterStage,
              label: laterStage,
              status: "done",
              observedAt: createdAt,
            },
          ],
        }),
      );

      expect(report.warnings, skippedStage).toContain("stage_trace_gap");
      expect(report.blockingWarnings, skippedStage).toContain("stage_trace_gap");
      expect(report.publishable, skippedStage).toBe(false);
    }
  });

  it("keeps watch-only market records publishable when they are clean and stage-complete", () => {
    const report = assessDecisionQuality(
      record({
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:zh_CN:2026-05-18",
          displayTitle: "今日大盘综述",
          executable: false,
          cadence: "daily",
          score: 75,
          reasons: [],
        },
        symbol: "MARKET",
        tradeDecision: null,
        stageTrace: publicStageOrder.map((stageId) => ({
          stageId,
          label: stageId,
          status: "done",
          observedAt: createdAt,
        })),
      }),
    );

    expect(report.leakCount).toBe(0);
    expect(report.blockingWarnings).not.toContain("missing_trade_card_for_executable_symbol");
    expect(report.blockingWarnings).not.toContain("stage_trace_gap");
    expect(report.publishable).toBe(true);
  });
});
