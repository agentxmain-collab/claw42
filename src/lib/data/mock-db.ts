import type { MacroItem } from "@/types/calendar";
import type { EventItem } from "@/types/events";
import type { MarketSentiment, QuickInsightItem } from "@/types/market";
import type { NewsItem } from "@/types/news";
import type { PriceSnapshot } from "@/types/signal";
import type { TopicItem } from "@/types/topics";

export const newsItems: NewsItem[] = [
  {
    id: "headline-fed-etf-flow",
    title: {
      zh: "美联储降息预期升温，现货 ETF 资金连续回流",
      en: "Fed cut expectations rise as spot ETF inflows extend",
    },
    summary: {
      zh: "市场重新定价年内宽松路径，比特币现货 ETF 资金连续流入，风险资产短线情绪改善。",
      en: "Markets are repricing the easing path while Bitcoin spot ETF inflows keep improving short-term risk appetite.",
    },
    fullSummary: {
      zh: "最新宏观数据放缓后，交易员提高了未来数月降息概率。与此同时，现货 ETF 净流入维持韧性，推动 BTC 与主流山寨币成交活跃度上升。短线看，资金面对风险资产友好，但仍需关注美元指数与美债收益率是否继续回落。",
      en: "After softer macro data, traders raised the implied odds of rate cuts over the coming months. Spot ETF inflows remain resilient, lifting activity across BTC and major altcoins. Near term, liquidity is supportive for risk assets, while the dollar index and Treasury yields remain the key confirmation signals.",
    },
    source: "CoinW Research",
    publishedAt: "2026-04-19T08:20:00+08:00",
    severity: "high",
    tone: "risk_on",
    marketDirection: "bullish",
    outlook: {
      title: { zh: "偏多但追高需谨慎", en: "Constructive, but avoid chasing" },
      summary: {
        zh: "若 ETF 流入延续且收益率下行，BTC 有望继续测试上方压力位。",
        en: "If ETF inflows persist and yields soften, BTC can keep testing overhead resistance.",
      },
      confidence: 72,
    },
    impactedAssets: [
      {
        symbol: "BTC",
        direction: "bullish",
        severity: "high",
        note: { zh: "ETF 资金与宏观预期共振", en: "ETF flows and macro repricing align" },
      },
      {
        symbol: "ETH",
        direction: "bullish",
        severity: "medium",
        note: { zh: "风险偏好改善带动 beta 修复", en: "Risk appetite supports beta recovery" },
      },
      {
        symbol: "SOL",
        direction: "bullish",
        severity: "medium",
        note: { zh: "高 beta 资产成交回暖", en: "High-beta activity is improving" },
      },
    ],
    timeline: [
      {
        id: "tl-3",
        datetime: "2026-04-19T08:20:00+08:00",
        title: { zh: "ETF 数据更新", en: "ETF data updated" },
        detail: {
          zh: "资金连续回流，市场买盘承接改善。",
          en: "Inflows extended, improving bid support.",
        },
      },
      {
        id: "tl-2",
        datetime: "2026-04-19T02:00:00+08:00",
        title: { zh: "美元指数回落", en: "Dollar index softened" },
        detail: {
          zh: "美元走弱缓解加密资产压力。",
          en: "A softer dollar reduced pressure on crypto assets.",
        },
      },
      {
        id: "tl-1",
        datetime: "2026-04-18T21:30:00+08:00",
        title: { zh: "宏观数据低于预期", en: "Macro data missed" },
        detail: { zh: "市场上调宽松交易权重。", en: "Markets increased easing-trade exposure." },
      },
    ],
  },
  {
    id: "eth-upgrade-staking",
    title: {
      zh: "以太坊升级窗口临近，质押与 L2 板块热度上升",
      en: "Ethereum upgrade window nears as staking and L2 heat rises",
    },
    summary: {
      zh: "升级预期带动 ETH 生态关注度，L2 手续费与质押收益成为资金观察重点。",
      en: "Upgrade expectations are pulling attention back to ETH, L2 fees, and staking yields.",
    },
    fullSummary: {
      zh: "开发者会议确认后续升级测试节奏，市场开始关注网络效率、质押退出体验与 L2 成本变化。该事件对 ETH 方向偏正面，但若主网费用短线抬升，可能压制部分链上活跃度。",
      en: "Developer calls confirmed the next testing cadence, shifting market focus to network efficiency, staking exits, and L2 cost changes. The event is constructive for ETH, though higher mainnet fees could cap onchain activity.",
    },
    source: "CoinW Research",
    publishedAt: "2026-04-19T07:35:00+08:00",
    severity: "medium",
    tone: "risk_on",
    marketDirection: "bullish",
    outlook: {
      title: { zh: "ETH 生态相对强势", en: "ETH ecosystem relative strength" },
      summary: { zh: "关注 ETH/BTC 是否继续修复。", en: "Watch whether ETH/BTC keeps recovering." },
      confidence: 64,
    },
    impactedAssets: [
      {
        symbol: "ETH",
        direction: "bullish",
        severity: "high",
        note: { zh: "升级预期直接受益", en: "Direct upgrade beneficiary" },
      },
      {
        symbol: "OP",
        direction: "bullish",
        severity: "medium",
        note: { zh: "L2 成本叙事升温", en: "L2 cost narrative improves" },
      },
    ],
    timeline: [
      {
        id: "eth-2",
        datetime: "2026-04-19T07:35:00+08:00",
        title: { zh: "测试计划披露", en: "Test plan shared" },
        detail: {
          zh: "开发者确认下一阶段测试重点。",
          en: "Developers confirmed the next testing focus.",
        },
      },
      {
        id: "eth-1",
        datetime: "2026-04-18T20:15:00+08:00",
        title: { zh: "L2 手续费下降", en: "L2 fees declined" },
        detail: {
          zh: "部分主流 L2 交易成本继续回落。",
          en: "Transaction costs fell across major L2s.",
        },
      },
    ],
  },
  {
    id: "stablecoin-policy",
    title: {
      zh: "稳定币监管草案推进，支付叙事获得政策催化",
      en: "Stablecoin policy draft advances, payment narrative gets a catalyst",
    },
    summary: {
      zh: "监管清晰度提升预期带动稳定币、RWA 与支付相关代币关注度。",
      en: "Expectations of clearer rules lifted attention across stablecoin, RWA, and payment tokens.",
    },
    fullSummary: {
      zh: "草案推进降低了机构参与稳定币业务的不确定性，市场将其视为支付基础设施和链上美元流动性的中期利好。短期涨幅较快的支付概念仍可能出现轮动。",
      en: "The policy draft reduces uncertainty for institutional stablecoin participation and is seen as a medium-term positive for payment infrastructure and onchain dollar liquidity. Fast-moving payment themes may still rotate.",
    },
    source: "Policy Desk",
    publishedAt: "2026-04-19T06:40:00+08:00",
    severity: "medium",
    tone: "neutral",
    marketDirection: "neutral",
    outlook: {
      title: { zh: "主题机会大于指数影响", en: "Theme impact beats index impact" },
      summary: {
        zh: "支付、RWA 与合规交易基础设施更受益。",
        en: "Payments, RWA, and compliant market infrastructure benefit most.",
      },
      confidence: 58,
    },
    impactedAssets: [
      {
        symbol: "USDC",
        direction: "bullish",
        severity: "medium",
        note: { zh: "合规稳定币预期改善", en: "Compliant stablecoin outlook improves" },
      },
      {
        symbol: "RWA",
        direction: "bullish",
        severity: "medium",
        note: { zh: "链上美元入口改善", en: "Onchain dollar rails improve" },
      },
    ],
    timeline: [
      {
        id: "st-2",
        datetime: "2026-04-19T06:40:00+08:00",
        title: { zh: "草案进入新阶段", en: "Draft entered next stage" },
        detail: {
          zh: "政策讨论向稳定币发行与储备要求聚焦。",
          en: "Policy discussion focused on issuance and reserve rules.",
        },
      },
    ],
  },
  {
    id: "btc-miner-flow",
    title: {
      zh: "矿工抛压下降，BTC 链上筹码结构改善",
      en: "Miner selling eases as BTC onchain structure improves",
    },
    summary: {
      zh: "矿工地址净流出放缓，长期持有者余额稳定，链上压力边际下降。",
      en: "Miner outflows slowed and long-term holder balances stayed stable, easing onchain pressure.",
    },
    fullSummary: {
      zh: "链上数据显示矿工向交易所转账减少，长期持有者继续维持较高余额。结合 ETF 资金，BTC 的供需结构较前一周改善，但短线仍需观察高位获利盘。",
      en: "Onchain data shows fewer miner transfers to exchanges and stable long-term holder balances. Alongside ETF inflows, BTC supply-demand conditions improved versus last week, though short-term profit taking remains a risk.",
    },
    source: "Onchain Desk",
    publishedAt: "2026-04-19T05:55:00+08:00",
    severity: "low",
    tone: "risk_on",
    marketDirection: "bullish",
    outlook: {
      title: { zh: "供给压力缓解", en: "Supply pressure easing" },
      summary: {
        zh: "若成交量配合，突破概率提升。",
        en: "A breakout becomes more likely if volume confirms.",
      },
      confidence: 61,
    },
    impactedAssets: [
      {
        symbol: "BTC",
        direction: "bullish",
        severity: "medium",
        note: { zh: "矿工流出压力下降", en: "Miner flow pressure fell" },
      },
    ],
    timeline: [
      {
        id: "miner-1",
        datetime: "2026-04-19T05:55:00+08:00",
        title: { zh: "矿工转账回落", en: "Miner transfers fell" },
        detail: {
          zh: "交易所相关地址接收量减少。",
          en: "Exchange-linked receiving volumes declined.",
        },
      },
    ],
  },
];

