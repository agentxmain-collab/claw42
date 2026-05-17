import { describe, expect, it } from "vitest";
import {
  buildDecisionRecordIndex,
  filterPublicTimelineEvents,
  projectDecisionRecordToPublicEvent,
  projectStreamEntryToPublic,
} from "@/lib/watch/publicTimelineProjection";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { StreamEntry } from "@/modules/agent-watch/types";

const now = Date.now();

const tradeDecision: TradeDecision = {
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
  riskNote: "Risk can fade",
  invalidatesIf: "BTC loses 74800",
  promptVersion: "test",
  modelProvider: "stub",
  severity: "high",
};

const decisionRecord: StrategyDecisionRecord = {
  id: "record-1",
  schemaVersion: 1,
  recordSource: "live",
  symbol: "BTC",
  locale: "zh_CN",
  decisionOwnerId: "pm",
  contributorIds: ["fundamental_analyst", "research_lead", "risk_lead"],
  analystInputs: [
    {
      memberId: "fundamental_analyst",
      direction: "long",
      confidence: 0.7,
      rationale: "BTC spot demand is improving near 76000.",
      evidenceIds: ["ev_1"],
    },
    {
      memberId: "research_lead",
      direction: "long",
      confidence: 0.68,
      rationale: "Research lead keeps the long thesis unless 74800 breaks.",
      evidenceIds: ["ev_2"],
    },
    {
      memberId: "risk_lead",
      direction: "neutral",
      confidence: 0.54,
      rationale: "Risk lead wants confirmation above 76500.",
      evidenceIds: [],
    },
  ],
  sourceThreadId: "thread-2",
  tradeDecision,
  createdAt: new Date(now).toISOString(),
  evaluationWindowEndsAt: null,
  resolvedAt: null,
  resolvedOutcome: null,
  promptVersion: "test",
  modelProvider: "stub",
  legacyFactionId: null,
};

function focusEntry(overrides: Partial<StreamEntry> = {}): StreamEntry {
  return {
    kind: "focus_event",
    id: "focus-1",
    ts: now,
    symbol: "BTC",
    signalType: "breakout",
    severity: "alert",
    description: "BTC breakout",
    primaryResponse: { agentId: "alpha", content: "legacy", symbol: "BTC" },
    ...overrides,
  } as StreamEntry;
}

