import { describe, expect, it, vi } from "vitest";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { TradeCardPromptContext } from "@/lib/team/tradeDecisionPromptBuilder";
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

  it("uses a neutral fallback when an analyst role fails", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn();
    const updateDecisionRecord = vi.fn();
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
        generateLeadOutput: vi.fn(async (memberId) => ({
          rationale: `${memberId} rationale`,
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(
      result?.record.analystInputs.find((input) => input.memberId === "chart_analyst"),
    ).toMatchObject({
      direction: "wait",
      confidence: 0.25,
      dataStatus: "partial",
    });
    const fallbackInput = result?.record.analystInputs.find(
      (input) => input.memberId === "chart_analyst",
    );
    expect(fallbackInput?.rationale).not.toContain("暂时不可用");
    expect(fallbackInput?.rationale).not.toContain("unavailable");
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
  });

  it("returns null and writes nothing when evidence persistence fails", async () => {
    const generateAnalystOutput = vi.fn(async (memberId) => analystOutput(memberId));
    const recordStrategyDecisionRecord = vi.fn();
    const appendWatchHistoryEntry = vi.fn();
    const updateDecisionRecord = vi.fn();

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        saveNewsEvidence: vi.fn(async () => {
          throw new Error("evidence store unavailable");
        }),
        loadPromptDoc: async () => "prompt",
        generateAnalystOutput,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(result).toBeNull();
    expect(generateAnalystOutput).not.toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).not.toHaveBeenCalled();
    expect(appendWatchHistoryEntry).not.toHaveBeenCalled();
    expect(updateDecisionRecord).not.toHaveBeenCalled();
  });

  it("writes decision record and public timeline entry on success", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const updateDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => {
      void record;
    });
    const generateAnalystOutput = vi.fn(async (memberId) => analystOutput(memberId));
    const generateLeadOutput = vi.fn(async (memberId) => ({
      rationale: `${memberId} rationale`,
      confidence: 0.7,
    }));
    let tradeAnalystInputs: TradeCardPromptContext["analystInputs"] | null = null;
    const generateTradeDecision = vi.fn(async (ctx: TradeCardPromptContext) => {
      tradeAnalystInputs = ctx.analystInputs;
      return decision();
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
        generateAnalystOutput,
        generateLeadOutput,
        generateTradeDecision,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(result?.record.id).toBe("pm:BTC:1778407200000");
    expect(result?.record.locale).toBe("zh_CN");
    expect(result?.publicTimelineEntry.locale).toBe("zh_CN");
    expect(generateAnalystOutput).toHaveBeenCalledTimes(22);
    expect(generateLeadOutput).toHaveBeenCalledTimes(2);
    expect(generateTradeDecision).toHaveBeenCalledTimes(1);
    expect(generateTradeDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        analystInputs: expect.arrayContaining([
          expect.objectContaining({ memberId: "memory_loop" }),
          expect.objectContaining({ memberId: "risk_lead" }),
        ]),
      }),
    );
    expect(tradeAnalystInputs).toHaveLength(13);
    expect(result?.publicTimelineEntry.payload.kind).toBe("pm_decision");
    if (result?.publicTimelineEntry.payload.kind !== "pm_decision") {
      throw new Error("expected pm decision payload");
    }
    expect(result.publicTimelineEntry.payload.stageTrace?.map((stage) => stage.stageId)).toEqual([
      "analyst_inputs",
      "research_lead",
      "risk_lead",
      "trade_decision",
      "record_write",
      "public_timeline",
    ]);
    expect(
      result.publicTimelineEntry.payload.stageTrace?.find(
        (stage) => stage.stageId === "public_timeline",
      )?.status,
    ).toBe("done");
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
    const writtenRecord = recordStrategyDecisionRecord.mock.calls[0]?.[0] as StrategyDecisionRecord;
    expect(writtenRecord.schemaVersion).toBe(2);
    expect(writtenRecord.stageTrace?.map((stage) => stage.stageId)).toEqual([
      "analyst_inputs",
      "research_lead",
      "risk_lead",
      "trade_decision",
      "record_write",
      "public_timeline",
    ]);
    expect(writtenRecord.stageTrace?.[0]).toMatchObject({
      status: "done",
      memberIds: [
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
      ],
      note: "22 analyst round outputs",
      startedAt: expect.any(String),
      completedAt: expect.any(String),
      durationMs: expect.any(Number),
      rounds: [
        expect.objectContaining({ round: 1, memberIds: expect.any(Array) }),
        expect.objectContaining({ round: 2, memberIds: expect.any(Array) }),
      ],
    });
    expect(writtenRecord.contributorIds).toHaveLength(14);
    expect(writtenRecord.analystInputs).toHaveLength(14);
    expect(writtenRecord.analystInputs.map((input) => input.memberId)).toEqual([
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
    ]);
    expect(
      writtenRecord.analystInputs.find((input) => input.memberId === "memory_loop")?.rounds,
    ).toHaveLength(2);
    expect(writtenRecord.analystInputs.find((input) => input.memberId === "pm")?.rounds).toEqual([
      expect.objectContaining({ round: 2, rationale: expect.stringContaining("ETF inflow") }),
    ]);
    expect(result.publicTimelineEntry.payload.rounds).toHaveLength(25);
    expect(writtenRecord.stageTrace?.[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.publicTimelineEntry.payload.stageTrace?.[0]).not.toHaveProperty("note");
    expect(result.publicTimelineEntry.payload.stageTrace?.[0]).not.toHaveProperty("startedAt");
    expect(result.publicTimelineEntry.payload.stageTrace?.[0]).not.toHaveProperty("completedAt");
    expect(result.publicTimelineEntry.payload.stageTrace?.[0]).not.toHaveProperty("durationMs");
    expect(
      writtenRecord.stageTrace?.find((stage) => stage.stageId === "record_write"),
    ).toMatchObject({
      status: "done",
      startedAt: expect.any(String),
    });
    expect(
      writtenRecord.stageTrace?.find((stage) => stage.stageId === "trade_decision"),
    ).toMatchObject({
      modelProvider: "stub",
      promptVersion: "test",
      startedAt: expect.any(String),
      completedAt: expect.any(String),
      durationMs: expect.any(Number),
    });
    expect(
      writtenRecord.stageTrace?.find((stage) => stage.stageId === "public_timeline"),
    ).toMatchObject({
      status: "pending",
    });
    expect(appendWatchHistoryEntry).toHaveBeenCalledTimes(1);
    expect(updateDecisionRecord).toHaveBeenCalledTimes(1);
    const completedRecord = updateDecisionRecord.mock.calls[0]?.[0] as StrategyDecisionRecord;
    expect(
      completedRecord.stageTrace?.find((stage) => stage.stageId === "public_timeline"),
    ).toMatchObject({
      status: "done",
      durationMs: expect.any(Number),
    });
    expect(
      completedRecord.stageTrace?.find((stage) => stage.stageId === "record_write"),
    ).toMatchObject({
      status: "done",
      durationMs: expect.any(Number),
    });
    const writtenEntry = appendWatchHistoryEntry.mock.calls[0]?.[0] as {
      meta?: { locale?: string; sourceTrigger?: string };
    };
    expect(writtenEntry.meta?.sourceTrigger).toBe("pm_decision");
    expect(writtenEntry.meta?.locale).toBe("zh_CN");
  });

  it("normalizes input symbols before creating PM records", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const generateTradeDecision = vi.fn(async () => decision({ symbol: "ETH" }));

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal({ symbol: " $$eth " })],
        recentNewsEvidence: [evidence({ symbol: ["ETH"] })],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async (memberId) => ({
          rationale: `${memberId} rationale`,
          confidence: 0.7,
        })),
        generateTradeDecision,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
      },
    );

    expect(generateTradeDecision).toHaveBeenCalledWith(expect.objectContaining({ symbol: "ETH" }));
    expect(result?.record.id).toBe("pm:ETH:1778407200000");
    expect(result?.record.symbol).toBe("ETH");
    expect(result?.publicTimelineEntry.payload).toMatchObject({
      kind: "pm_decision",
      symbol: "ETH",
    });
  });

  it("writes partial stage checkpoints before the final PM decision", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const updateDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => {
      void record;
    });
    let version = 0;
    const writeDecisionStagePartial = vi.fn(async (record: StrategyDecisionRecord) => ({
      ...record,
      recordVersion: version++,
    }));

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
        partialStageUpdates: true,
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
        appendWatchHistoryEntry,
        updateDecisionRecord,
        writeDecisionStagePartial,
      },
    );

    expect(result?.record.tradeDecision).toBeTruthy();
    expect(writeDecisionStagePartial).toHaveBeenCalledTimes(3);
    expect(
      writeDecisionStagePartial.mock.calls.map(
        (call) => call[0].stageTrace?.find((stage) => stage.status === "in_progress")?.stageId,
      ),
    ).toEqual(["research_lead", "risk_lead", "trade_decision"]);
    expect(appendWatchHistoryEntry).toHaveBeenCalledTimes(1);
    const partialEntry = appendWatchHistoryEntry.mock.calls[0]?.[0] as {
      meta?: { tradeDecision?: TradeDecision | null };
    };
    expect(partialEntry.meta?.tradeDecision).toBeNull();
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
    expect(updateDecisionRecord).toHaveBeenCalledTimes(1);
  });

  it("keeps the PM output when the non-critical stage trace update fails", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const updateDecisionRecord = vi.fn(async () => {
      throw new Error("trace update unavailable");
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
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(result?.record.id).toBe("pm:BTC:1778407200000");
    expect(appendWatchHistoryEntry).toHaveBeenCalledTimes(1);
    expect(updateDecisionRecord).toHaveBeenCalledTimes(1);
  });
});
