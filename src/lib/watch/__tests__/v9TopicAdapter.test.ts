import { describe, expect, it } from "vitest";
import arSA from "@/i18n/dicts/ar_SA.json";
import enUS from "@/i18n/dicts/en_US.json";
import jaJP from "@/i18n/dicts/ja_JP.json";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type {
  Dict,
  DispatchV10OutcomeDict,
  DispatchV10RoundDict,
  DispatchV10StageStatusDict,
  DispatchV10TopicRankingDict,
  Locale,
} from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { mapPublicTimelineEventsToTopics, type V9AdapterContext } from "@/lib/watch/v9TopicAdapter";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.UTC(2026, 4, 13, 8, 0, 0);

const tradeDecision: TradeDecision = {
  id: "trade-1",
  schemaVersion: 1,
  symbol: "BTC",
  generatedBy: "pm",
  generatedAt: new Date(now).toISOString(),
  direction: "short",
  entryType: "limit",
  entryPrice: 80500,
  entryRange: { low: 80300, high: 80700 },
  stopLoss: 81200,
  takeProfit: [79000, 78000],
  positionSizing: 0.06,
  timeHorizon: "intraday",
  rating: 4,
  confidence: 0.78,
  evidenceIds: ["ev_1"],
  riskNote: "Risk budget remains inside the limit.",
  invalidatesIf: "BTC reclaims 81200",
  promptVersion: "test",
  modelProvider: "stub",
  severity: "high",
};

const evidence: NewsEvidence = {
  id: "ev_1",
  source: "CoinDesk",
  title: "BTC ETF outflows rise",
  url: "https://example.com/btc",
  publishedAt: new Date(now - 60_000).toISOString(),
  fetchedAt: new Date(now).toISOString(),
  symbol: ["BTC"],
  impactSeverity: "high",
  summary: "ETF outflows rise and support is under pressure",
};

const OUTCOME_DICTS: Record<"zh_CN" | "en_US" | "ja_JP" | "ar_SA", DispatchV10OutcomeDict> = {
  zh_CN: (zhCN as Dict).agentWatch.dispatchV10.outcome,
  en_US: (enUS as Dict).agentWatch.dispatchV10.outcome,
  ja_JP: (jaJP as Dict).agentWatch.dispatchV10.outcome,
  ar_SA: (arSA as Dict).agentWatch.dispatchV10.outcome,
};
const ROUND_DICTS: Record<"zh_CN" | "en_US" | "ja_JP" | "ar_SA", DispatchV10RoundDict> = {
  zh_CN: (zhCN as Dict).agentWatch.dispatchV10.round,
  en_US: (enUS as Dict).agentWatch.dispatchV10.round,
  ja_JP: (jaJP as Dict).agentWatch.dispatchV10.round,
  ar_SA: (arSA as Dict).agentWatch.dispatchV10.round,
};
const STAGE_STATUS_DICTS: Record<
  "zh_CN" | "en_US" | "ja_JP" | "ar_SA",
  DispatchV10StageStatusDict
> = {
  zh_CN: (zhCN as Dict).agentWatch.dispatchV10.stageStatus,
  en_US: (enUS as Dict).agentWatch.dispatchV10.stageStatus,
  ja_JP: (jaJP as Dict).agentWatch.dispatchV10.stageStatus,
  ar_SA: (arSA as Dict).agentWatch.dispatchV10.stageStatus,
};
const TOPIC_RANKING_DICTS: Record<
  "zh_CN" | "en_US" | "ja_JP" | "ar_SA",
  DispatchV10TopicRankingDict
> = {
  zh_CN: (zhCN as Dict).agentWatch.dispatchV10.topicRanking,
  en_US: (enUS as Dict).agentWatch.dispatchV10.topicRanking,
  ja_JP: (jaJP as Dict).agentWatch.dispatchV10.topicRanking,
  ar_SA: (arSA as Dict).agentWatch.dispatchV10.topicRanking,
};

function outcomeDictFor(locale: Locale) {
  return OUTCOME_DICTS[(locale as keyof typeof OUTCOME_DICTS) ?? "zh_CN"] ?? OUTCOME_DICTS.zh_CN;
}

function roundDictFor(locale: Locale) {
  return ROUND_DICTS[(locale as keyof typeof ROUND_DICTS) ?? "zh_CN"] ?? ROUND_DICTS.zh_CN;
}

function stageStatusDictFor(locale: Locale) {
  return (
    STAGE_STATUS_DICTS[(locale as keyof typeof STAGE_STATUS_DICTS) ?? "zh_CN"] ??
    STAGE_STATUS_DICTS.zh_CN
  );
}

function topicRankingDictFor(locale: Locale) {
  return (
    TOPIC_RANKING_DICTS[(locale as keyof typeof TOPIC_RANKING_DICTS) ?? "zh_CN"] ??
    TOPIC_RANKING_DICTS.zh_CN
  );
}

