import { describe, expect, it } from "vitest";
import { assessDecisionQuality } from "@/lib/team/decisionQuality";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";

const createdAt = "2026-05-10T10:00:00.000Z";

function tradeDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
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
    riskNote: "ETF flow reversal would weaken the setup",
    invalidatesIf: "BTC loses 74800 with expanding downside volume",
    promptVersion: "test",
    modelProvider: "stub",
    severity: "high",
    ...overrides,
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
    rationale: `Role ${marker} sees BTC momentum supported by confirmed ETF inflow and clean invalidation.`,
    oneLineSummary: `Role ${marker} supports a disciplined long bias.`,
    detailedRationale: `Role ${marker} ties the setup to chart momentum, fresh flow, and a defined invalidation level.`,
    dataStatus: "ok",
    evidenceIds: ["chart-1", "news-1"],
    rounds: [
      {
        round: 1,
        direction: "long",
        confidence: 0.68,
        rationale: `Role ${marker} initial view supports a controlled long.`,
        oneLineSummary: `Role ${marker} round one supports long.`,
        detailedRationale: `Role ${marker} round one cites flow and structure.`,
        dataStatus: "ok",
        evidenceIds: ["chart-1"],
        observedAt: createdAt,
      },
    ],
    ...overrides,
  };
}

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:BTC:1778407200000",
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
    contributorIds: [
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
    ],
    analystInputs: [
      analyst("fundamental_analyst"),
      analyst("news_analyst"),
      analyst("chart_analyst"),
      analyst("onchain_analyst"),
      analyst("bullish_researcher"),
      analyst("bearish_researcher"),
      analyst("trader"),
      analyst("aggressive_reviewer"),
      analyst("neutral_reviewer"),
      analyst("conservative_reviewer"),
      analyst("memory_loop"),
      analyst("research_lead"),
      analyst("risk_lead"),
      analyst("pm"),
    ],
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

describe("assessDecisionQuality", () => {
  it("scores a covered actionable decision without warnings", () => {
    const report = assessDecisionQuality(record());

    expect(report).toMatchObject({
      schemaVersion: 1,
      score: 100,
      warningCount: 0,
      leakCount: 0,
      duplicateRationaleCount: 0,
      roleCoverage: {
        active: 14,
        contributorCount: 14,
        analystInputCount: 14,
      },
      trade: {
        hasTradeCard: true,
        direction: "long",
        confidence: 0.76,
        actionable: true,
      },
    });
    expect(report.directionDistribution.long).toBe(14);
    expect(report.evidence.citedEvidenceCount).toBe(2);
  });

  it("flags content leaks, duplicate rationale, thin coverage, and missing symbol trade cards", () => {
    const duplicated = "chart_analyst says no data, wait for later updates before acting.";
    const report = assessDecisionQuality(
      record({
        contributorIds: ["chart_analyst", "news_analyst"],
        analysisSummary: "暂无链上数据，维持 wait。",
        analystInputs: [
          analyst("chart_analyst", {
            direction: "wait",
            confidence: 0.2,
            rationale: duplicated,
            oneLineSummary: duplicated,
            detailedRationale: duplicated,
            evidenceIds: [],
            rounds: [],
          }),
          analyst("news_analyst", {
            direction: "neutral",
            confidence: 0.25,
            rationale: duplicated,
            oneLineSummary: duplicated,
            detailedRationale: duplicated,
            evidenceIds: [],
            rounds: [],
          }),
        ],
        tradeDecision: null,
      }),
    );

    expect(report.score).toBeLessThan(50);
    expect(report.warningCount).toBeGreaterThanOrEqual(5);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "public_content_leak",
        "duplicate_public_rationale",
        "low_role_coverage",
        "all_wait_or_neutral",
        "missing_trade_card_for_executable_symbol",
        "thin_evidence",
      ]),
    );
    expect(report.leakCount).toBeGreaterThan(0);
    expect(report.duplicateRationaleCount).toBeGreaterThan(0);
    expect(report.roleCoverage.active).toBe(2);
    expect(report.trade.actionable).toBe(false);
  });

  it("blocks public publishing when public stage progress skips an earlier gate", () => {
    const report = assessDecisionQuality(
      record({
        stageTrace: [
          {
            stageId: "analyst_inputs",
            label: "Analyst input generation",
            status: "pending",
            observedAt: createdAt,
          },
          {
            stageId: "research_lead",
            label: "Research synthesis",
            status: "done",
            observedAt: createdAt,
          },
          {
            stageId: "trade_decision",
            label: "PM trade decision",
            status: "pending",
            observedAt: createdAt,
          },
        ],
      }),
    );

    expect(report.warnings).toContain("stage_trace_gap");
    expect(report.blockingWarnings).toContain("stage_trace_gap");
    expect(report.publishable).toBe(false);
  });

  it("blocks very low scoring records even when no single hard leak is present", () => {
    const repeated = "Cautious view repeats without a distinct role-specific contribution.";
    const report = assessDecisionQuality(
      record({
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:zh_CN:2026-05-18",
          displayTitle: "今日大盘综述",
          executable: false,
          cadence: "daily",
          score: 60,
          reasons: [],
        },
        contributorIds: ["chart_analyst", "news_analyst"],
        analystInputs: [
          analyst("chart_analyst", {
            direction: "wait",
            confidence: 0.25,
            rationale: repeated,
            oneLineSummary: repeated,
            detailedRationale: repeated,
            evidenceIds: [],
            rounds: [],
          }),
          analyst("news_analyst", {
            direction: "neutral",
            confidence: 0.3,
            rationale: repeated,
            oneLineSummary: repeated,
            detailedRationale: repeated,
            evidenceIds: [],
            rounds: [],
          }),
        ],
        tradeDecision: null,
      }),
    );

    expect(report.leakCount).toBe(0);
    expect(report.score).toBeLessThan(70);
    expect(report.warnings).toContain("low_quality_score");
    expect(report.blockingWarnings).toContain("low_quality_score");
    expect(report.publishable).toBe(false);
  });
});
