import { describe, expect, test, vi } from "vitest";
import { computeTeamWinrates } from "@/lib/team/computeTeamWinrates";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";

describe("computeTeamWinrates", () => {
  test("excludes legacy records from public track records", async () => {
    const winrates = await computeTeamWinrates([
      makeRecord({
        id: "legacy-alpha",
        recordSource: "legacy",
        decisionOwnerId: "legacy",
        contributorIds: [],
        resolvedOutcome: "hit_tp",
      }),
    ]);

    expect(winrates.every((winrate) => winrate.totalDecisions === 0)).toBe(true);
    expect(winrates.every((winrate) => winrate.recordSourceMix.legacy === 0)).toBe(true);
  });

  test("flags small samples below 30 decisions", async () => {
    const winrates = await computeTeamWinrates([
      makeRecord({ decisionOwnerId: "pm", contributorIds: ["chart_analyst"] }),
    ]);

    expect(member(winrates, "chart_analyst").sampleSizeWarning).toBe(true);
    expect(member(winrates, "pm").sampleSizeWarning).toBe(true);
  });

  test("aggregates contributor and owner records independently", async () => {
    const winrates = await computeTeamWinrates([
      makeRecord({
        id: "btc-live",
        decisionOwnerId: "pm",
        contributorIds: ["chart_analyst", "risk_lead"],
        resolvedOutcome: "hit_tp",
      }),
      makeRecord({
        id: "eth-paper",
        recordSource: "paper",
        decisionOwnerId: "research_lead",
        contributorIds: ["chart_analyst"],
        resolvedOutcome: "hit_sl",
      }),
    ]);

    expect(member(winrates, "chart_analyst")).toMatchObject({
      totalDecisions: 2,
      wins: 1,
      winRate: 0.5,
    });
    expect(member(winrates, "pm")).toMatchObject({
      totalDecisions: 1,
      wins: 1,
      winRate: 1,
    });
    expect(member(winrates, "research_lead")).toMatchObject({
      totalDecisions: 1,
      wins: 0,
      winRate: 0,
    });
  });

  test("computes seven-day net return from resolved trade decisions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));

    try {
      const winrates = await computeTeamWinrates([
        makeRecord({
          id: "recent-win",
          createdAt: "2026-05-10T00:00:00.000Z",
          decisionOwnerId: "pm",
          contributorIds: ["chart_analyst"],
          resolvedOutcome: "hit_tp",
          tradeDecision: makeTradeDecision({
            direction: "long",
            entryPrice: 100,
            stopLoss: 95,
            takeProfit: [110],
          }),
        }),
        makeRecord({
          id: "old-loss",
          createdAt: "2026-04-30T00:00:00.000Z",
          decisionOwnerId: "pm",
          contributorIds: ["chart_analyst"],
          resolvedOutcome: "hit_sl",
          tradeDecision: makeTradeDecision({
            direction: "long",
            entryPrice: 100,
            stopLoss: 90,
            takeProfit: [120],
          }),
        }),
      ]);

      expect(member(winrates, "chart_analyst").netReturn7d).toBeCloseTo(10, 4);
      expect(member(winrates, "pm").netReturn7d).toBeCloseTo(10, 4);
    } finally {
      vi.useRealTimers();
    }
  });
});

function member(winrates: Awaited<ReturnType<typeof computeTeamWinrates>>, id: TeamMemberId) {
  const match = winrates.find((winrate) => winrate.memberId === id);
  if (!match) throw new Error(`Missing winrate for ${id}`);
  return match;
}

function makeRecord(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "record-1",
    schemaVersion: 1,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [],
    sourceThreadId: "thread-1",
    tradeDecision: makeTradeDecision(),
    createdAt: "2026-05-10T00:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: "2026-05-10T01:00:00.000Z",
    resolvedOutcome: "hit_tp",
    promptVersion: "test-v1",
    modelProvider: "deepseek",
    ...overrides,
  };
}

function makeTradeDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    id: "trade-1",
    schemaVersion: 1,
    symbol: "BTC",
    generatedBy: "pm",
    generatedAt: "2026-05-10T00:00:00.000Z",
    direction: "long",
    entryType: "market",
    entryPrice: 100,
    entryRange: null,
    stopLoss: 95,
    takeProfit: [110],
    positionSizing: 0.1,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.8,
    evidenceIds: [],
    riskNote: "test",
    invalidatesIf: "test",
    promptVersion: "test-v1",
    modelProvider: "deepseek",
    severity: "medium",
    ...overrides,
  };
}