function mapTopics(
  ctx: Omit<
    V9AdapterContext,
    "outcomeDict" | "roundDict" | "stageStatusDict" | "topicRankingDict"
  > & {
    outcomeDict?: DispatchV10OutcomeDict;
    roundDict?: DispatchV10RoundDict;
    stageStatusDict?: DispatchV10StageStatusDict;
    topicRankingDict?: DispatchV10TopicRankingDict;
  },
) {
  return mapPublicTimelineEventsToTopics({
    ...ctx,
    outcomeDict: ctx.outcomeDict ?? outcomeDictFor(ctx.locale),
    roundDict: ctx.roundDict ?? roundDictFor(ctx.locale),
    stageStatusDict: ctx.stageStatusDict ?? stageStatusDictFor(ctx.locale),
    topicRankingDict: ctx.topicRankingDict ?? topicRankingDictFor(ctx.locale),
  });
}

function pmDecision(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "event-1",
    ts: now,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: ["ev_1"],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "record-1",
      symbol: "BTC",
      tradeDecision,
      rationaleByMember: {
        chart_analyst: "BTC is testing support.",
        onchain_analyst: "Exchange inflow increased.",
        research_lead: "Short thesis is stronger.",
        risk_lead: "Keep sizing conservative.",
      },
      citationsByMember: {
        chart_analyst: ["ev_1"],
      },
    },
    ...overrides,
  };
}

function pmDecisionWithRecordId(recordId: string, overrides: Partial<PublicTimelineEvent> = {}) {
  const event = pmDecision(overrides);
  if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
  return {
    ...event,
    payload: {
      ...event.payload,
      recordId,
    },
  };
}

function withResolution(
  outcome: NonNullable<
    Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>["resolution"]
  >["outcome"],
  overrides: Partial<
    NonNullable<Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>["resolution"]>
  > = {},
): PublicTimelineEvent {
  const event = pmDecision();
  if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
  return {
    ...event,
    payload: {
      ...event.payload,
      resolution: {
        outcome,
        resolvedAt: new Date(now + 30 * 60_000).toISOString(),
        observedPrice: 78000,
        observedPriceSource: "coinw-kline",
        reason:
          outcome === "hit_sl"
            ? "stop_loss_reached"
            : outcome === "expired"
              ? "evaluation_window_elapsed"
              : "take_profit_reached",
        ...overrides,
      },
    },
  };
}

