import type { Locale } from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type {
  DecisionOutcome,
  DecisionResolutionReason,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type { MarketDataSource, StreamEntry } from "@/modules/agent-watch/types";

const CONTRIBUTOR_IDS: TeamMemberId[] = [
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

type DecisionFixtureInput = {
  symbol: "BTC" | "ETH";
  idSuffix?: string;
  createdAt: number;
  locale: Locale;
  direction: "long" | "short";
  entryPrice: number;
  entryRange: { low: number; high: number };
  stopLoss: number;
  takeProfit: number[];
  rating: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  severity: "medium" | "high";
  evidence: NewsEvidence[];
  resolution?: {
    outcome: Exclude<DecisionOutcome, null>;
    observedPrice: number;
    reason?: DecisionResolutionReason | null;
    observedPriceSource?: MarketDataSource | null;
    resolvedAfterMinutes?: number;
  };
};

export type StagingMockTimelineFixture = {
  entries: StreamEntry[];
  decisionRecordsById: Map<string, StrategyDecisionRecord>;
  evidenceMap: Record<string, NewsEvidence>;
  oldestTs: number | null;
  hasMore: boolean;
};

export function shouldUseStagingMockTimeline() {
  return process.env.STAGING_USE_FIXTURE === "true" && process.env.VERCEL_ENV === "preview";
}

function text(locale: Locale, zh: string, en: string) {
  return locale === "zh_CN" || locale === "zh_TW" ? zh : en;
}

function evidence(
  id: string,
  symbol: "BTC" | "ETH",
  minutesAgo: number,
  now: number,
): NewsEvidence {
  const publishedAt = new Date(now - minutesAgo * 60_000).toISOString();
  return {
    id,
    source: "CoinW",
    title: `${symbol}/USDT liquidity and volatility snapshot`,
    url: `https://www.coinw.com/futures/${symbol}USDT`,
    publishedAt,
    fetchedAt: new Date(now).toISOString(),
    symbol: [symbol],
    impactSeverity: "medium",
    summary: `${symbol}/USDT is available on CoinW with active market depth and intraday movement.`,
  };
}

function makeTradeDecision(input: DecisionFixtureInput): TradeDecision {
  const createdAtIso = new Date(input.createdAt).toISOString();
  const idSuffix = input.idSuffix ? `-${input.idSuffix}` : "";
  return {
    id: `staging-${input.symbol.toLowerCase()}${idSuffix}-trade-v35`,
    schemaVersion: 1,
    symbol: input.symbol,
    generatedBy: "pm",
    generatedAt: createdAtIso,
    direction: input.direction,
    entryType: "limit",
    entryPrice: input.entryPrice,
    entryRange: input.entryRange,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    positionSizing: input.symbol === "BTC" ? 0.12 : 0.09,
    timeHorizon: "intraday",
    rating: input.rating,
    confidence: input.confidence,
    evidenceIds: input.evidence.map((item) => item.id),
    riskNote: text(
      input.locale,
      `${input.symbol} 展望偏强但只适合小仓试探，若跌破失效位则退出。`,
      `${input.symbol} outlook is constructive but sized small; exit if invalidation breaks.`,
    ),
    invalidatesIf:
      input.direction === "long"
        ? `${input.symbol} loses ${input.stopLoss}`
        : `${input.symbol} reclaims ${input.stopLoss}`,
    promptVersion: "staging-fixture-v3.5",
    modelProvider: "staging-fixture",
    severity: input.severity,
  };
}

function makeDecisionRecord(input: DecisionFixtureInput): StrategyDecisionRecord {
  const idSuffix = input.idSuffix ? `-${input.idSuffix}` : "";
  const recordId = `staging-${input.symbol.toLowerCase()}${idSuffix}-pm-decision-v35`;
  const evidenceIds = input.evidence.map((item) => item.id);
  const createdAtIso = new Date(input.createdAt).toISOString();
  const evaluationWindowEndsAt = new Date(input.createdAt + 4 * 60 * 60_000).toISOString();
  const tradeDecision = makeTradeDecision(input);
  const direction = input.direction;
  const rationale = (memberId: TeamMemberId, zh: string, en: string) => ({
    memberId,
    direction:
      memberId === "bearish_researcher"
        ? ("short" as const)
        : memberId === "risk_lead" ||
            memberId === "neutral_reviewer" ||
            memberId === "conservative_reviewer" ||
            memberId === "memory_loop"
          ? ("neutral" as const)
          : direction,
    confidence: 0.64,
    rationale: text(input.locale, zh, en),
    evidenceIds,
  });

  return {
    id: recordId,
    schemaVersion: 1,
    recordSource: "paper",
    symbol: input.symbol,
    locale: input.locale,
    decisionOwnerId: "pm",
    contributorIds: CONTRIBUTOR_IDS,
    analystInputs: [
      rationale(
        "fundamental_analyst",
        `${input.symbol} 的 CoinW 盘面成交和深度支持短线继续观察，基本面没有否定当前方向。`,
        `${input.symbol} CoinW turnover and depth keep the short-term setup watchable; fundamentals do not reject the direction.`,
      ),
      rationale(
        "news_analyst",
        `${input.symbol} 新闻面没有出现反向冲击，当前证据更像波动放大而不是趋势失效。`,
        `${input.symbol} news flow has not delivered a contrary shock; the evidence looks like volatility expansion rather than thesis failure.`,
      ),
      rationale(
        "chart_analyst",
        `${input.symbol} 价格仍贴近关键区间，入场只接受限价和失效位约束。`,
        `${input.symbol} price remains near the key zone, so entry stays constrained by limit levels and invalidation.`,
      ),
      rationale(
        "onchain_analyst",
        `${input.symbol} 链上没有给出强确认，但也未看到足以否定交易卡的异常流出。`,
        `${input.symbol} on-chain data is not a strong confirmation, but it does not show abnormal flow that rejects the trade card.`,
      ),
      rationale(
        "bullish_researcher",
        `${input.symbol} 多头 thesis 成立条件是继续守住入场区间并放量突破。`,
        `${input.symbol} bullish thesis requires holding the entry zone and breaking higher with volume.`,
      ),
      rationale(
        "bearish_researcher",
        `${input.symbol} 空头 thesis 关注失效位跌破后的流动性踩踏风险。`,
        `${input.symbol} bearish thesis watches liquidity air pockets if invalidation breaks.`,
      ),
      rationale(
        "trader",
        `${input.symbol} 交易方案只接受 ${input.entryRange.low}-${input.entryRange.high} 区间内执行。`,
        `${input.symbol} setup only accepts execution inside ${input.entryRange.low}-${input.entryRange.high}.`,
      ),
      rationale(
        "aggressive_reviewer",
        `${input.symbol} 进攻仓位只有在突破确认后才合理。`,
        `${input.symbol} offensive sizing only makes sense after breakout confirmation.`,
      ),
      rationale(
        "neutral_reviewer",
        `${input.symbol} 组合视角建议保留低仓位，等待更多确认。`,
        `${input.symbol} portfolio view keeps size reduced while waiting for more confirmation.`,
      ),
      rationale(
        "conservative_reviewer",
        `${input.symbol} 防御条件是止损 ${input.stopLoss} 必须严格执行。`,
        `${input.symbol} defense condition requires strict stop execution at ${input.stopLoss}.`,
      ),
      rationale(
        "research_lead",
        `研究组结论：${input.symbol} 展望保持谨慎偏多，理由来自 CoinW 已上线交易对的深度和短线波动结构。`,
        `Research outlook: ${input.symbol} remains cautiously constructive, based on CoinW-listed pair depth and intraday volatility structure.`,
      ),
      rationale(
        "risk_lead",
        `风险组结论：${input.symbol} 只允许低仓位执行，止损 ${input.stopLoss} 是本次展望失效点。`,
        `Risk outlook: ${input.symbol} should only run at reduced size; ${input.stopLoss} is the invalidation point.`,
      ),
      rationale(
        "pm",
        `最终裁决：${input.symbol} 交易卡可进入观察，执行必须服从止损和仓位限制。`,
        `Final decision: ${input.symbol} trade card can be watched, with stop and sizing limits enforced.`,
      ),
      rationale(
        "memory_loop",
        `${input.symbol} 本次决策需要复盘入场区间、止损触发和消息面是否同步。`,
        `${input.symbol} review loop should track entry zone, stop behavior, and whether news stayed aligned.`,
      ),
    ],
    sourceThreadId: recordId,
    tradeDecision,
    createdAt: createdAtIso,
    evaluationWindowEndsAt,
    resolvedAt: input.resolution
      ? new Date(
          input.createdAt + (input.resolution.resolvedAfterMinutes ?? 30) * 60_000,
        ).toISOString()
      : null,
    resolvedOutcome: input.resolution?.outcome ?? null,
    resolvedPrice: input.resolution?.observedPrice ?? null,
    resolutionReason: input.resolution?.reason ?? null,
    resolutionPriceSource: input.resolution?.observedPriceSource ?? null,
    promptVersion: "staging-fixture-v3.5",
    modelProvider: "staging-fixture",
    legacyFactionId: null,
  };
}

function makeTimelineEntry(record: StrategyDecisionRecord): StreamEntry {
  const createdAt = Date.parse(record.createdAt);
  return {
    kind: "chat_thread",
    id: `pm-decision:${record.id}`,
    ts: createdAt,
    thread: {
      id: record.id,
      seed: {
        id: record.id,
        type: "market",
        title: `${record.symbol} PM decision`,
        description: "Claw42 staging PM decision fixture",
        symbols: [record.symbol],
        sentiment: "neutral",
        createdAt,
      },
      messages: [],
      strategy: null,
      status: "completed",
      createdAt,
      completedAt: createdAt,
      symbol: record.symbol,
    },
    meta: {
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: record.tradeDecision?.evidenceIds ?? [],
      locale: record.locale,
      recordId: record.id,
      tradeDecision: record.tradeDecision,
    },
  };
}

export function getStagingMockTimeline(
  localeInput: Locale,
  now = Date.now(),
): StagingMockTimelineFixture {
  const locale = normalizeWatchLocale(localeInput);
  const btcEvidence = [
    evidence("staging-ev-btc-coinw-depth", "BTC", 22, now),
    evidence("staging-ev-btc-volatility", "BTC", 31, now),
  ];
  const ethEvidence = [
    evidence("staging-ev-eth-coinw-depth", "ETH", 27, now),
    evidence("staging-ev-eth-volatility", "ETH", 38, now),
  ];
  const records = [
    makeDecisionRecord({
      symbol: "BTC",
      createdAt: now - 90_000,
      locale,
      direction: "long",
      entryPrice: 104200,
      entryRange: { low: 103600, high: 104800 },
      stopLoss: 101800,
      takeProfit: [106500, 109200],
      rating: 4,
      confidence: 0.74,
      severity: "high",
      evidence: btcEvidence,
    }),
    makeDecisionRecord({
      symbol: "ETH",
      createdAt: now - 240_000,
      locale,
      direction: "long",
      entryPrice: 2550,
      entryRange: { low: 2520, high: 2585 },
      stopLoss: 2460,
      takeProfit: [2660, 2750],
      rating: 3,
      confidence: 0.66,
      severity: "medium",
      evidence: ethEvidence,
    }),
    makeDecisionRecord({
      symbol: "BTC",
      idSuffix: "hit-tp",
      createdAt: now - 390_000,
      locale,
      direction: "long",
      entryPrice: 103900,
      entryRange: { low: 103400, high: 104100 },
      stopLoss: 101700,
      takeProfit: [105600, 108000],
      rating: 4,
      confidence: 0.72,
      severity: "high",
      evidence: btcEvidence,
      resolution: {
        outcome: "hit_tp",
        observedPrice: 105640,
        reason: "take_profit_reached",
        observedPriceSource: "coinw-kline",
        resolvedAfterMinutes: 42,
      },
    }),
    makeDecisionRecord({
      symbol: "ETH",
      idSuffix: "hit-sl",
      createdAt: now - 540_000,
      locale,
      direction: "long",
      entryPrice: 2540,
      entryRange: { low: 2520, high: 2560 },
      stopLoss: 2475,
      takeProfit: [2630, 2720],
      rating: 2,
      confidence: 0.63,
      severity: "medium",
      evidence: ethEvidence,
      resolution: {
        outcome: "hit_sl",
        observedPrice: 2472,
        reason: "stop_loss_reached",
        observedPriceSource: "coinw-kline",
        resolvedAfterMinutes: 38,
      },
    }),
    makeDecisionRecord({
      symbol: "BTC",
      idSuffix: "expired",
      createdAt: now - 690_000,
      locale,
      direction: "short",
      entryPrice: 104500,
      entryRange: { low: 104200, high: 104900 },
      stopLoss: 106200,
      takeProfit: [102800, 101500],
      rating: 3,
      confidence: 0.65,
      severity: "medium",
      evidence: btcEvidence,
      resolution: {
        outcome: "expired",
        observedPrice: 104120,
        reason: "evaluation_window_elapsed",
        observedPriceSource: "coinw-kline",
        resolvedAfterMinutes: 240,
      },
    }),
    makeDecisionRecord({
      symbol: "ETH",
      idSuffix: "manual-close",
      createdAt: now - 840_000,
      locale,
      direction: "long",
      entryPrice: 2560,
      entryRange: { low: 2535, high: 2580 },
      stopLoss: 2488,
      takeProfit: [2660, 2760],
      rating: 3,
      confidence: 0.68,
      severity: "medium",
      evidence: ethEvidence,
      resolution: {
        outcome: "manual_close",
        observedPrice: 2552,
        reason: null,
        observedPriceSource: "coinw-kline",
        resolvedAfterMinutes: 24,
      },
    }),
  ];
  const entries = records.map(makeTimelineEntry);
  const evidenceItems = [...btcEvidence, ...ethEvidence];

  return {
    entries,
    decisionRecordsById: new Map(records.map((record) => [record.id, record])),
    evidenceMap: Object.fromEntries(evidenceItems.map((item) => [item.id, item])),
    oldestTs: entries.at(-1)?.ts ?? null,
    hasMore: false,
  };
}
