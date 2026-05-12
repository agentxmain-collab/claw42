export type DispatchAgentStage = "source" | "analyst" | "lead" | "pm";
export type DispatchAgentState = "idle" | "analyzing" | "done";
export type StrategyDirection = "long" | "short" | "grid" | "wait";
export type StrategyForm = "spot" | "futures" | "grid" | "hedge";
export type StrategyStatus = "latest" | "active";
export type HistoryOutcome = "pending" | "partial" | "win" | "loss" | "invalid";
export type VoteDirection = "long" | "short" | "wait" | "agree";

export interface DispatchAgent {
  id: string;
  stage: Exclude<DispatchAgentStage, "source">;
  name: string;
  role: string;
  englishRole: string;
  capability: string;
  initials: string;
  task: string;
  state: DispatchAgentState;
  inputs: string[];
  outputs: string[];
  methods: string[];
}

export interface DispatchSource {
  id: string;
  label: string;
  initials: string;
  meta: string;
  state: DispatchAgentState;
  packets: string[];
}

export interface DispatchTicker {
  symbol: string;
  price: string;
  change: string;
  direction: "up" | "down";
}

export interface PipelineChatMessage {
  id: string;
  who: string;
  to?: string;
  body: string;
  kind?: "reply" | "question" | "decision";
}

export interface StrategyOutcome {
  id: string;
  status: StrategyStatus;
  symbol: string;
  direction: StrategyDirection;
  form: StrategyForm;
  formLabel: string;
  confidence: number;
  age: string;
  entry: string;
  stop: string;
  target: string;
  size: string;
  rr: string;
  rationale: string;
  key: string;
  votes: {
    long: number;
    short: number;
    wait: number;
  };
}

export interface StrategyVote {
  strategyId: string;
  agentId: string;
  name: string;
  vote: VoteDirection;
  view: string;
}

export interface StrategyHistoryRecord {
  id: string;
  symbol: string;
  direction: StrategyDirection;
  form: StrategyForm;
  confidence: number;
  age: string;
  outcome: HistoryOutcome;
  pnl: string;
  note: string;
}

export interface MarketPulseItem {
  id: string;
  kind: "news" | "chain" | "social";
  source: string;
  time: string;
  date: string;
  title: string;
  impact: "high" | "medium" | "low";
  agents: string[];
}

export interface TrendingTopic {
  rank: number;
  tag: string;
  delta: string;
  heat: string;
  direction: "up" | "down";
}

export const dispatchTickers: DispatchTicker[] = [
  { symbol: "BTC", price: "67,842", change: "+1.42%", direction: "up" },
  { symbol: "ETH", price: "3,521", change: "+0.84%", direction: "up" },
  { symbol: "SOL", price: "168.4", change: "-2.11%", direction: "down" },
  { symbol: "BNB", price: "608", change: "+0.31%", direction: "up" },
  { symbol: "XRP", price: "0.523", change: "-0.92%", direction: "down" },
  { symbol: "DOGE", price: "0.158", change: "+3.27%", direction: "up" },
  { symbol: "TON", price: "5.81", change: "-1.04%", direction: "down" },
  { symbol: "AVAX", price: "38.2", change: "+2.15%", direction: "up" },
  { symbol: "SUI", price: "1.42", change: "+4.81%", direction: "up" },
  { symbol: "ARB", price: "0.86", change: "-0.65%", direction: "down" },
];

export const dispatchSources: DispatchSource[] = [
  {
    id: "coinw",
    label: "CoinW 行情",
    initials: "CW",
    meta: "spot · futures · depth",
    state: "done",
    packets: ["SOL/USDT depth-5 卖盘集中 168.5", "BTC 资金费率转正", "ETH 多空比 0.91"],
  },
  {
    id: "news",
    label: "新闻流",
    initials: "N",
    meta: "en · zh · feed",
    state: "analyzing",
    packets: ["Solana ETF 决议推迟", "CPI 低于预期", "Robinhood 加密收入超预期"],
  },
  {
    id: "onchain",
    label: "链上数据",
    initials: "CH",
    meta: "flows · whales · CEX in/out",
    state: "analyzing",
    packets: ["6.2M USDC 转入 Binance", "SOL 净流入转正", "ETH whale 累积"],
  },
  {
    id: "social",
    label: "X 话题",
    initials: "X",
    meta: "trending · KOL · sentiment",
    state: "done",
    packets: ["@cobie 提及 SOL 试压", "#SolanaETF +180%", "#CPI 热度 +91%"],
  },
  {
    id: "macro",
    label: "宏观日历",
    initials: "M",
    meta: "CPI · FOMC · earnings",
    state: "idle",
    packets: ["06·11 CPI 终值", "06·13 FOMC", "英国 CPI"],
  },
];