export const marketSentiment: MarketSentiment = {
  label: { zh: "谨慎偏多", en: "Cautiously bullish" },
  tone: "risk_on",
  fearGreed: 68,
  btcDominance: "52.4%",
  marketCapChange24h: "+2.8%",
  updatedAt: "2026-04-19T08:30:00+08:00",
};

export const quickInsights: QuickInsightItem[] = [
  {
    id: "sentiment",
    label: { zh: "情绪", en: "Sentiment" },
    value: { zh: "风险偏好回升", en: "Risk appetite rising" },
    detail: {
      zh: "ETF 流入与宏观宽松交易同步改善。",
      en: "ETF inflows and easing trades improved together.",
    },
    severity: "high",
  },
  {
    id: "macro",
    label: { zh: "宏观焦点", en: "Macro focus" },
    value: { zh: "美元与美债收益率", en: "Dollar and yields" },
    detail: {
      zh: "收益率下行是行情延续的关键确认。",
      en: "Lower yields are the key confirmation signal.",
    },
    severity: "medium",
  },
  {
    id: "onchain",
    label: { zh: "链上热点", en: "Top onchain" },
    value: { zh: "BTC 持有者成本区", en: "BTC holder cost bands" },
    detail: {
      zh: "短期持有者成本线成为重要支撑。",
      en: "Short-term holder cost basis is key support.",
    },
    severity: "medium",
  },
  {
    id: "social",
    label: { zh: "社媒/X 热点", en: "Top social/X" },
    value: { zh: "ETH 升级讨论", en: "ETH upgrade debate" },
    detail: {
      zh: "开发者节奏与 L2 费用最受关注。",
      en: "Developer cadence and L2 fees lead discussion.",
    },
    severity: "low",
  },
];

