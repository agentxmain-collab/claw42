import { describe, expect, it } from "vitest";
import { buildTopicSelectionEvidence, selectPmDecisionTopics } from "@/lib/team/topicSelector";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { CoinPoolPayload, SignalRecord } from "@/modules/agent-watch/types";

const now = Date.UTC(2026, 4, 13, 20, 0, 0);

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 1.2 },
      ETH: { price: 4200, change24h: -5.4 },
      SOL: { price: 220, change24h: 3.2 },
      USDT: { price: 1, change24h: 0.01 },
    },
    majors: [
      { symbol: "BTC", price: 101000, change24h: 1.2, category: "majors" },
      { symbol: "ETH", price: 4200, change24h: -5.4, category: "majors" },
    ],
    trending: [{ symbol: "SOL", price: 220, change24h: 3.2, category: "trending" }],
    opportunity: [],
    source: "coinw-kline",
  };
}

function signal(symbol: string, change24h: number, severity: SignalRecord["severity"]) {
  return {
    id: `signal-${symbol}`,
    ts: now,
    symbol,
    type: "range_change",
    severity,
    payload: {
      priceLevel: symbol === "ETH" ? 4200 : 101000,
      change24h,
      description: `${symbol} 24h ${change24h}%`,
    },
  } satisfies SignalRecord;
}

