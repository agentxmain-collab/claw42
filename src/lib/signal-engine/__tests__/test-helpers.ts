import type { NewsItem } from "@/types/news";
import type { SignalCard } from "@/types/signal";

type SignalOverrides = Partial<
  Omit<SignalCard, "facts" | "explanation" | "judgment" | "impact" | "evidence" | "engine">
> & {
  facts?: Partial<SignalCard["facts"]>;
  explanation?: Partial<SignalCard["explanation"]>;
  judgment?: Partial<SignalCard["judgment"]>;
  impact?: Partial<SignalCard["impact"]>;
  evidence?: Partial<SignalCard["evidence"]>;
  engine?: Partial<SignalCard["engine"]>;
};

export function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "btc-etf-flow",
    title: { zh: "BTC ETF 资金回流", en: "BTC ETF inflows return" },
    summary: { zh: "ETF 买盘改善", en: "ETF demand improved" },
    fullSummary: {
      zh: "现货 ETF 连续流入，成交量同步放大。",
      en: "Spot ETF inflows extended while volume expanded.",
    },
    source: "CoinW Research",
    publishedAt: "2026-04-19T08:30:00.000Z",
    severity: "high",
    tone: "risk_on",
    marketDirection: "bullish",
    outlook: {
      title: { zh: "偏多", en: "Constructive" },
      summary: { zh: "等待突破确认", en: "Await breakout confirmation" },
      confidence: 70,
    },
    impactedAssets: [
      {
        symbol: "BTC",
        direction: "bullish",
        severity: "high",
        note: { zh: "ETF 资金确认", en: "ETF flow confirmation" },
      },
    ],
    timeline: [
      {
        id: "tl-1",
        datetime: "2026-04-19T08:30:00.000Z",
        title: { zh: "ETF 数据更新", en: "ETF data updated" },
        detail: { zh: "买盘改善", en: "Demand improved" },
      },
    ],
    ...overrides,
  };
}

export function makeSignal(overrides: SignalOverrides = {}): SignalCard {
  const base: SignalCard = {
    id: "signal-btc-etf",
    version: 1,
    createdAt: "2026-04-19T08:30:00.000Z",
    updatedAt: "2026-04-19T08:30:00.000Z",
    facts: {
      title: { zh: "BTC ETF 信号", en: "BTC ETF signal" },
      summary: { zh: "资金回流", en: "Inflows returned" },
      fullSummary: { zh: "资金回流推动市场情绪。", en: "Inflows improved sentiment." },
      source: "CoinW Research",
      publishedAt: "2026-04-19T08:30:00.000Z",
      eventType: "etf",
      eventStatus: "confirmed",
    },
    explanation: {
      whyItMatters: { zh: "影响现货买盘", en: "It affects spot demand" },
      marketContext: { zh: "风险偏好回升", en: "Risk appetite improves" },
      watchPoints: [{ zh: "ETF 流入是否延续", en: "Whether ETF inflows continue" }],
    },
    judgment: {
      direction: "bullish",
      confidence: 72,
      impactLevel: "high",
      riskNotes: [{ zh: "追高风险", en: "Chasing risk" }],
      rating: "Buy",
    },
    impact: {
      primaryAsset: "BTC",
      relatedAssets: [],
      tracks: ["btc_eth"],
      tradingPairs: ["BTC/USDT"],
      projects: [],
      campaignTags: [],
    },
    evidence: {
      pieces: [
        {
          kind: "news",
          source: "CoinW Research",
          excerpt: { zh: "证据", en: "Evidence" },
          capturedAt: "2026-04-19T08:30:00.000Z",
        },
      ],
      timeline: [],
      multiSourceConfirm: false,
      confirmCount: 1,
    },
    actions: [],
    engine: {
      candidateScore: 72,
      isHeadliner: false,
      dedupKey: "etf:BTC:2026-04-19",
      rules: ["high_credibility_news"],
    },
  };

  return {
    ...base,
    ...overrides,
    facts: { ...base.facts, ...overrides.facts },
    explanation: { ...base.explanation, ...overrides.explanation },
    judgment: { ...base.judgment, ...overrides.judgment },
    impact: { ...base.impact, ...overrides.impact },
    evidence: { ...base.evidence, ...overrides.evidence },
    engine: { ...base.engine, ...overrides.engine },
  };
}
