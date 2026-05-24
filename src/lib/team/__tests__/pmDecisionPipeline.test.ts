import { describe, expect, it, vi } from "vitest";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { TradeCardPromptContext } from "@/lib/team/tradeDecisionPromptBuilder";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { DecisionRunRecord } from "@/lib/team/decisionRunLedger";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { SignalRecord } from "@/modules/agent-watch/types";
import type { EvidenceContextPack } from "@/lib/team/evidenceDispatcher";
import type { DecisionJudgeResult } from "@/lib/llm/decisionJudge";
import { marketOverviewCandidate } from "@/lib/watch/residentCandidate";

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
  rationale: "BTC holds 76000 with constructive momentum",
  citations: ["ev_1"],
});

function fullEvidenceContextPack(symbol = "BTC"): EvidenceContextPack {
  return {
    symbol,
    chart: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "chart",
          status: "ok",
          source: "test",
          summary: `${symbol} momentum confirmed near 76000`,
        },
      ],
      summary: `${symbol} momentum confirmed near 76000`,
    },
    news: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "news",
          status: "ok",
          source: "test",
          summary: `${symbol} ETF inflows rise`,
        },
      ],
      summary: `${symbol} ETF inflows rise`,
    },
    onchain: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "onchain",
          status: "ok",
          source: "test",
          summary: `${symbol} exchange outflows improved`,
        },
      ],
      summary: `${symbol} exchange outflows improved`,
    },
    fundamental: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "fundamental",
          status: "ok",
          source: "test",
          summary: `${symbol} liquidity access improved`,
        },
      ],
      summary: `${symbol} liquidity access improved`,
    },
    market: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "market",
          status: "ok",
          source: "test",
          summary: `${symbol} market signal confirmed`,
        },
      ],
      summary: `${symbol} market signal confirmed`,
    },
    memory: {
      status: "ok",
      items: [
        {
          id: "ev_1",
          domain: "memory",
          status: "ok",
          source: "test",
          summary: `${symbol} prior cases support disciplined sizing`,
        },
      ],
      summary: `${symbol} prior cases support disciplined sizing`,
    },
    dataStatus: {
      chart: "ok",
      news: "ok",
      onchain: "ok",
      fundamental: "ok",
      market: "ok",
      memory: "ok",
    },
  };
}

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

  it("omits a role from public inputs when analyst generation fails", async () => {
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => {
          if (memberId === "chart_analyst") throw new Error("llm failed");
          return analystOutput(memberId);
        }),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    const fallbackInput = result?.record.analystInputs.find(
      (input) => input.memberId === "chart_analyst",
    );
    expect(fallbackInput).toBeUndefined();
    expect(
      result?.record.roleExecutionTrace?.find((entry) => entry.memberId === "chart_analyst"),
    ).toMatchObject({
      executionMode: "skipped_by_policy",
      contributedToPmDecision: false,
    });
    expect(result?.record.roleExecutionTrace).toHaveLength(14);
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
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
    const generateLeadOutput = vi.fn(async () => ({
      rationale: "Evidence stack remains constructive",
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
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
    expect(writtenRecord.roleExecutionTrace).toHaveLength(14);
    expect(writtenRecord.roleExecutionTrace?.map((entry) => entry.memberId).sort()).toEqual(
      [
        "fundamental_analyst",
        "news_analyst",
        "chart_analyst",
        "onchain_analyst",
        "research_lead",
        "risk_lead",
        "pm",
        "bullish_researcher",
        "bearish_researcher",
        "trader",
        "aggressive_reviewer",
        "neutral_reviewer",
        "conservative_reviewer",
        "memory_loop",
      ].sort(),
    );
    expect(
      writtenRecord.roleExecutionTrace?.find((entry) => entry.memberId === "pm"),
    ).toMatchObject({
      executionMode: "core_active",
      contributedToPmDecision: true,
    });
    expect(
      writtenRecord.roleExecutionTrace?.find((entry) => entry.memberId === "chart_analyst"),
    ).toMatchObject({
      executionMode: "conditional_active",
      contributedToPmDecision: true,
    });
    expect(
      writtenRecord.roleExecutionTrace?.find((entry) => entry.memberId === "risk_lead"),
    ).toMatchObject({
      executionMode: "core_active",
      vetoOrWarning: true,
    });
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
    expect(result.publicTimelineEntry.payload).not.toHaveProperty("roleExecutionTrace");
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

  it("skips before recordWriter when LLM judge fails", async () => {
    const judgeFailure: DecisionJudgeResult = {
      verdict: "fail",
      fail_reason: "semantic_duplicate",
      fail_detail: "same thesis repeated across roles",
      confidence: 0.82,
      status: "ok",
      callCount: 1,
      inputTokenEstimate: 100,
      outputTokenEstimate: 20,
    };
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn();
    const updateDecisionRecord = vi.fn();
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        runDecisionJudge: vi.fn(async () => judgeFailure),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
        upsertDecisionRun,
      },
    );

    expect(result).toBeNull();
    expect(recordStrategyDecisionRecord).not.toHaveBeenCalled();
    expect(appendWatchHistoryEntry).not.toHaveBeenCalled();
    expect(updateDecisionRecord).not.toHaveBeenCalled();
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "skipped",
        skipReason: "llm_judge_fail",
        error: expect.stringContaining("judge_fail_reason:semantic_duplicate"),
        stageStatus: expect.objectContaining({
          record_write: "failed",
        }),
      }),
    );
  });

  it("continues to recordWriter when LLM judge passes", async () => {
    const judgePass: DecisionJudgeResult = {
      verdict: "pass",
      fail_reason: null,
      fail_detail: null,
      confidence: 0.78,
      status: "ok",
      callCount: 1,
      inputTokenEstimate: 100,
      outputTokenEstimate: 20,
    };
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        runDecisionJudge: vi.fn(async () => judgePass),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry: vi.fn(),
        updateDecisionRecord: vi.fn(),
      },
    );

    expect(result?.record.id).toBe("pm:BTC:1778407200000");
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
  });

  it("records a private run ledger through success", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
          confidence: 0.7,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord: vi.fn(async (record) => record),
        appendWatchHistoryEntry: vi.fn(),
        updateDecisionRecord: vi.fn(),
        upsertDecisionRun,
      },
    );

    expect(result?.record.id).toBe("pm:BTC:1778407200000");
    expect(upsertDecisionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run:pm:BTC:1778407200000",
        status: "running",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: expect.objectContaining({ candidateType: "symbol", symbol: "BTC" }),
      }),
    );
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "run:pm:BTC:1778407200000",
        status: "succeeded",
        decisionRecordId: "pm:BTC:1778407200000",
        publicTimelineEventId: "public:pm:BTC:1778407200000",
        quality: expect.objectContaining({
          schemaVersion: 1,
          score: expect.any(Number),
          warningCount: expect.any(Number),
          leakCount: 0,
          warnings: expect.any(Array),
          trade: expect.objectContaining({
            hasTradeCard: true,
            actionable: true,
          }),
        }),
        analystRoundCount: 22,
        abstainedMemberIds: [],
        completedAt: expect.any(String),
        stageStatus: expect.objectContaining({
          analyst_inputs: "done",
          research_lead: "done",
          risk_lead: "done",
          trade_decision: "done",
          record_write: "done",
          public_timeline: "done",
        }),
      }),
    );
  });

  it("uses a public source-evidence fallback when every analyst output abstains", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
    });
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn();
    const generateLeadOutput = vi.fn(async () => ({
      rationale: "Evidence stack remains constructive",
      confidence: 0.7,
    }));
    const generateTradeDecision = vi.fn(async () => decision());

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async () => {
          throw new Error("provider unavailable");
        }),
        generateLeadOutput,
        generateTradeDecision,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
        upsertDecisionRun,
      },
    );

    expect(result).not.toBeNull();
    expect(generateLeadOutput).toHaveBeenCalled();
    expect(generateTradeDecision).toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).toHaveBeenCalled();
    expect(appendWatchHistoryEntry).toHaveBeenCalled();
    expect(result?.publicTimelineEntry.payload).toEqual(
      expect.objectContaining({
        kind: "pm_decision",
        rounds: expect.arrayContaining([
          expect.objectContaining({
            agentId: "pa_02",
            round: 1,
            rationale: expect.stringContaining("公开行情与新闻信号已完成汇总"),
          }),
        ]),
      }),
    );
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "run:pm:BTC:1778407200000",
        status: "succeeded",
        skipReason: null,
        analystRoundCount: 1,
        completedAt: expect.any(String),
        stageStatus: expect.objectContaining({
          analyst_inputs: "done",
        }),
      }),
    );
  });

  it("publishes a fallback public run when information-collection output has no public voice", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
    });
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn();
    const generateLeadOutput = vi.fn(async () => ({
      rationale: "Evidence stack remains constructive",
      confidence: 0.7,
    }));

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId, prompt) => ({
          ...analystOutput(memberId),
          rationale: prompt.includes("Round 1")
            ? "等待后续数据更新再参与。"
            : "BTC holds 76000 with constructive momentum after peer review",
        })),
        generateLeadOutput,
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
        upsertDecisionRun,
      },
    );

    expect(result).not.toBeNull();
    expect(generateLeadOutput).toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).toHaveBeenCalled();
    expect(appendWatchHistoryEntry).toHaveBeenCalled();
    expect(result?.publicTimelineEntry.payload).toEqual(
      expect.objectContaining({
        kind: "pm_decision",
        rounds: expect.arrayContaining([
          expect.objectContaining({
            agentId: "pa_02",
            round: 1,
            rationale: expect.stringContaining("公开行情与新闻信号已完成汇总"),
          }),
        ]),
      }),
    );
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "succeeded",
        skipReason: null,
        publicTimelineEventId: "public:pm:BTC:1778407200000",
        stageStatus: expect.objectContaining({
          analyst_inputs: "done",
        }),
      }),
    );
  });

  it("adds an information-collection fallback when only non-information roles have public round one voice", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
    });
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn();
    const generateLeadOutput = vi.fn(async () => ({
      rationale: "Evidence stack remains constructive",
      confidence: 0.7,
    }));
    const informationCollectionMembers: TeamMemberId[] = [
      "fundamental_analyst",
      "news_analyst",
      "chart_analyst",
      "onchain_analyst",
    ];

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal()],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => ({
          ...analystOutput(memberId),
          rationale: informationCollectionMembers.includes(memberId)
            ? "等待后续数据更新再参与。"
            : "BTC holds 76000 with constructive momentum after peer review",
        })),
        generateLeadOutput,
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
        upsertDecisionRun,
      },
    );

    expect(result).not.toBeNull();
    expect(generateLeadOutput).toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).toHaveBeenCalled();
    expect(appendWatchHistoryEntry).toHaveBeenCalled();
    expect(result?.publicTimelineEntry.payload).toEqual(
      expect.objectContaining({
        kind: "pm_decision",
        rounds: expect.arrayContaining([
          expect.objectContaining({
            agentId: "pa_02",
            round: 1,
            rationale: expect.stringContaining("公开行情与新闻信号已完成汇总"),
          }),
        ]),
      }),
    );
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "succeeded",
        skipReason: null,
        publicTimelineEventId: "public:pm:BTC:1778407200000",
      }),
    );
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
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

  it("writes market overview as analysis-only without generating a trade card", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const updateDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => {
      void record;
    });
    const generateTradeDecision = vi.fn(async () => decision());
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "user_visit_trigger",
        candidate,
        recentMarketSignals: [signal(), signal({ symbol: "ETH", payload: { change24h: 3.2 } })],
        recentNewsEvidence: [evidence({ symbol: [] })],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack("MARKET"),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Market breadth and liquidity remain constructive",
          confidence: 0.68,
        })),
        generateTradeDecision,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(result?.record.candidate).toMatchObject({
      candidateType: "market_overview",
      executable: false,
    });
    expect(result?.record.symbol).toBe("MARKET");
    expect(result?.record.tradeDecision).toBeNull();
    expect(result?.record.analysisSummary).toContain("今日大盘综述");
    expect(result?.publicTimelineEntry.payload).toMatchObject({
      kind: "pm_decision",
      symbol: "MARKET",
      candidateType: "market_overview",
      candidateKey: candidate.candidateKey,
      displayTitle: candidate.displayTitle,
      executable: false,
      tradeDecision: null,
    });
    expect(generateTradeDecision).not.toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).toHaveBeenCalledWith(expect.any(Object), 0);
  });

  it("recovers a resident candidate when a lead LLM output is malformed", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const updateDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => {
      void record;
    });
    const generateLeadOutput = vi.fn(async (memberId: TeamMemberId) => {
      if (memberId === "research_lead") {
        throw new Error("Unterminated string in JSON at position 180");
      }
      return {
        rationale: "Risk review keeps the observation balanced around public signals",
        confidence: 0.61,
      };
    });
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        candidate,
        recentMarketSignals: [signal(), signal({ symbol: "ETH", payload: { change24h: 3.2 } })],
        recentNewsEvidence: [evidence({ symbol: [] })],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack("MARKET"),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput,
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord,
      },
    );

    expect(result?.record.candidate?.candidateType).toBe("market_overview");
    expect(result?.record.tradeDecision).toBeNull();
    expect(
      result?.record.analystInputs.find((input) => input.memberId === "research_lead"),
    ).toMatchObject({
      memberId: "research_lead",
      direction: "neutral",
    });
    expect(result?.record.analysisSummary).toBeTruthy();
    expect(recordStrategyDecisionRecord).toHaveBeenCalledTimes(1);
    expect(appendWatchHistoryEntry).toHaveBeenCalledTimes(1);
  });

  it("keeps symbol candidates strict when a lead LLM output is malformed", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
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
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async (memberId: TeamMemberId) => {
          if (memberId === "research_lead") {
            throw new Error("LLM output is not valid JSON");
          }
          return {
            rationale: "Risk review keeps the symbol setup balanced",
            confidence: 0.61,
          };
        }),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(),
      },
    );

    expect(result).toBeNull();
    expect(recordStrategyDecisionRecord).not.toHaveBeenCalled();
    expect(appendWatchHistoryEntry).not.toHaveBeenCalled();
  });

  it("blocks public timeline publishing when the persisted record fails the quality gate", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
    });
    const recordStrategyDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => ({
      ...record,
      analysisSummary: "暂无链上数据，维持 wait。",
    }));
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "user_visit_trigger",
        candidate,
        recentMarketSignals: [signal(), signal({ symbol: "ETH", payload: { change24h: 3.2 } })],
        recentNewsEvidence: [evidence({ symbol: [] })],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack("MARKET"),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Market breadth and liquidity remain constructive",
          confidence: 0.68,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
        upsertDecisionRun,
      },
    );

    expect(result).toBeNull();
    expect(appendWatchHistoryEntry).not.toHaveBeenCalled();
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "skipped",
        skipReason: "public_quality_gate_failed",
        quality: expect.objectContaining({
          warnings: expect.arrayContaining(["public_content_leak"]),
          publishable: false,
        }),
        publicTimelineEventId: null,
      }),
    );
  });

  it("blocks public timeline publishing when the persisted record is below the quality floor", async () => {
    const upsertDecisionRun = vi.fn(async (run: DecisionRunRecord) => {
      void run;
    });
    const repeated = "Cautious view repeats without a distinct role-specific contribution.";
    const recordStrategyDecisionRecord = vi.fn(async (record: StrategyDecisionRecord) => ({
      ...record,
      contributorIds: ["chart_analyst", "news_analyst"] as TeamMemberId[],
      analystInputs: [
        {
          memberId: "chart_analyst" as const,
          direction: "wait" as const,
          confidence: 0.25,
          rationale: repeated,
          oneLineSummary: repeated,
          detailedRationale: repeated,
          dataStatus: "ok" as const,
          evidenceIds: [],
          rounds: [],
        },
        {
          memberId: "news_analyst" as const,
          direction: "neutral" as const,
          confidence: 0.3,
          rationale: repeated,
          oneLineSummary: repeated,
          detailedRationale: repeated,
          dataStatus: "ok" as const,
          evidenceIds: [],
          rounds: [],
        },
      ],
      tradeDecision: null,
    }));
    const appendWatchHistoryEntry = vi.fn(async (entry: unknown) => {
      void entry;
    });
    const candidate = marketOverviewCandidate({ locale: "zh_CN", now });

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "user_visit_trigger",
        candidate,
        recentMarketSignals: [signal(), signal({ symbol: "ETH", payload: { change24h: 3.2 } })],
        recentNewsEvidence: [evidence({ symbol: [] })],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack("MARKET"),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Market breadth and liquidity remain constructive",
          confidence: 0.68,
        })),
        generateTradeDecision: vi.fn(async () => decision()),
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry,
        updateDecisionRecord: vi.fn(async (record: StrategyDecisionRecord) => {
          void record;
        }),
        upsertDecisionRun,
      },
    );

    expect(result).toBeNull();
    expect(appendWatchHistoryEntry).not.toHaveBeenCalled();
    expect(upsertDecisionRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "skipped",
        skipReason: "public_quality_gate_failed",
        quality: expect.objectContaining({
          warnings: expect.arrayContaining(["low_quality_score"]),
          blockingWarnings: expect.arrayContaining(["low_quality_score"]),
          publishable: false,
        }),
      }),
    );
  });

  it("does not fabricate a trade card when a symbol candidate has no current price", async () => {
    const recordStrategyDecisionRecord = vi.fn(async (record) => record);
    const generateTradeDecision = vi.fn(async () => decision());

    const result = await runPmDecisionPipeline(
      {
        triggerSource: "cron",
        recentMarketSignals: [signal({ payload: { description: "BTC momentum without price" } })],
        recentNewsEvidence: [evidence()],
        now,
      },
      {
        loadPromptDoc: async () => "prompt",
        buildEvidenceContextPack: async () => fullEvidenceContextPack(),
        generateAnalystOutput: vi.fn(async (memberId) => analystOutput(memberId)),
        generateLeadOutput: vi.fn(async () => ({
          rationale: "Evidence stack remains constructive",
          confidence: 0.7,
        })),
        generateTradeDecision,
        recordStrategyDecisionRecord,
        appendWatchHistoryEntry: vi.fn(),
        updateDecisionRecord: vi.fn(),
      },
    );

    expect(result).toBeNull();
    expect(generateTradeDecision).not.toHaveBeenCalled();
    expect(recordStrategyDecisionRecord).not.toHaveBeenCalled();
  });
});