describe("publicTimelineProjection", () => {
  it("projects public high market signals", () => {
    const event = projectStreamEntryToPublic(focusEntry());
    expect(event?.payload.kind).toBe("market_signal");
    expect(event?.visibility).toBe("public");
    expect(event?.importance).toBe("high");
  });

  it("normalizes public market signal symbols", () => {
    const event = projectStreamEntryToPublic(focusEntry({ symbol: " $btc " }));

    if (event?.payload.kind !== "market_signal") throw new Error("expected market signal payload");
    expect(event.payload.symbol).toBe("BTC");
  });

  it("normalizes public news payload symbols", () => {
    const event = projectStreamEntryToPublic({
      kind: "news_debate",
      id: "news-1",
      ts: now,
      debate: {
        newsCurrencies: [" $eth ", "$$sol", "$"],
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "news",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
      },
    } as unknown as StreamEntry);

    if (event?.payload.kind !== "news") throw new Error("expected news payload");
    expect(event.payload.symbols).toEqual(["ETH", "SOL"]);
  });

  it("filters debug entries from public mode", () => {
    const event = projectStreamEntryToPublic(
      focusEntry({
        meta: {
          visibility: "debug",
          importance: "critical",
          sourceTrigger: "market_signal",
          evidenceIds: [],
          locale: "zh_CN",
        },
      }),
    );
    expect(event).toBeNull();
  });

  it("filters low and medium entries from public mode", () => {
    const low = focusEntry({
      id: "low",
      meta: {
        visibility: "public",
        importance: "low",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    const medium = focusEntry({
      id: "medium",
      meta: {
        visibility: "public",
        importance: "medium",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    expect(filterPublicTimelineEvents([low, medium], { mode: "public" })).toHaveLength(0);
  });

  it("filters public entries by requested locale", () => {
    const zh = focusEntry({
      id: "zh",
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    const en = focusEntry({
      id: "en",
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "en_US",
      },
    });

    expect(
      filterPublicTimelineEvents([zh, en], { mode: "public", locale: "en_US" }).map(
        (event) => event.id,
      ),
    ).toEqual(["en"]);
  });

  it("uses id as a stable order tie-breaker for equal timestamps", () => {
    const beta = focusEntry({ id: "market-beta", ts: now });
    const alpha = focusEntry({ id: "market-alpha", ts: now });

    expect(
      filterPublicTimelineEvents([beta, alpha], { mode: "public" }).map((event) => event.id),
    ).toEqual(["market-alpha", "market-beta"]);
  });

  it("does not project ambient chat-like entries", () => {
    const entry: StreamEntry = {
      kind: "watch_update",
      id: "watch-1",
      ts: now,
      updateType: "quiet_observation",
      title: "Quiet",
      content: "wait",
      dedupeKey: "quiet",
      severity: "neutral",
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "fallback",
        evidenceIds: [],
        locale: "zh_CN",
      },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("does not project chat_thread without pm decision provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-1",
      ts: now,
      thread: {
        id: "thread-1",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
      },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("projects pm decision threads with record provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-2",
      ts: now,
      thread: {
        id: "thread-2",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision,
      },
    };
    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[decisionRecord.id, decisionRecord]]),
    });
    expect(event?.payload.kind).toBe("pm_decision");
    expect(event?.payload.kind === "pm_decision" ? event.payload.tradeDecision?.id : null).toBe(
      "trade-1",
    );
    expect(event?.evidenceIds).toEqual(["ev_1", "ev_2"]);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.symbol).toBe("BTC");
    expect(event.payload.executable).toBe(true);
    expect(event.payload.rationaleByMember.fundamental_analyst).toContain("spot demand");
    expect(event.payload.rationaleByMember.research_lead).toContain("long thesis");
    expect(event.payload.rationaleByMember.risk_lead).toContain("Risk lead");
    expect(event.payload.citationsByMember?.fundamental_analyst).toEqual(["ev_1"]);
    expect(event.payload.citationsByMember?.research_lead).toEqual(["ev_2"]);
    expect(event.payload.citationsByMember?.risk_lead).toBeUndefined();
    expect(event.payload.rounds?.map((round) => `${round.memberId}:${round.round}`)).toEqual([
      "fundamental_analyst:1",
      "research_lead:1",
      "risk_lead:1",
    ]);
  });

  it("removes backstage wording from PM public projection without raw fallback", () => {
    const leakyRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-leaky",
      analystInputs: [
        {
          memberId: "onchain_analyst",
          direction: "wait",
          confidence: 0.2,
          rationale: "链上数据缺失，等待后续更新后再参与。",
          evidenceIds: ["ev_leaky"],
        },
        {
          memberId: "chart_analyst",
          direction: "short",
          confidence: 0.65,
          rationale: "BILL 跌破 42 后反抽失败，40 上方承压。",
          evidenceIds: ["ev_clean"],
        },
      ],
      tradeDecision: {
        ...tradeDecision,
        riskNote: "无成交量验证，等待链上数据更新。",
      },
    };
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-leaky",
      ts: now,
      thread: {
        id: "thread-leaky",
        seed: {
          id: "seed-leaky",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BILL"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        recordId: "record-leaky",
        tradeDecision: leakyRecord.tradeDecision,
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[leakyRecord.id, leakyRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.tradeDecision).toBeNull();
    expect(event.payload.rationaleByMember.onchain_analyst).toBeUndefined();
    expect(event.payload.citationsByMember?.onchain_analyst).toBeUndefined();
    expect(event.payload.rationaleByMember.chart_analyst).toContain("反抽失败");
    expect(event.payload.citationsByMember?.chart_analyst).toEqual(["ev_clean"]);
    expect(event.payload.rounds?.map((round) => round.memberId)).toEqual(["chart_analyst"]);
  });

  it("keeps watch-only PM records public and marks them non-executable", () => {
    const billRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-bill",
      symbol: "BILL",
      tradeDecision: {
        ...tradeDecision,
        id: "trade-bill",
        symbol: "BILL",
        direction: "wait",
      },
    };
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-bill",
      ts: now,
      thread: {
        id: "thread-bill",
        seed: {
          id: "seed-bill",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BILL"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        recordId: "record-bill",
        tradeDecision: billRecord.tradeDecision,
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[billRecord.id, billRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.symbol).toBe("BILL");
    expect(event.payload.executable).toBe(false);
  });

  it("falls back to PM record id symbol when history lacks record hydration", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-bill",
      ts: now,
      thread: {
        id: "thread-bill",
        seed: {
          id: "seed-bill",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: [],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["topic_selection:BILL:1"],
        locale: "zh_CN",
        recordId: "pm:BILL:1778902920550",
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map(),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.symbol).toBe("BILL");
    expect(event.payload.executable).toBe(false);
  });

  it("can project a PM decision directly from a strategy record", () => {
    const event = projectDecisionRecordToPublicEvent(decisionRecord);

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.id).toBe(`pm-decision:${decisionRecord.id}`);
    expect(event.payload.recordId).toBe(decisionRecord.id);
    expect(event.payload.symbol).toBe("BTC");
    expect(event.payload.candidateType).toBe("symbol");
    expect(event.payload.candidateKey).toBe("BTC");
    expect(event.payload.displayTitle).toBe("BTC 实时行情分析");
    expect(event.payload.executable).toBe(true);
    expect(event.payload.rounds).toHaveLength(3);
  });

  it("projects explicit non-symbol decision candidate metadata without dropping the record", () => {
    const marketRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-market-overview",
      symbol: "MARKET",
      tradeDecision: null,
      candidate: {
        candidateType: "market_overview",
        candidateKey: "market_overview:daily:zh_CN:2026-05-16",
        displayTitle: "今日大盘综述",
        executable: false,
        cadence: "daily",
        score: 100,
        reasons: [],
      },
    };

    const event = projectDecisionRecordToPublicEvent(marketRecord);

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.recordId).toBe("record-market-overview");
    expect(event.payload.candidateType).toBe("market_overview");
    expect(event.payload.candidateKey).toBe("market_overview:daily:zh_CN:2026-05-16");
    expect(event.payload.displayTitle).toBe("今日大盘综述");
    expect(event.payload.executable).toBe(false);
  });

  it("publishes a concise public analysis summary instead of the raw PM wall text", () => {
    const marketRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-market-summary",
      symbol: "MARKET",
      tradeDecision: null,
      analysisSummary:
        "今日大盘综述: 市场当前处于多空拉锯但空头证据更扎实的阶段。最强证据是 BTC ETF 周流出 10 亿美元，机构资金撤退信号明确。后续细节不应继续铺满公开卡片。",
      candidate: {
        candidateType: "market_overview",
        candidateKey: "market_overview:daily:zh_CN:2026-05-17",
        displayTitle: "今日大盘综述",
        executable: false,
        cadence: "daily",
        score: 100,
        reasons: [],
      },
    };

    const event = projectDecisionRecordToPublicEvent(marketRecord);

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.analysisSummary).toBe("市场当前处于多空拉锯但空头证据更扎实的阶段。");
  });

  it("projects schema v2 multi-round records while keeping latest rationale maps", () => {
    const v2Record: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-v2",
      schemaVersion: 2,
      analystInputs: [
        {
          memberId: "fundamental_analyst",
          direction: "long",
          confidence: 0.78,
          rationale: "Round two final fundamental view.",
          evidenceIds: ["ev_2"],
          rounds: [
            {
              round: 1,
              direction: "neutral",
              confidence: 0.52,
              rationale: "Round one fundamental view.",
              evidenceIds: ["ev_1"],
              observedAt: new Date(now - 30_000).toISOString(),
            },
            {
              round: 2,
              direction: "long",
              confidence: 0.78,
              rationale: "Round two final fundamental view.",
              evidenceIds: ["ev_2"],
              observedAt: new Date(now).toISOString(),
            },
          ],
        },
      ],
    };
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-v2",
      ts: now,
      thread: {
        id: "thread-v2",
        seed: {
          id: "seed-v2",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        recordId: "record-v2",
        tradeDecision,
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[v2Record.id, v2Record]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.rationaleByMember.fundamental_analyst).toBe(
      "Round two final fundamental view.",
    );
    expect(event.payload.citationsByMember?.fundamental_analyst).toEqual(["ev_2"]);
    expect(event.payload.rounds).toEqual([
      expect.objectContaining({
        round: 1,
        memberId: "fundamental_analyst",
        rationale: "Round one fundamental view.",
      }),
      expect.objectContaining({
        round: 2,
        memberId: "fundamental_analyst",
        rationale: "Round two final fundamental view.",
      }),
    ]);
    expect(event.evidenceIds).toEqual(["ev_2", "ev_1"]);
  });

  it("projects all fourteen real team member rationales", () => {
    const members: TeamMemberId[] = [
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
    ];
    const fullRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-14",
      contributorIds: members,
      analystInputs: members.map((memberId, index) => ({
        memberId,
        direction: memberId === "bearish_researcher" ? "short" : "long",
        confidence: 0.65,
        rationale: `Decision view ${index + 1} stays constructive near 76000.`,
        evidenceIds: memberId === "pm" ? ["ev_1"] : [],
      })),
    };
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-14",
      ts: now,
      thread: {
        id: "thread-14",
        seed: {
          id: "seed-14",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
        recordId: "record-14",
        tradeDecision,
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[fullRecord.id, fullRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(Object.keys(event.payload.rationaleByMember).sort()).toEqual([...members].sort());
    expect(event.payload.citationsByMember?.pm).toEqual(["ev_1"]);
    expect(event.evidenceIds).toEqual(["ev_1"]);
  });

  it("prefers indexed decision record trade decisions over stale entry metadata", () => {
    const staleTradeDecision: TradeDecision = {
      ...tradeDecision,
      id: "stale-trade",
      symbol: "ETH",
      direction: "short",
      generatedAt: new Date(now - 60_000).toISOString(),
    };
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-stale-meta",
      ts: now,
      thread: {
        id: "thread-stale-meta",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision: staleTradeDecision,
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[decisionRecord.id, decisionRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.symbol).toBe("BTC");
    expect(event.payload.tradeDecision?.id).toBe("trade-1");
    expect(event.payload.tradeDecision?.direction).toBe("long");
  });

  it("normalizes PM decision payload symbols before API exposure", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-dirty-symbol",
      ts: now,
      thread: {
        id: "thread-dirty-symbol",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["ETH"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision: {
          ...tradeDecision,
          symbol: " $$eth ",
        },
      },
    };
    const dirtyRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      symbol: " $$eth ",
      tradeDecision: {
        ...tradeDecision,
        symbol: " $$eth ",
      },
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[dirtyRecord.id, dirtyRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.symbol).toBe("ETH");
    expect(event.payload.tradeDecision?.symbol).toBe("ETH");
  });

  it("projects legacy PM records without analyst input arrays", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-legacy-record",
      ts: now,
      thread: {
        id: "thread-legacy-record",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision,
      },
    };
    const legacyRecord = {
      ...decisionRecord,
      analystInputs: undefined,
    } as unknown as StrategyDecisionRecord;

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[legacyRecord.id, legacyRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.tradeDecision?.id).toBe("trade-1");
    expect(event.payload.rationaleByMember).toEqual({});
    expect(event.payload.citationsByMember).toEqual({});
  });

  it("projects resolved PM decision outcome into the public payload", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-resolved",
      ts: now,
      thread: {
        id: "thread-resolved",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision,
      },
    };
    const resolvedRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      resolvedAt: new Date(now + 30 * 60_000).toISOString(),
      resolvedOutcome: "hit_tp",
      resolvedPrice: 78000,
      resolutionReason: "take_profit_reached",
      resolutionPriceSource: "coinw-kline",
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[resolvedRecord.id, resolvedRecord]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.resolution).toEqual({
      outcome: "hit_tp",
      resolvedAt: new Date(now + 30 * 60_000).toISOString(),
      observedPrice: 78000,
      observedPriceSource: "coinw-kline",
      reason: "take_profit_reached",
    });
  });

  it("projects only the safe stage trace subset into PM decision payload", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-stage-trace",
      ts: now,
      thread: {
        id: "thread-stage-trace",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision,
      },
    };
    const recordWithTrace: StrategyDecisionRecord = {
      ...decisionRecord,
      stageTrace: [
        {
          stageId: "analyst_inputs",
          label: "Analyst input generation",
          status: "done",
          observedAt: new Date(now).toISOString(),
          startedAt: new Date(now - 200).toISOString(),
          completedAt: new Date(now - 20).toISOString(),
          durationMs: 180,
          memberIds: ["fundamental_analyst"],
          note: "internal note",
          modelProvider: "private-provider",
          promptVersion: "private-prompt",
        },
      ],
    };

    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[recordWithTrace.id, recordWithTrace]]),
    });

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.stageTrace).toEqual([
      {
        stageId: "analyst_inputs",
        status: "done",
        observedAt: new Date(now).toISOString(),
        memberIds: ["fundamental_analyst"],
      },
    ]);
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("durationMs");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("startedAt");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("completedAt");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("internal note");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("Analyst input generation");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("private-provider");
    expect(JSON.stringify(event.payload.stageTrace)).not.toContain("private-prompt");
  });

  it("normalizes internal stage trace order before public exposure", () => {
    const recordWithTrace: StrategyDecisionRecord = {
      ...decisionRecord,
      id: "record-internal-order",
      tradeDecision: null,
      stageTrace: [
        {
          stageId: "analyst_inputs",
          label: "Analyst input generation",
          status: "done",
          observedAt: new Date(now - 180_000).toISOString(),
        },
        {
          stageId: "research_lead",
          label: "Research synthesis",
          status: "done",
          observedAt: new Date(now - 120_000).toISOString(),
        },
        {
          stageId: "risk_lead",
          label: "Risk review",
          status: "in_progress",
          observedAt: new Date(now - 60_000).toISOString(),
        },
        {
          stageId: "trade_decision",
          label: "Trade plan",
          status: "done",
          observedAt: new Date(now).toISOString(),
        },
      ],
    };

    const event = projectDecisionRecordToPublicEvent(recordWithTrace);

    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.tradeDecision).toBeNull();
    expect(event.payload.stageTrace?.map((entry) => `${entry.stageId}:${entry.status}`)).toEqual([
      "analyst_inputs:done",
      "research_lead:done",
      "risk_lead:pending",
      "trade_decision:in_progress",
    ]);
  });

  it("keeps the newest duplicate decision record when building an index", () => {
    const resolvedRecord: StrategyDecisionRecord = {
      ...decisionRecord,
      resolvedAt: new Date(now + 30 * 60_000).toISOString(),
      resolvedOutcome: "hit_tp",
    };

    const index = buildDecisionRecordIndex([resolvedRecord, decisionRecord]);

    expect(index.get("record-1")?.resolvedOutcome).toBe("hit_tp");
  });
});