export const dispatchAgents: DispatchAgent[] = [
  {
    id: "laochen",
    stage: "analyst",
    name: "老陈",
    role: "基本面分析师",
    englishRole: "Fundamentals",
    capability: "拆资产质量和周期位置，看团队 / 收入 / 估值与市场周期。",
    initials: "陈",
    task: "核对 SOL 网络收入趋势 vs FDV",
    state: "done",
    inputs: ["CoinW 行情", "宏观日历"],
    outputs: ["rationale", "quality 分"],
    methods: ["资产质量打分", "周期位置", "估值锚", "历史同位资产对照"],
  },
  {
    id: "mira",
    stage: "analyst",
    name: "Mira",
    role: "新闻分析师",
    englishRole: "News",
    capability: "判断新闻是否真的改变了市场的注意力分配。",
    initials: "Mi",
    task: "扫描 SOL 相关 24h 头条",
    state: "analyzing",
    inputs: ["新闻流", "X 话题"],
    outputs: ["narrative shift", "attention score"],
    methods: ["注意力转移", "利好解读差异", "KOL 衰减曲线"],
  },
  {
    id: "kge",
    stage: "analyst",
    name: "K哥",
    role: "图表分析师",
    englishRole: "Charts",
    capability: "标关键价位、结构失效条件、量价配合。",
    initials: "K",
    task: "标记 SOL 4H 关键位 168 / 163",
    state: "done",
    inputs: ["CoinW 行情"],
    outputs: ["key levels", "invalidation"],
    methods: ["关键水平", "结构失效", "量价背离", "多周期对齐"],
  },
  {
    id: "vit",
    stage: "analyst",
    name: "Vit",
    role: "链上分析师",
    englishRole: "On-chain",
    capability: "追踪链上资金流向与异常活动。",
    initials: "Vi",
    task: "追踪 SOL 大额钱包 24h 净流",
    state: "analyzing",
    inputs: ["链上数据"],
    outputs: ["flow signal", "whale activity"],
    methods: ["CEX in/out flow", "大额钱包", "合约异常", "MEV 信号"],
  },
  {
    id: "laor",
    stage: "lead",
    name: "老 R",
    role: "综合负责人",
    englishRole: "Synthesis",
    capability: "汇总分歧，形成主判断。",
    initials: "R",
    task: "综合 4 分析师方向中",
    state: "analyzing",
    inputs: ["老陈", "Mira", "K哥", "Vit"],
    outputs: ["main thesis", "confidence"],
    methods: ["对齐 rationale", "标共识 / 分歧", "权重市场状态", "输出主方向"],
  },
  {
    id: "laox",
    stage: "lead",
    name: "老 X",
    role: "风险负责人",
    englishRole: "Risk",
    capability: "先找失效条件和风险边界。",
    initials: "X",
    task: "反推 LONG SOL 失效场景",
    state: "done",
    inputs: ["老陈", "Mira", "K哥", "Vit"],
    outputs: ["invalidation set", "risk score"],
    methods: ["失效场景", "最大下行", "相关性", "触发线"],
  },
  {
    id: "pm",
    stage: "pm",
    name: "PM",
    role: "产品经理",
    englishRole: "Decision",
    capability: "把团队结论收敛成可执行策略组合。",
    initials: "PM",
    task: "生成多策略组合",
    state: "analyzing",
    inputs: ["老 R", "老 X", "4 analyst"],
    outputs: ["final decision", "strategy basket"],
    methods: ["吸收主判断", "吸收失效集", "合并对冲", "输出执行卡"],
  },
];