function evidence(overrides: Partial<NewsEvidence> = {}): NewsEvidence {
  return {
    id: "ev_eth",
    source: "CoinDesk",
    title: "ETH ETF flows accelerate",
    url: "https://example.com/eth-etf",
    publishedAt: new Date(now - 10 * 60_000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    symbol: ["ETH"],
    impactSeverity: "high",
    summary: "ETH ETF flows accelerate",
    ...overrides,
  };
}

function recentPmDecision(symbol: string, ts = now - 20 * 60_000): PublicTimelineEvent {
  return {
    id: `event-${symbol}`,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: `record-${symbol}`,
      symbol,
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

function decisionRecord(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:ETH:memory",
    schemaVersion: 1,
    recordSource: "live",
    symbol: "ETH",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(now - 90 * 60_000).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: new Date(now - 30 * 60_000).toISOString(),
    resolvedOutcome: "hit_sl",
    promptVersion: "test",
    modelProvider: "test",
    legacyFactionId: null,
    ...overrides,
  };
}

describe("selectPmDecisionTopics", () => {
  it("ranks candidates by news severity and market alert strength", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("BTC", 1.2, "watch"), signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      now,
    });

    expect(topics.map((topic) => topic.symbol)).toEqual(["ETH", "SOL", "BTC"]);
    expect(topics[0].scoreBreakdown).toEqual({
      news: 60,
      market: 40,
      momentum: 32.400000000000006,
      pool: 1,
      memory: 0,
      total: 133.4,
    });
    expect(topics[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "news", label: "high impact news" }),
        expect.objectContaining({ kind: "market", label: "alert signal" }),
      ]),
    );
  });

  it("keeps an explicit symbol as the only candidate", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      symbol: "BTC",
      now,
    });

    expect(topics.map((topic) => topic.symbol)).toEqual(["BTC"]);
  });

  it("normalizes explicit symbols before matching signals and news", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      symbol: " $$eth ",
      now,
    });

    expect(topics.map((topic) => topic.symbol)).toEqual(["ETH"]);
    expect(topics[0].marketSignalIds).toEqual(["signal-ETH"]);
    expect(topics[0].newsEvidenceIds).toEqual(["ev_eth"]);
  });

  it("drops unusable explicit symbols instead of creating empty candidates", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      symbol: " $ ",
      now,
    });

    expect(topics).toEqual([]);
  });

  it("suppresses recently covered PM decision symbols during automatic ranking", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [
        signal("BTC", 3.3, "alert"),
        signal("ETH", -5.4, "alert"),
        signal("SOL", 3.2, "alert"),
      ],
      newsEvidence: [evidence()],
      recentTimelineEvents: [recentPmDecision("ETH")],
      now,
    });

    expect(topics.map((topic) => topic.symbol)).toEqual(["SOL", "BTC"]);
  });

  it("feeds recent resolved decision memory into ranking and selection evidence", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      recentDecisionRecords: [decisionRecord()],
      now,
    });

    expect(topics[0]).toMatchObject({
      symbol: "ETH",
      scoreBreakdown: expect.objectContaining({
        memory: -10,
        total: 123.4,
      }),
    });

    const selection = buildTopicSelectionEvidence(topics[0], now);
    expect(selection.summary).toContain("复盘记忆");
    expect(selection.summary).toContain("复盘记忆是约束");
    expect(selection.summary).toContain("上一轮触发止损");
  });

  it("uses trade decision symbols for memory when legacy record symbols are unusable", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      recentDecisionRecords: [
        decisionRecord({
          symbol: "UNKNOWN",
          tradeDecision: {
            symbol: " $eth ",
          } as StrategyDecisionRecord["tradeDecision"],
        }),
      ],
      now,
    });

    expect(topics[0]).toMatchObject({
      symbol: "ETH",
      scoreBreakdown: expect.objectContaining({
        memory: -10,
      }),
    });
  });

  it("falls back to news symbols when the CoinW pool is unavailable", () => {
    const topics = selectPmDecisionTopics({
      newsEvidence: [evidence({ symbol: ["SUI"], id: "ev_sui", summary: "Sui rally accelerates" })],
      now,
    });

    expect(topics[0]).toMatchObject({
      symbol: "SUI",
      scoreBreakdown: {
        news: 60,
        market: 0,
        momentum: 0,
        pool: 0,
        memory: 0,
        total: 60,
      },
      newsEvidenceIds: ["ev_sui"],
    });
  });

  it("keeps opportunity-pool symbols in the candidate set after majors and trending fill six slots", () => {
    const expandedPool: CoinPoolPayload = {
      ...pool(),
      majors: [
        { symbol: "BTC", price: 101000, change24h: 0.2, category: "majors" },
        { symbol: "ETH", price: 4200, change24h: 0.3, category: "majors" },
        { symbol: "SOL", price: 220, change24h: 0.4, category: "majors" },
      ],
      trending: [
        { symbol: "TAO", price: 520, change24h: 0.5, category: "trending" },
        { symbol: "HYPE", price: 34, change24h: 0.6, category: "trending" },
        { symbol: "ENA", price: 0.8, change24h: 0.7, category: "trending" },
      ],
      opportunity: [{ symbol: "BLEND", price: 0.12, change24h: 18, category: "opportunity" }],
    };

    const topics = selectPmDecisionTopics({
      pool: expandedPool,
      now,
    });

    expect(topics[0]).toMatchObject({
      symbol: "BLEND",
      scoreBreakdown: expect.objectContaining({
        momentum: 108,
        pool: 2,
      }),
    });
    expect(topics.map((topic) => topic.symbol)).toContain("BLEND");
  });

  it("marks explicit executable and watch-only symbols from symbol metadata", () => {
    const topics = selectPmDecisionTopics({
      pool: {
        ...pool(),
        trending: [
          { symbol: "HYPE", price: 36, change24h: 4.2, category: "trending" },
          { symbol: "BILL", price: 0.01, change24h: 18, category: "trending" },
        ],
      },
      now,
    });

    expect(topics.find((topic) => topic.symbol === "HYPE")?.execution).toMatchObject({
      executable: true,
      coinwPair: "HYPE_USDT",
      watchOnly: false,
    });
    expect(topics.find((topic) => topic.symbol === "BILL")?.execution).toMatchObject({
      executable: false,
      coinwPair: null,
      watchOnly: true,
      watchOnlyReason: "not_listed_on_coinw",
    });
  });

  it("does not treat unknown fallback pair strings as executable", () => {
    const [topic] = selectPmDecisionTopics({
      newsEvidence: [
        evidence({ symbol: ["UNKNOWNCOIN"], id: "ev_unknown", summary: "Unknown coin rallies" }),
      ],
      now,
    });

    expect(topic).toMatchObject({
      symbol: "UNKNOWNCOIN",
      execution: {
        executable: false,
        coinwPair: null,
        watchOnly: true,
        watchOnlyReason: "mapping_unknown",
      },
    });
  });

  it("anchors symbol-less market news to BTC instead of every pool candidate", () => {
    const topics = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [
        signal("BTC", 1.2, "watch"),
        signal("ETH", -5.4, "alert"),
        signal("SOL", 3.2, "alert"),
      ],
      newsEvidence: [
        evidence({
          id: "ev_market",
          symbol: [],
          title: "Crypto market liquidity stress rises",
          summary: "Crypto market liquidity stress rises",
        }),
      ],
      now,
    });

    expect(topics.find((topic) => topic.symbol === "BTC")?.newsEvidenceIds).toEqual(["ev_market"]);
    expect(topics.find((topic) => topic.symbol === "BTC")?.scoreBreakdown.news).toBe(60);
    expect(topics.find((topic) => topic.symbol === "ETH")?.newsEvidenceIds).toEqual([]);
    expect(topics.find((topic) => topic.symbol === "ETH")?.scoreBreakdown.news).toBe(0);
    expect(topics.find((topic) => topic.symbol === "SOL")?.newsEvidenceIds).toEqual([]);
    expect(topics.find((topic) => topic.symbol === "SOL")?.scoreBreakdown.news).toBe(0);
  });

  it("keeps BTC as the final fallback when no pool, signal, or news symbol exists", () => {
    const topics = selectPmDecisionTopics({ now });

    expect(topics.map((topic) => topic.symbol)).toEqual(["BTC"]);
    expect(topics[0].scoreBreakdown.total).toBe(0);
  });

  it("builds public selection evidence with a readable score breakdown", () => {
    const [topic] = selectPmDecisionTopics({
      pool: pool(),
      marketSignals: [signal("ETH", -5.4, "alert")],
      newsEvidence: [evidence()],
      now,
    });

    const selection = buildTopicSelectionEvidence(topic, now);

    expect(selection.id).toBe("topic_selection:ETH:1778702400000");
    expect(selection.url).toBe("#");
    expect(selection.symbol).toEqual(["ETH"]);
    expect(selection.summary).toBe(
      "本轮优先分析 ETH：新闻冲击、市场信号是主因；24h波动、候选池提供辅助。依据：新闻冲击：ETH ETF flows accelerate；市场信号：ETH 24h -5.4%；24h波动：24h -5.40%；候选池：主流高流动性池。",
    );
    expect(selection.summary).toContain("ETH");
    expect(selection.summary).toContain("新闻冲击");
    expect(selection.summary).toContain("市场信号");
    expect(selection.summary).toContain("24h -5.40%");
    expect(selection.summary).toContain("新闻冲击、市场信号是主因");
    expect(selection.summary).toContain("24h波动、候选池提供辅助");
    expect(selection.summary).not.toContain("high impact news");
  });
});