describe("mapPublicTimelineEventsToTopics", () => {
  it("keeps the latest displayable hotspot when a newer hotspot has no public collection voice", () => {
    const older = pmDecision({
      id: "event-hotspot-displayable",
      ts: now - 10 * 60_000,
      evidenceIds: [],
    });
    const newer = pmDecision({
      id: "event-hotspot-not-displayable",
      ts: now,
      evidenceIds: [],
    });
    if (older.payload.kind !== "pm_decision" || newer.payload.kind !== "pm_decision") {
      throw new Error("expected pm decision fixtures");
    }

    const topics = mapTopics({
      events: [
        {
          ...older,
          payload: {
            ...older.payload,
            recordId: "record-hotspot-displayable",
            symbol: "HOTSPOT",
            candidateType: "hotspot",
            candidateKey: "hotspot:older",
            displayTitle: "热点叙事追踪",
            tradeDecision: null,
            rounds: [
              {
                round: 1,
                memberId: "news_analyst",
                direction: "long",
                confidence: 0.58,
                rationale: "Round one public hotspot collection is ready.",
                evidenceIds: [],
              },
            ],
            rationaleByMember: {
              news_analyst: "Round one public hotspot collection is ready.",
            },
          },
        },
        {
          ...newer,
          payload: {
            ...newer.payload,
            recordId: "record-hotspot-not-displayable",
            symbol: "HOTSPOT",
            candidateType: "hotspot",
            candidateKey: "hotspot:newer",
            displayTitle: "热点叙事追踪",
            tradeDecision: null,
            rounds: [
              {
                round: 2,
                memberId: "bullish_researcher",
                direction: "long",
                confidence: 0.61,
                rationale: "Round two debate should not publish before round one.",
                evidenceIds: [],
              },
            ],
            rationaleByMember: {
              bullish_researcher: "Round two debate should not publish before round one.",
            },
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({
      id: "record-hotspot-displayable",
      symbol: "HOTSPOT",
      title: "热点叙事追踪",
    });
  });

  it("adapts a real pm_decision event into a v9 dispatch topic", () => {
    const [topic] = mapTopics({
      events: [pmDecision()],
      evidenceMap: { ev_1: evidence },
      followStatsByRecordId: {
        "record-1": { watchCount: 12, followCount: 3, userFollowed: false },
      },
      locale: "zh_CN",
      now,
    });

    expect(topic).toMatchObject({
      id: "record-1",
      symbol: "BTC",
      status: "done",
      title: "BTC 实时行情分析",
      explanation: "ETF outflows rise and support is under pressure",
      originalUrl: "https://example.com/btc",
      sourceLabel: "CoinDesk",
      intensity: 5,
      topicRanking: {
        score: 87,
        intensity: 5,
        rank: 1,
        rankLabel: "排序 #1",
        explanation: "BTC 因 1 条新闻 + 78% 置信度排第 1",
      },
      trigger: {
        ticker: "$BTC",
        text: "ETF outflows rise and support is under pressure",
      },
      strategy: {
        action: "short",
        actionLabel: "SHORT 6%",
        entry: "80,300 - 80,700",
        stopLoss: "81,200",
        takeProfit: "79,000 / 78,000",
        follow: { watchCount: 12, followCount: 3 },
      },
    });
    expect(topic.stages).toHaveLength(6);
    expect(topic.stages[5]).toMatchObject({
      label: "阶段 6 · 复盘沉淀",
      status: "pending",
      note: "暂无复盘沉淀，等待结果回写",
    });
    expect(topic.title).not.toContain("live market check");
    expect(topic.stages[5]?.note).not.toContain("TODO");
    expect(topic.messages.map((message) => message.agentId)).toContain("technical_analyst");
    expect(topic.messages.map((message) => message.agentId)).toContain("portfolio_manager");
    expect(topic.messages.map((message) => message.agentName)).toEqual(
      expect.arrayContaining([
        "技术策略主管",
        "链上数据分析主管",
        "策略研究主管",
        "风控总监",
        "交易策略总监",
        "首席投资官",
      ]),
    );
    expect(topic.messages.map((message) => message.agentName)).not.toEqual(
      expect.arrayContaining(["K 哥", "Mira", "Vit", "老 R", "老 X", "PM", "决策经理"]),
    );
    expect(topic.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "bearish_researcher",
          sourceMemberId: "research_lead",
          agentName: "策略研究主管",
        }),
        expect.objectContaining({
          agentId: "neutral_reviewer",
          sourceMemberId: "risk_lead",
          agentName: "风控总监",
        }),
        expect.objectContaining({
          agentId: "portfolio_manager",
          sourceMemberId: "pm",
          agentName: "首席投资官",
        }),
      ]),
    );
    expect("source" in topic).toBe(false);
  });

  it("localizes pending memory-loop notes for unresolved decisions", () => {
    const [topic] = mapTopics({
      events: [pmDecision()],
      locale: "en_US",
      now,
    });

    expect(topic.stages[5]).toMatchObject({
      label: "阶段 6 · 复盘沉淀",
      status: "pending",
      note: "No review memory yet; awaiting outcome writeback.",
    });
  });

  it("drops non-CoinW futures symbol decisions from the public beta board", () => {
    const event = pmDecision({
      payload: {
        kind: "pm_decision",
        recordId: "record-irys",
        symbol: "IRYS",
        executable: false,
        tradeDecision: {
          ...tradeDecision,
          id: "trade-irys",
          symbol: "IRYS",
          direction: "long",
        },
        rationaleByMember: { research_lead: "IRYS is observable but not executable." },
        citationsByMember: {},
      },
    });

    const [topic] = mapTopics({
      events: [event],
      locale: "zh_CN",
      now,
    });

    expect(topic).toBeUndefined();
  });

  it("does not allow non-symbol topics to become followable even when payload says executable", () => {
    const event = pmDecision({
      payload: {
        kind: "pm_decision",
        recordId: "record-market",
        symbol: "MARKET",
        candidateType: "market_overview",
        candidateKey: "market_overview:zh_CN:2026-05-17",
        displayTitle: "今日大盘综述",
        executable: true,
        tradeDecision: null,
        analysisSummary: "大盘进入观察窗口。",
        rationaleByMember: { research_lead: "大盘进入观察窗口。" },
        citationsByMember: {},
      },
    });

    const [topic] = mapTopics({
      events: [event],
      locale: "zh_CN",
      now,
    });

    expect(topic.candidateType).toBe("market_overview");
    expect(topic.execution).toMatchObject({
      executable: false,
      watchOnly: true,
    });
    expect(topic.strategy).toMatchObject({
      mode: "observation",
      name: "观察结论",
      follow: {
        primaryDisabled: false,
      },
    });
  });

  it("ignores non pm_decision events", () => {
    expect(
      mapTopics({
        events: [
          { ...pmDecision(), payload: { kind: "news", evidenceId: "ev_1", symbols: ["BTC"] } },
        ],
        locale: "zh_CN",
        now,
      }),
    ).toEqual([]);
  });

  it("uses the latest decision when multiple decisions aggregate into one topic", () => {
    const topics = mapTopics({
      events: [
        pmDecisionWithRecordId("old-record", {
          id: "old-event",
          ts: now - 10 * 60 * 1000,
        }),
        pmDecisionWithRecordId("latest-record", { id: "latest-event" }),
      ],
      locale: "zh_CN",
      now,
    });

    expect(topics).toHaveLength(1);
    expect(topics[0].id).toBe("latest-record");
  });

  it("dedupes stale same-symbol executable records before rendering topic cards", () => {
    const topics = mapTopics({
      events: [
        pmDecisionWithRecordId("old-bill-record", {
          id: "old-bill-event",
          ts: now - 6 * 60 * 60 * 1000,
          payload: {
            kind: "pm_decision",
            recordId: "old-bill-record",
            symbol: "BILL",
            executable: true,
            tradeDecision: {
              ...tradeDecision,
              id: "trade-bill-old",
              symbol: "BILL",
              generatedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
            },
            rationaleByMember: { research_lead: "Old BILL view." },
            citationsByMember: {},
          },
        }),
        pmDecisionWithRecordId("latest-bill-record", {
          id: "latest-bill-event",
          ts: now,
          payload: {
            kind: "pm_decision",
            recordId: "latest-bill-record",
            symbol: "BILL",
            executable: true,
            tradeDecision: {
              ...tradeDecision,
              id: "trade-bill-latest",
              symbol: "BILL",
              generatedAt: new Date(now).toISOString(),
            },
            rationaleByMember: { research_lead: "Latest BILL view." },
            citationsByMember: {},
          },
        }),
      ],
      locale: "zh_CN",
      now,
    });

    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({
      id: "latest-bill-record",
      symbol: "BILL",
      execution: { executable: true, watchOnly: false },
    });
  });

  it("orders strategy topics by trade decision generation time", () => {
    const olderGeneratedDecision: TradeDecision = {
      ...tradeDecision,
      id: "trade-btc-older",
      symbol: "BTC",
      generatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    };
    const newerGeneratedDecision: TradeDecision = {
      ...tradeDecision,
      id: "trade-eth-newer",
      symbol: "ETH",
      generatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    };
    const btcEvent = pmDecisionWithRecordId("btc-record", {
      id: "btc-event",
      ts: now,
      payload: {
        kind: "pm_decision",
        recordId: "btc-record",
        symbol: "BTC",
        tradeDecision: olderGeneratedDecision,
        rationaleByMember: { research_lead: "BTC thesis is older." },
        citationsByMember: {},
      },
    });
    const ethEvent = pmDecisionWithRecordId("eth-record", {
      id: "eth-event",
      ts: now - 10 * 60 * 1000,
      payload: {
        kind: "pm_decision",
        recordId: "eth-record",
        symbol: "ETH",
        tradeDecision: newerGeneratedDecision,
        rationaleByMember: { research_lead: "ETH thesis is newer." },
        citationsByMember: {},
      },
    });

    const topics = mapTopics({
      events: [btcEvent, ethEvent],
      locale: "zh_CN",
      now,
    });

    expect(topics.map((topic) => topic.id)).toEqual(["eth-record", "btc-record"]);
  });

  it("orders strategy topics by ranking score before generated time", () => {
    const lowerScoreNewerDecision: TradeDecision = {
      ...tradeDecision,
      id: "trade-eth-lower",
      symbol: "ETH",
      generatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      confidence: 0.41,
    };
    const higherScoreOlderDecision: TradeDecision = {
      ...tradeDecision,
      id: "trade-btc-higher",
      symbol: "BTC",
      generatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      confidence: 0.93,
    };
    const btcEvent = pmDecisionWithRecordId("btc-record", {
      id: "btc-event",
      ts: now - 10 * 60 * 1000,
      payload: {
        kind: "pm_decision",
        recordId: "btc-record",
        symbol: "BTC",
        tradeDecision: higherScoreOlderDecision,
        rationaleByMember: { research_lead: "BTC higher score." },
        citationsByMember: {},
      },
    });
    const ethEvent = pmDecisionWithRecordId("eth-record", {
      id: "eth-event",
      ts: now,
      payload: {
        kind: "pm_decision",
        recordId: "eth-record",
        symbol: "ETH",
        tradeDecision: lowerScoreNewerDecision,
        rationaleByMember: { research_lead: "ETH newer but lower score." },
        citationsByMember: {},
      },
    });

    const topics = mapTopics({
      events: [ethEvent, btcEvent],
      locale: "zh_CN",
      now,
    });

    expect(topics.map((topic) => topic.id)).toEqual(["btc-record", "eth-record"]);
    expect(topics.map((topic) => topic.topicRanking?.rankLabel)).toEqual(["排序 #1", "排序 #2"]);
  });

  it("maps three complete real-shaped decision flows into stable topic cards", () => {
    const decisions: Array<{ symbol: string; direction: TradeDecision["direction"]; ts: number }> =
      [
        { symbol: "BTC", direction: "long", ts: now },
        { symbol: "ETH", direction: "short", ts: now - 5 * 60_000 },
        { symbol: "SOL", direction: "wait", ts: now - 10 * 60_000 },
      ];
    const events = decisions.map(({ symbol, direction, ts }) =>
      pmDecisionWithRecordId(`record-${symbol.toLowerCase()}`, {
        id: `event-${symbol.toLowerCase()}`,
        ts,
        evidenceIds: [`ev_${symbol.toLowerCase()}`],
        payload: {
          kind: "pm_decision",
          recordId: `record-${symbol.toLowerCase()}`,
          symbol,
          tradeDecision: {
            ...tradeDecision,
            id: `trade-${symbol.toLowerCase()}`,
            symbol,
            direction,
            generatedAt: new Date(ts).toISOString(),
            positionSizing: direction === "wait" ? 0 : 0.08,
          },
          rationaleByMember: {
            chart_analyst: `${symbol} technical setup is actionable.`,
            news_analyst: `${symbol} headline context is relevant.`,
            research_lead: `${symbol} synthesis is complete.`,
            risk_lead: `${symbol} risk boundary is defined.`,
          },
          citationsByMember: {
            news_analyst: [`ev_${symbol.toLowerCase()}`],
          },
        },
      }),
    );

    const topics = mapTopics({
      events,
      locale: "zh_CN",
      now,
    });

    expect(topics).toHaveLength(3);
    expect(topics.map((topic) => topic.symbol)).toEqual(["BTC", "ETH", "SOL"]);
    expect(topics.map((topic) => topic.defaultCollapsed)).toEqual([false, true, true]);
    expect(topics.map((topic) => topic.stages.map((stage) => stage.status))).toEqual([
      ["done", "done", "done", "done", "final", "pending"],
      ["done", "done", "done", "done", "final", "pending"],
      ["done", "done", "done", "done", "final", "pending"],
    ]);
    expect(topics.map((topic) => topic.strategy.actionLabel)).toEqual([
      "LONG 8%",
      "SHORT 8%",
      "WAIT",
    ]);
  });

  it("marks incomplete PM decisions with rationale as active analysis", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("active");
    expect(topic.title).toBe("BTC 实时行情分析");
    expect(topic.explanation).toBe("分析进行中");
    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 0 秒前");
    expect(topic.strategy).toMatchObject({
      action: "pending",
      actionLabel: "分析中",
      name: "尚未决策",
    });
    expect(topic.messages.some((message) => message.typing)).toBe(true);
  });

  it("uses public analysis summary before unrelated evidence copy for analysis-only records", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            candidateType: "market_overview",
            candidateKey: "market_overview:zh_CN:2026-05-17",
            displayTitle: "今日大盘综述",
            executable: false,
            analysisSummary: "市场当前处于多空拉锯但空头证据更扎实的阶段。",
            tradeDecision: null,
          },
        },
      ],
      evidenceMap: {
        ev_1: {
          ...evidence,
          summary: "OpenAI partners with Malta to give all citizens free ChatGPT Plus access",
        },
      },
      locale: "zh_CN",
      now,
    });

    expect(topic.title).toBe("今日大盘综述");
    expect(topic.explanation).toBe("市场当前处于多空拉锯但空头证据更扎实的阶段。");
    expect(topic.trigger.text).toBe("市场当前处于多空拉锯但空头证据更扎实的阶段。");
  });

  it("marks completed analysis-only records closed instead of leaving progress at stage 3", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const eventTs = now - 12 * 60_000;
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          ts: eventTs,
          payload: {
            ...event.payload,
            recordId: "market-complete",
            symbol: "MARKET",
            candidateType: "market_overview",
            candidateKey: "market_overview:zh_CN:2026-05-13",
            displayTitle: "今日大盘综述",
            executable: false,
            analysisSummary: "今日大盘分析已完成。",
            tradeDecision: null,
            rationaleByMember: {
              research_lead: "多空观点已经完成汇总。",
              risk_lead: "风险边界已经完成审查。",
            },
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(eventTs - 240_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "done",
                observedAt: new Date(eventTs - 180_000).toISOString(),
              },
              {
                stageId: "trade_decision",
                status: "done",
                observedAt: new Date(eventTs - 120_000).toISOString(),
              },
              {
                stageId: "risk_lead",
                status: "done",
                observedAt: new Date(eventTs - 60_000).toISOString(),
              },
              {
                stageId: "record_write",
                status: "done",
                observedAt: new Date(eventTs - 30_000).toISOString(),
              },
              {
                stageId: "public_timeline",
                status: "done",
                observedAt: new Date(eventTs).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("done");
    expect(topic.progress).toBe("12 分钟闭环");
    expect(topic.stages.slice(0, 4).map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(topic.stages[4]).toMatchObject({
      label: "阶段 5 · 观察结论",
      status: "done",
      note: "观察结论已完成，不涉及具体交易",
    });
    expect(topic.stages[5]).toMatchObject({
      label: "阶段 6 · 观察结论",
      status: "done",
      note: "观察结论已完成，不涉及具体交易",
    });
    expect(topic.strategy).toMatchObject({
      mode: "observation",
      name: "观察结论",
      meta: "观察结论已完成，不涉及具体交易",
      observationSummary: "今日大盘分析已完成。",
    });
    expect(topic.messages.some((message) => message.typing)).toBe(false);
  });

  it("renders partial stage trace as a monotonic current in-progress stage", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "done",
                observedAt: new Date(now - 90_000).toISOString(),
              },
              {
                stageId: "risk_lead",
                status: "done",
                observedAt: new Date(now - 60_000).toISOString(),
              },
              {
                stageId: "trade_decision",
                status: "in_progress",
                observedAt: new Date(now).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("active");
    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 0 秒前");
    expect(topic.stages.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "in_progress",
      "pending",
      "pending",
      "pending",
    ]);
    expect(topic.stages[2]).toMatchObject({
      label: "阶段 3 · 交易方案 · 进行中",
      note: "该阶段正在写入部分结果",
    });
    expect(topic.messages.some((message) => message.stageId === `${topic.id}-stage-4`)).toBe(false);
    expect(topic.messages.some((message) => message.typing)).toBe(true);
  });

  it("does not advance to risk review when the trace says trade is done but no trade decision is renderable", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
            rationaleByMember: {},
            rounds: [
              {
                round: 1,
                memberId: "chart_analyst",
                direction: "long",
                confidence: 0.6,
                rationale: "Round one chart collection is ready.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "research_lead",
                direction: "long",
                confidence: 0.62,
                rationale: "Research synthesis is ready.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "aggressive_reviewer",
                direction: "long",
                confidence: 0.55,
                rationale: "Risk review should not render before trade plan exists.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "risk_lead",
                direction: "long",
                confidence: 0.57,
                rationale: "Risk lead should stay hidden until trade plan exists.",
                evidenceIds: [],
              },
            ],
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 180_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "trade_decision",
                status: "done",
                observedAt: new Date(now - 60_000).toISOString(),
              },
              {
                stageId: "risk_lead",
                status: "in_progress",
                observedAt: new Date(now).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("active");
    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 1 分钟前");
    expect(topic.stages.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "in_progress",
      "pending",
      "pending",
      "pending",
    ]);
    expect(topic.messages.some((message) => message.stageId === `${topic.id}-stage-4`)).toBe(false);
    expect(topic.messages.some((message) => message.typing)).toBe(true);
  });

  it("keeps analysis-only risk messages hidden while trade-plan stage is still in progress", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            candidateType: "market_overview",
            candidateKey: "market_overview:zh_CN:2026-05-18",
            displayTitle: "今日大盘综述",
            executable: false,
            tradeDecision: null,
            rationaleByMember: {},
            rounds: [
              {
                round: 1,
                memberId: "chart_analyst",
                direction: "short",
                confidence: 0.6,
                rationale: "Market overview chart collection is ready.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "research_lead",
                direction: "short",
                confidence: 0.62,
                rationale: "Market overview synthesis is still preparing the public plan.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "risk_lead",
                direction: "short",
                confidence: 0.58,
                rationale: "Risk review must not render before the public stage reaches risk.",
                evidenceIds: [],
              },
            ],
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 180_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "trade_decision",
                status: "pending",
                observedAt: new Date(now - 60_000).toISOString(),
              },
              {
                stageId: "risk_lead",
                status: "done",
                observedAt: new Date(now).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 1 分钟前");
    expect(topic.stages.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "in_progress",
      "pending",
      "pending",
      "pending",
    ]);
    expect(topic.messages.some((message) => message.sourceMemberId === "risk_lead")).toBe(false);
    expect(topic.messages.some((message) => message.stageId === `${topic.id}-stage-4`)).toBe(false);
  });

  it("keeps analysis-only risk messages hidden even when record-write and timeline audit stages are done", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            candidateType: "market_overview",
            candidateKey: "market_overview:zh_CN:2026-05-18",
            displayTitle: "今日大盘综述",
            executable: false,
            tradeDecision: null,
            rationaleByMember: {},
            rounds: [
              {
                round: 1,
                memberId: "chart_analyst",
                direction: "short",
                confidence: 0.6,
                rationale: "Market overview chart collection is ready.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "research_lead",
                direction: "short",
                confidence: 0.62,
                rationale: "Market overview synthesis is still preparing the public plan.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "risk_lead",
                direction: "short",
                confidence: 0.58,
                rationale: "Risk review must not render before the public stage reaches risk.",
                evidenceIds: [],
              },
            ],
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 180_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "trade_decision",
                status: "pending",
                observedAt: new Date(now - 60_000).toISOString(),
              },
              {
                stageId: "risk_lead",
                status: "done",
                observedAt: new Date(now - 30_000).toISOString(),
              },
              {
                stageId: "record_write",
                status: "done",
                observedAt: new Date(now - 15_000).toISOString(),
              },
              {
                stageId: "public_timeline",
                status: "done",
                observedAt: new Date(now).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 1 分钟前");
    expect(topic.stages.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "in_progress",
      "pending",
      "pending",
      "pending",
    ]);
    expect(topic.messages.map((message) => message.sourceMemberId)).toEqual([
      "chart_analyst",
      "research_lead",
    ]);
  });

  it("groups multi-round decision messages by round label", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");

    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            rationaleByMember: {},
            rounds: [
              {
                round: 1,
                memberId: "chart_analyst",
                direction: "short",
                confidence: 0.6,
                rationale: "Round one chart view.",
                oneLineSummary: "Chart pressure is building.",
                detailedRationale: "Round one detailed chart view.",
                dataStatus: "ok",
                evidenceIds: ["ev_1"],
              },
              {
                round: 2,
                memberId: "chart_analyst",
                direction: "short",
                confidence: 0.7,
                rationale: "Round two refined chart view.",
                evidenceIds: ["ev_1"],
              },
              {
                round: 2,
                memberId: "research_lead",
                direction: "short",
                confidence: 0.72,
                rationale: "Round two synthesis.",
                evidenceIds: [],
              },
            ],
          },
        },
      ],
      locale: "en_US",
      now,
    });

    expect(topic.status).toBe("done");
    expect(topic.messages.map((message) => message.roundLabel).filter(Boolean)).toEqual([
      "Round 1 · multi-round debate",
      "Round 2 · multi-round debate",
    ]);
    expect(topic.messages.map((message) => message.content)).toEqual(
      expect.arrayContaining(["Round one detailed chart view.", "Round two refined chart view."]),
    );
    expect(topic.messages[0]).toMatchObject({
      sourceMemberId: "chart_analyst",
      direction: "short",
      directionLabel: "SHORT",
      confidence: 0.6,
      oneLineSummary: "Chart pressure is building.",
      dataStatusLabel: "Data available",
      roleViewpoint: "Technical / TA view",
    });
  });

  it("keeps second-round analyst refinements inside the debate stage instead of stage one", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");

    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
            rationaleByMember: {},
            rounds: [
              {
                round: 1,
                memberId: "chart_analyst",
                direction: "short",
                confidence: 0.61,
                rationale: "Round one chart input belongs to information collection.",
                evidenceIds: [],
              },
              {
                round: 1,
                memberId: "bullish_researcher",
                direction: "long",
                confidence: 0.58,
                rationale: "Round one bullish debate view belongs to debate.",
                evidenceIds: [],
              },
              {
                round: 2,
                memberId: "fundamental_analyst",
                direction: "short",
                confidence: 0.66,
                rationale: "Round two fundamental refinement belongs to debate, not collection.",
                evidenceIds: [],
              },
            ],
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "in_progress",
                observedAt: new Date(now - 60_000).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    const stageOneId = topic.stages[0]?.id;
    const stageTwoId = topic.stages[1]?.id;
    const fundamentalRoundTwo = topic.messages.find(
      (message) =>
        message.sourceMemberId === "fundamental_analyst" &&
        message.content.includes("Round two fundamental refinement"),
    );

    expect(fundamentalRoundTwo).toMatchObject({
      stageId: stageTwoId,
      roundLabel: "第 2 轮 · 多轮辩论",
    });
    expect(
      topic.messages
        .filter((message) => message.stageId === stageOneId)
        .map((message) => message.roundLabel)
        .filter(Boolean),
    ).not.toContain("第 2 轮 · 多轮辩论");
  });

  it("does not render a public card that starts with later-round analyst output", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");

    const topics = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
            rationaleByMember: {},
            rounds: [
              {
                round: 2,
                memberId: "fundamental_analyst",
                direction: "long",
                confidence: 0.66,
                rationale: "Round two fundamental refinement must not be the first public voice.",
                evidenceIds: [],
              },
              {
                round: 2,
                memberId: "research_lead",
                direction: "long",
                confidence: 0.7,
                rationale: "Round two synthesis must wait for collection context.",
                evidenceIds: [],
              },
            ],
            stageTrace: [
              {
                stageId: "analyst_inputs",
                status: "done",
                observedAt: new Date(now - 120_000).toISOString(),
              },
              {
                stageId: "research_lead",
                status: "in_progress",
                observedAt: new Date(now - 60_000).toISOString(),
              },
            ],
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topics).toEqual([]);
  });

  it("keeps empty incomplete PM decisions pending instead of active", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: null,
            rationaleByMember: {},
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("pending");
    expect(topic.title).toBe("BTC 实时行情分析");
    expect(topic.explanation).toBe("暂无决策更新");
    expect(topic.progress).toBe("暂无决策更新");
    expect(topic.strategy).toMatchObject({
      action: "pending",
      actionLabel: "等待中",
      name: "暂无决策更新",
      meta: "等待真实分析写入",
      follow: {
        primaryDisabled: true,
      },
    });
    expect(topic.messages).toEqual([]);
  });

  it("keeps legacy PM events without rationale map pending", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            kind: "pm_decision",
            recordId: "legacy-record",
            symbol: "BTC",
            tradeDecision: null,
          } as PublicTimelineEvent["payload"],
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("pending");
    expect(topic.title).toBe("BTC 实时行情分析");
    expect(topic.explanation).toBe("暂无决策更新");
    expect(topic.progress).toBe("暂无决策更新");
    expect(topic.strategy).toMatchObject({
      action: "pending",
      name: "暂无决策更新",
    });
    expect(topic.messages).toEqual([]);
  });

  it("keeps malformed trade decisions active instead of rendering a completed strategy", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: { id: "partial-trade" } as TradeDecision,
            rationaleByMember: {
              research_lead: "BTC thesis is still being checked.",
            },
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("active");
    expect(topic.title).toBe("BTC 实时行情分析");
    expect(topic.explanation).toBe("分析进行中");
    expect(topic.progress).toBe("当前进行到阶段 3 · 数据 0 秒前");
    expect(topic.stages.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "active",
      "pending",
    ]);
    expect(topic.strategy).toMatchObject({
      action: "pending",
      name: "尚未决策",
    });
  });

  it("keeps trade decisions with malformed price fields active instead of crashing", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            tradeDecision: {
              ...tradeDecision,
              entryRange: { low: "bad", high: 80700 } as unknown as TradeDecision["entryRange"],
              takeProfit: [79000, "bad"] as unknown as TradeDecision["takeProfit"],
            },
            rationaleByMember: {
              research_lead: "BTC thesis is still being checked.",
            },
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.status).toBe("active");
    expect(topic.strategy).toMatchObject({
      action: "pending",
      entry: "待定",
      takeProfit: "待定",
    });
  });

  it("renders resolved PM decisions as completed memory-loop stage", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");

    const [topic] = mapTopics({
      events: [
        {
          ...event,
          payload: {
            ...event.payload,
            resolution: {
              outcome: "hit_tp",
              resolvedAt: new Date(now + 30 * 60_000).toISOString(),
              observedPrice: 78000,
              reason: "take_profit_reached",
            },
          },
        },
      ],
      locale: "zh_CN",
      now,
    });

    expect(topic.stages[5]).toMatchObject({
      label: "阶段 6 · 复盘沉淀",
      status: "done",
    });
    expect(topic.stages[5]?.note).toBeUndefined();
    expect(topic.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "memory_loop",
          agentName: "策略复盘总监",
          stageId: topic.stages[5]?.id,
          content: expect.stringContaining("止盈达成"),
        }),
      ]),
    );
    expect(topic.messages.find((message) => message.agentId === "memory_loop")?.content).toContain(
      "78,000",
    );
  });

  it.each([
    ["hit_sl", "Result **stop loss hit**", "stop-loss threshold reached"],
    ["expired", "Result **evaluation window expired**", "evaluation window elapsed"],
    ["manual_close", "Result **manually closed**", "administrator requested manual close"],
  ] as const)("renders %s memory-loop outcomes with en_US copy", (outcome, copy, reason) => {
    const [topic] = mapTopics({
      events: [
        withResolution(
          outcome,
          outcome === "manual_close" ? { reason: "manual_close_requested" } : undefined,
        ),
      ],
      locale: "en_US",
      now,
    });

    const content = topic.messages.find((message) => message.agentId === "memory_loop")?.content;
    expect(content).toContain(copy);
    expect(content).not.toMatch(/[止损盈平]/);
    expect(content).toContain(reason);
  });

  it.each(["hit_tp", "hit_sl", "expired", "manual_close"] as const)(
    "localizes %s memory-loop copy across locale matrix",
    (outcome) => {
      for (const locale of ["zh_CN", "en_US", "ja_JP", "ar_SA"] as const) {
        const [topic] = mapTopics({
          events: [
            withResolution(outcome, outcome === "manual_close" ? { reason: undefined } : undefined),
          ],
          locale,
          now,
        });
        const content = topic.messages.find(
          (message) => message.agentId === "memory_loop",
        )?.content;

        expect(content).toBeTruthy();
        if (locale !== "zh_CN") {
          expect(content).not.toMatch(/[止损盈平]/);
        }
      }
    },
  );

  it("falls back to the pending memory copy for dirty outcome values", () => {
    const [topic] = mapTopics({
      events: [withResolution("dirty" as "hit_tp")],
      locale: "en_US",
      now,
    });

    expect(topic.messages.find((message) => message.agentId === "memory_loop")?.content).toBe(
      "No review memory yet; awaiting outcome writeback.",
    );
  });

  it("does not create a source link when no evidence url is available", () => {
    const [topic] = mapTopics({
      events: [pmDecision()],
      locale: "zh_CN",
      now,
    });

    expect(topic.originalUrl).toBeUndefined();
    expect(topic.title).toBe("BTC 实时行情分析");
    expect(topic.explanation).toBe("真实交易决策已完成");
    expect(topic.trigger.text).toBe("BTC 真实交易决策");
  });

  it("does not create a source link from blank evidence urls", () => {
    const [topic] = mapTopics({
      events: [pmDecision()],
      evidenceMap: {
        ev_1: {
          ...evidence,
          url: "   ",
        },
      },
      locale: "zh_CN",
      now,
    });

    expect(topic.originalUrl).toBeUndefined();
    expect(topic.sourceLabel).toBeUndefined();
  });
});