export const pipelineChatMessages: PipelineChatMessage[] = [
  {
    id: "chat-1",
    who: "vit",
    body: "监测到 SOL 大额钱包 6.2M USDC 转入 Binance，疑似抛压前置。",
  },
  {
    id: "chat-2",
    who: "kge",
    to: "vit",
    body: "@Vit 4H 看 168 试压量未跟随，和你信号一致。",
    kind: "reply",
  },
  {
    id: "chat-3",
    who: "mira",
    body: "Solana ETF 推迟至 6 月，attention 上升 12%。",
  },
  {
    id: "chat-4",
    who: "laochen",
    to: "mira",
    body: "@Mira 影响有限，网络收入 7d MA 仍创新高。",
    kind: "reply",
  },
  {
    id: "chat-5",
    who: "laox",
    to: "laor",
    body: "@老 R 失效线锁 163.4，建议小仓试探 + s4 对冲。",
    kind: "reply",
  },
  {
    id: "chat-6",
    who: "pm",
    body: "采纳：4 策略并行 — SOL 多 + BTC 多 + ETH 网格 + SOL 空对冲。",
    kind: "decision",
  },
];

export const strategyOutcomes: StrategyOutcome[] = [
  {
    id: "s2",
    status: "latest",
    symbol: "BTC/USDT",
    direction: "long",
    form: "spot",
    formLabel: "现货",
    confidence: 74,
    age: "2m",
    entry: "67,420 - 67,900",
    stop: "66,200",
    target: "69,800 / 71,500",
    size: "12% spot",
    rr: "2.4",
    rationale: "CPI 偏鸽，4 分析师一致看多",
    key: "high-conf · 主仓",
    votes: { long: 7, short: 0, wait: 0 },
  },
  {
    id: "s1",
    status: "active",
    symbol: "SOL/USDT",
    direction: "long",
    form: "futures",
    formLabel: "杠杆 1.4x",
    confidence: 62,
    age: "14s",
    entry: "166.8 - 168.2",
    stop: "163.4",
    target: "178.5 / 184.0",
    size: "8% · 1.4x lev",
    rr: "2.8",
    rationale: "基本面 + 注意力共振，K哥 wait 但 X 失效线明确",
    key: "directional · 主仓",
    votes: { long: 4, short: 1, wait: 2 },
  },
  {
    id: "s3",
    status: "active",
    symbol: "ETH/USDT",
    direction: "grid",
    form: "grid",
    formLabel: "网格",
    confidence: 58,
    age: "8m",
    entry: "3,420 - 3,560",
    stop: "区间外退出",
    target: "区间内反复套利",
    size: "6% · 8 格",
    rr: "-",
    rationale: "方向不明但波动率高，区间内利用震荡",
    key: "range · 中性",
    votes: { long: 2, short: 2, wait: 3 },
  },
  {
    id: "s4",
    status: "active",
    symbol: "SOL/USDT",
    direction: "short",
    form: "hedge",
    formLabel: "对冲",
    confidence: 54,
    age: "14s",
    entry: "168.5",
    stop: "171.0",
    target: "160 (对冲 s1)",
    size: "3% perp short",
    rr: "1.7",
    rationale: "对冲 s1 多头方向风险，X 力主小仓试探",
    key: "hedge · 风险缓冲",
    votes: { long: 1, short: 3, wait: 3 },
  },
];

export const strategyVotes: StrategyVote[] = [
  {
    strategyId: "s1",
    agentId: "laochen",
    name: "老陈",
    vote: "long",
    view: "网络收入 7d MA 新高，质量分上调",
  },
  {
    strategyId: "s1",
    agentId: "mira",
    name: "Mira",
    vote: "long",
    view: "attention 偏正，ETF 推迟反应已弱化",
  },
  {
    strategyId: "s1",
    agentId: "kge",
    name: "K哥",
    vote: "wait",
    view: "4H 量未跟随，等突破或失守",
  },
  {
    strategyId: "s1",
    agentId: "vit",
    name: "Vit",
    vote: "short",
    view: "CEX 净流入扩大，6.2M USDC 抛压前置",
  },
  {
    strategyId: "s1",
    agentId: "laor",
    name: "老 R",
    vote: "long",
    view: "综合方向偏多，权重 fund + news",
  },
  {
    strategyId: "s1",
    agentId: "laox",
    name: "老 X",
    vote: "wait",
    view: "失效线 163.4 偏近，建议小仓试探",
  },
  { strategyId: "s1", agentId: "pm", name: "PM", vote: "agree", view: "采纳 R 主判断 + X 失效集" },
  { strategyId: "s2", agentId: "pm", name: "PM", vote: "agree", view: "高置信开仓" },
  { strategyId: "s3", agentId: "pm", name: "PM", vote: "agree", view: "采纳网格形态" },
  { strategyId: "s4", agentId: "pm", name: "PM", vote: "agree", view: "与 s1 配对" },
];

