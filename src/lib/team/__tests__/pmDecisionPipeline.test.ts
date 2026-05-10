import { describe, expect, it, vi } from "vitest";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { SignalRecord } from "@/modules/agent-watch/types";

const now = Date.UTC(2026, 4, 10, 10, 0, 0);

function signal(overrides: Partial<SignalRecord> = {}): SignalRecord {
  return {
    id: "signal-1",
    ts: now,
    symbol: "BTC",
    type: "breakout",
    severity: "alert",
    payload: {
      priceLevel: 76000,
      description: "BTC near high",
    },
    ...overrides,
  };
}

function evidence(overrides: Partial<NewsEvidence> = {}): NewsEvidence {
  return {
    id: "ev_1",
    source: "CryptoCompare",
    title: "BTC ETF inflows rise",
    url: "https://example.com/btc",
    publishedAt: new Date(now - 60000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    symbol: ["BTC"],
    impactSeverity: "high",
    summary: "BTC ETF inflows rise",
    ...overrides,
  };
}

function decision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    id: "trade-1",
    schemaVersion: 1,
    symbol: "BTC",
    generatedBy: "pm",
    generatedAt: new Date(now).toISOString(),
    direction: "long",
    entryType: "market",
    entryPrice: 76000,
    entryRange: { low: 75500, high: 76500 },
    stopLoss: 74800,
    takeProfit: [78000],
    positionSizing: 0.1,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.72,
    evidenceIds: ["ev_1"],
    riskNote: "ETF inflow can fade",
    invalidatesIf: "BTC loses 74800",
    promptVersion: "test",
    modelProvider: "stub",
    severity: "high",
    ...overrides,
  };
}

const analystOutput = (memberId: TeamMemberId) => ({
  memberId,
  direction: "long" as const,
  confidence: 0.7,
  rationale: `${memberId} sees BTC at 76000`,
  citations: ["ev_1"],
});

describe("runPmDecisionPipeline", () => {
  it("does not run below high importance", async () => {
    const generateAnalystOutput = vi.fn();
    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal({ severity: "watch" })],
        recentNewsEvidence: [evidence({ impactSeverity: "medium" })],
        now,
      },
      { generateAnalystOutput },
    );
    expect(result).toBeNull();
    expect(generateAnalystOutput).not.toHaveBeenCalled();
  });

  it("returns null and writes nothing when any LLM step fails", async () => {
    const recordStrategyDecisionRecord = vi.fn();
    const appendWatchEntry = vi.fn();
    const result = await runPmDecisionPipeline(
      {
        triggerSource: "user_visit_trigger",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        generateAnalystOutput: vi.fn(async (memberId) => {
          if (memberId === "chart_analyst") throw new Error("llm failed");
          return analystOutput(memberId);
        }),
        recordStrategyDecisionRecord,
        appendWatchEntry,
      },
    );

    expect(result).toBeNull();
    expect(recordStrategyDecisionRecord).not.toHaveBeenCalled();
    expect(appendWatchEntry).not.toHaveBeenCalled();
  });

  it("writes decision record and public timeline entry on success", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async (memberId) => ({
          rationale: `${memberId} rationale`,
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchEntry,
      },
    );

    expect(result?.record.id).toBe("pm:BTC:1778407200000");
    expect(result?.publicTimelineEntry.payload.kind).toBe("pm_decision");
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
    expect(appendWatchEntry).toHaveBeenCalledTimes(1);
    const writtenEntry = appendWatchEntry.mock.calls[0]?.[0] as {
      meta?: { sourceTrigger?: string };
    };
    expect(writtenEntry.meta?.sourceTrigger).toBe("pm_decision");
  });
});