export const calendarItems: MacroItem[] = [
  {
    id: "cpi",
    range: "today",
    name: { zh: "美国 CPI 初值", en: "US CPI preliminary" },
    datetime: "2026-04-19T20:30:00+08:00",
    forecast: "2.9%",
    actual: "--",
    impact: "high",
  },
  {
    id: "jobless",
    range: "today",
    name: { zh: "初请失业金人数", en: "Initial jobless claims" },
    datetime: "2026-04-19T21:30:00+08:00",
    forecast: "215K",
    actual: "--",
    impact: "medium",
  },
  {
    id: "pmi",
    range: "tomorrow",
    name: { zh: "美国制造业 PMI", en: "US manufacturing PMI" },
    datetime: "2026-04-20T22:00:00+08:00",
    forecast: "51.2",
    actual: "--",
    impact: "medium",
  },
  {
    id: "fed-speech",
    range: "week",
    name: { zh: "美联储官员讲话", en: "Fed speaker" },
    datetime: "2026-04-22T01:00:00+08:00",
    forecast: "--",
    actual: "--",
    impact: "high",
  },
  {
    id: "pce",
    range: "week",
    name: { zh: "美国核心 PCE", en: "US core PCE" },
    datetime: "2026-04-24T20:30:00+08:00",
    forecast: "2.7%",
    actual: "--",
    impact: "high",
  },
];

export const onchainTopics: TopicItem[] = [
  {
    id: "oc-1",
    rank: 1,
    title: { zh: "BTC ETF 净流入", en: "BTC ETF net inflows" },
    detail: { zh: "连续流入改善现货买盘。", en: "Persistent inflows improve spot demand." },
    heat: 96,
    severity: "high",
  },
  {
    id: "oc-2",
    rank: 2,
    title: { zh: "稳定币供应扩张", en: "Stablecoin supply expansion" },
    detail: { zh: "交易所可用资金回升。", en: "Exchange liquidity is recovering." },
    heat: 88,
    severity: "medium",
  },
  {
    id: "oc-3",
    rank: 3,
    title: { zh: "ETH 质押队列", en: "ETH staking queue" },
    detail: { zh: "质押需求保持稳定。", en: "Staking demand remains steady." },
    heat: 81,
    severity: "medium",
  },
  {
    id: "oc-4",
    rank: 4,
    title: { zh: "Solana DEX 量能", en: "Solana DEX volume" },
    detail: { zh: "链上交易热度回暖。", en: "Onchain activity is heating up." },
    heat: 77,
    severity: "low",
  },
  {
    id: "oc-5",
    rank: 5,
    title: { zh: "RWA 链上结算", en: "RWA onchain settlement" },
    detail: { zh: "机构资金入口继续扩展。", en: "Institutional rails continue expanding." },
    heat: 69,
    severity: "low",
  },
];

