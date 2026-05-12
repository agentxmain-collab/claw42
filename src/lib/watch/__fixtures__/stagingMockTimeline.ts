import type { Locale } from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type { StreamEntry } from "@/modules/agent-watch/types";

const CONTRIBUTOR_IDS: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
  "research_lead",
  "risk_lead",
];

type DecisionFixtureInput = {
  symbol: "BTC" | "ETH";
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
  return {
    id: `staging-${input.symbol.toLowerCase()}-trade-v35`,
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
  const recordId = `staging-${input.symbol.toLowerCase()}-pm-decision-v35`;
  const evidenceIds = input.evidence.map((item) => item.id);
  const createdAtIso = new Date(input.createdAt).toISOString();
  const evaluationWindowEndsAt = new Date(input.createdAt + 4 * 60 * 60_000).toISOString();
  const tradeDecision = makeTradeDecision(input);
  const direction = input.direction;

  return {
    id: recordId,
    schemaVersion: 1,
    recordSource: "paper",
    symbol: input.symbol,
    locale: input.locale,
    decisionOwnerId: "pm",
    contributorIds: CONTRIBUTOR_IDS,
    analystInputs: [
      {
        memberId: "fundamental_analyst",
        direction,
        confidence: 0.7,
        rationale: text(
          input.locale,
          `${input.symbol} 的 CoinW 盘面成交和深度支持短线继续观察，基本面没有否定当前方向。`,
          `${input.symbol} CoinW turnover and depth keep the short-term setup watchable; fundamentals do not reject the direction.`,
        ),
        evidenceIds,
      },
      {
        memberId: "news_analyst",
        direction,
        confidence: 0.67,
        rationale: text(
          input.locale,
          `${input.symbol} 新闻面没有出现反向冲击，当前证据更像波动放大而不是趋势失效。`,
          `${input.symbol} news flow has not delivered a contrary shock; the evidence looks like volatility expansion rather than thesis failure.`,
        ),
        evidenceIds,
      },
      {
        memberId: "chart_analyst",
        direction,
        confidence: 0.73,
        rationale: text(
          input.locale,
          `${input.symbol} 价格仍贴近关键区间，入场只接受限价和失效位约束。`,
          `${input.symbol} price remains near the key zone, so entry stays constrained by limit levels and invalidation.`,
        ),
        evidenceIds,
      },
      {
        memberId: "onchain_analyst",
        direction: "neutral",
        confidence: 0.58,
        rationale: text(
          input.locale,
          `${input.symbol} 链上没有给出强确认，但也未看到足以否定交易卡的异常流出。`,
          `${input.symbol} on-chain data is not a strong confirmation, but it does not show abnormal flow that rejects the trade card.`,
        ),
        evidenceIds,
      },
      {
        memberId: "research_lead",
        direction,
        confidence: 0.69,
        rationale: text(
          input.locale,
          `研究组结论：${input.symbol} 展望保持谨慎偏多，理由来自 CoinW 已上线交易对的深度和短线波动结构。`,
          `Research outlook: ${input.symbol} remains cautiously constructive, based on CoinW-listed pair depth and intraday volatility structure.`,
        ),
        evidenceIds,
      },
      {
        memberId: "risk_lead",
        direction: "neutral",
        confidence: 0.61,
        rationale: text(
          input.locale,
          `风险组结论：${input.symbol} 只允许低仓位执行，止损 ${input.stopLoss} 是本次展望失效点。`,
          `Risk outlook: ${input.symbol} should only run at reduced size; ${input.stopLoss} is the invalidation point.`,
        ),
        evidenceIds,
      },
    ],
    sourceThreadId: recordId,
    tradeDecision,
    createdAt: createdAtIso,
    evaluationWindowEndsAt,
    resolvedAt: null,
    resolvedOutcome: null,
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