export const strategyHistory: StrategyHistoryRecord[] = [
  {
    id: "h01",
    symbol: "BTC/USDT",
    direction: "long",
    form: "futures",
    confidence: 74,
    age: "2m",
    outcome: "pending",
    pnl: "+0.4%",
    note: "CPI 偏鸽 + 大额买入聚集",
  },
  {
    id: "h02",
    symbol: "SOL/USDT",
    direction: "long",
    form: "futures",
    confidence: 62,
    age: "14s",
    outcome: "pending",
    pnl: "+0.1%",
    note: "网络费收新高 + ETF 推迟反应弱化",
  },
  {
    id: "h03",
    symbol: "ETH/USDT",
    direction: "short",
    form: "futures",
    confidence: 61,
    age: "18m",
    outcome: "pending",
    pnl: "-0.3%",
    note: "4H 失守 3550，CEX 净流入扩大",
  },
  {
    id: "h04",
    symbol: "ETH/USDT",
    direction: "grid",
    form: "grid",
    confidence: 55,
    age: "1h",
    outcome: "pending",
    pnl: "+0.8%",
    note: "网格 3420-3560，区间震荡套利",
  },
  {
    id: "h05",
    symbol: "SOL/USDT",
    direction: "short",
    form: "hedge",
    confidence: 48,
    age: "2h",
    outcome: "partial",
    pnl: "+1.2%",
    note: "对冲多头敞口，已止盈 50%",
  },
  {
    id: "h06",
    symbol: "BTC/USDT",
    direction: "long",
    form: "spot",
    confidence: 71,
    age: "昨 22:30",
    outcome: "win",
    pnl: "+3.4%",
    note: "CPI 数据驱动，4H 突破 67k",
  },
  {
    id: "h07",
    symbol: "SOL/USDT",
    direction: "long",
    form: "futures",
    confidence: 58,
    age: "昨 18:42",
    outcome: "win",
    pnl: "+5.1%",
    note: "168 突破伴随放量",
  },
];

export const marketPulseItems: MarketPulseItem[] = [
  {
    id: "n1",
    kind: "news",
    source: "CoinDesk",
    time: "09:12",
    date: "05·12",
    title: "Solana 现货 ETF 决议推迟至 6 月，SEC 要求补充 staking 风险说明",
    impact: "high",
    agents: ["Mira", "老 R"],
  },
  {
    id: "n2",
    kind: "chain",
    source: "On-chain",
    time: "09:04",
    date: "05·12",
    title: "链上大额钱包 6.2M USDC 转入 Binance，疑似 SOL 抛压前置",
    impact: "high",
    agents: ["Vit", "老 X"],
  },
  {
    id: "n3",
    kind: "social",
    source: "X · KOL",
    time: "08:51",
    date: "05·12",
    title: "@cobie 提及 SOL 在 168 反复试压，量未跟随",
    impact: "medium",
    agents: ["Mira", "K哥"],
  },
  {
    id: "n4",
    kind: "news",
    source: "Reuters",
    time: "08:33",
    date: "05·12",
    title: "美 4 月 CPI 同比 3.1%，预期 3.2%，市场重新定价 9 月降息概率",
    impact: "high",
    agents: ["老陈", "Mira"],
  },
  {
    id: "n5",
    kind: "chain",
    source: "On-chain",
    time: "08:20",
    date: "05·12",
    title: "Binance SOL 净流入 24h 转正，连续 5 日净流出周期终止",
    impact: "medium",
    agents: ["Vit"],
  },
];

export const trendingTopics: TrendingTopic[] = [
  { rank: 1, tag: "#SolanaETF", delta: "+180%", heat: "+12.4k", direction: "up" },
  { rank: 2, tag: "#CPI", delta: "+91%", heat: "+8.2k", direction: "up" },
  { rank: 3, tag: "$SOL", delta: "+44%", heat: "+5.7k", direction: "up" },
  { rank: 4, tag: "#FOMC June", delta: "+22%", heat: "+1.9k", direction: "up" },
  { rank: 5, tag: "#Restaking", delta: "-18%", heat: "-820", direction: "down" },
  { rank: 6, tag: "$ETH", delta: "-9%", heat: "-410", direction: "down" },
];

export const dispatchConsoleStats = {
  sessionId: "S-4217",
  heartbeat: 24,
  packets: "14.2k",
  confidence: "62%",
  totalStrategies: 34,
  hitRate: "68%",
  sevenDayPnl: "+18.4%",
};