export const xTopics: TopicItem[] = [
  {
    id: "x-1",
    rank: 1,
    title: { zh: "ETF 资金回流", en: "ETF inflow comeback" },
    detail: { zh: "交易员讨论突破确认条件。", en: "Traders discuss breakout confirmation." },
    heat: 94,
    severity: "high",
  },
  {
    id: "x-2",
    rank: 2,
    title: { zh: "ETH 升级时间线", en: "ETH upgrade timeline" },
    detail: { zh: "开发者进度引发热议。", en: "Developer cadence drives discussion." },
    heat: 87,
    severity: "medium",
  },
  {
    id: "x-3",
    rank: 3,
    title: { zh: "AI 代理代币", en: "AI agent tokens" },
    detail: { zh: "资金关注应用落地。", en: "Capital watches real usage." },
    heat: 80,
    severity: "medium",
  },
  {
    id: "x-4",
    rank: 4,
    title: { zh: "Meme 板块轮动", en: "Meme rotation" },
    detail: { zh: "高波动资产热度升高。", en: "High-volatility assets are active." },
    heat: 74,
    severity: "low",
  },
  {
    id: "x-5",
    rank: 5,
    title: { zh: "稳定币法案", en: "Stablecoin bill" },
    detail: { zh: "政策交易升温。", en: "Policy trades are heating up." },
    heat: 71,
    severity: "low",
  },
];

export const featuredEvents: EventItem[] = [
  {
    id: "maj-1",
    title: { zh: "比特币关键阻力测试", en: "Bitcoin key resistance test" },
    description: {
      zh: "关注成交量、ETF 净流入和高位获利盘。",
      en: "Watch volume, ETF inflows, and profit taking near highs.",
    },
    datetime: "2026-04-19T18:00:00+08:00",
    tag: { zh: "行情", en: "Market" },
    severity: "high",
  },
  {
    id: "maj-2",
    title: { zh: "以太坊升级社区会议", en: "Ethereum upgrade community call" },
    description: {
      zh: "测试网节奏和生态项目反馈或影响 ETH beta。",
      en: "Testnet cadence and ecosystem feedback may influence ETH beta.",
    },
    datetime: "2026-04-20T23:00:00+08:00",
    tag: { zh: "生态", en: "Ecosystem" },
    severity: "medium",
  },
];

export const coinwCalendar: EventItem[] = [
  {
    id: "cw-1",
    title: { zh: "CoinW BTC 交易挑战赛", en: "CoinW BTC trading challenge" },
    description: {
      zh: "主流币专区限时活动进行中。",
      en: "A limited-time major-coin campaign is active.",
    },
    datetime: "2026-04-19T12:00:00+08:00",
    tag: { zh: "交易活动", en: "Trading" },
    severity: "high",
  },
  {
    id: "cw-2",
    title: { zh: "新币研究直播", en: "New listing research livestream" },
    description: {
      zh: "研究员解读近期上新资产与风险点。",
      en: "Analysts review recent listings and risk points.",
    },
    datetime: "2026-04-21T20:00:00+08:00",
    tag: { zh: "直播", en: "Livestream" },
    severity: "medium",
  },
];

export const priceSnapshots: PriceSnapshot[] = [
  {
    symbol: "BTC",
    price: 68420,
    change24h: 6.2,
    volumeChange24h: 38,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
  {
    symbol: "ETH",
    price: 3520,
    change24h: 3.8,
    volumeChange24h: 22,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
  {
    symbol: "SOL",
    price: 168,
    change24h: 5.1,
    volumeChange24h: 31,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
  {
    symbol: "USDC",
    price: 1,
    change24h: 0.1,
    volumeChange24h: 12,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
  {
    symbol: "OP",
    price: 2.84,
    change24h: 4.4,
    volumeChange24h: 19,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
  {
    symbol: "RWA",
    price: 1.42,
    change24h: 7.1,
    volumeChange24h: 46,
    source: "mock-market",
    updatedAt: "2026-04-19T08:30:00+08:00",
  },
];
