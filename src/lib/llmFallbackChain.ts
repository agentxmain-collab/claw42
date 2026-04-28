import alphaSkill from "@/modules/agent-watch/skills/alpha.json";
import betaSkill from "@/modules/agent-watch/skills/beta.json";
import gammaSkill from "@/modules/agent-watch/skills/gamma.json";
import { getCoinPool } from "@/lib/marketDataCache";
import { triggerSignalGeneration } from "@/lib/marketSignals";
import { getLastBatchSummary, recordSuccessfulPayload } from "@/lib/llmHistorySummary";
import { buildSignalSummary, formatSummaryForPrompt } from "@/lib/signalSummary";
import type {
  AgentFocus,
  AgentAnalysisPayload,
  AgentId,
  AgentSkill,
  CoinPoolPayload,
  CoinComments,
  CoinMarketContext,
  CoinSymbol,
  MarketDataSource,
  HistoryMessageEntry,
  ProviderSource,
  SignalRecord,
  StreamMessage,
  TickerMap,
  TimeframeSignal,
} from "@/modules/agent-watch/types";

const FRESH_TTL_MS = 10 * 60_000;
const STALE_TTL_MS = 30 * 60_000;
const PROVIDER_FAILURE_FALLBACK_TTL_MS = 30 * 60_000;
const PROVIDER_TIMEOUT_MS = 5000;
const COINS: CoinSymbol[] = ["BTC", "ETH", "SOL", "USDT"];
const RISK_COINS: CoinSymbol[] = ["BTC", "ETH", "SOL"];
const AGENTS: AgentId[] = ["alpha", "beta", "gamma"];
const FOCUS_TRIGGER_TYPES = new Set<AgentFocus["trigger"]["type"]>([
  "breakout_with_volume",
  "retest_hold",
  "ema_cross",
  "range_break",
  "custom",
]);
const FOCUS_FAIL_TYPES = new Set<AgentFocus["fail"]["type"]>([
  "price_break",
  "volume_dry",
  "ema_break",
  "custom",
]);
const UNSUPPORTED_V1_DATA_MARKERS = [
  "RSI",
  "布林",
  "KDJ",
  "MACD",
  "EMA144 偏离",
  "EMA169 偏离",
  "偏离 EMA144",
  "偏离 EMA169",
  "偏离EMA144",
  "偏离EMA169",
  "偏离均线",
  "上轨",
  "下轨",
  "中轨",
  "超买",
  "超卖",
];
const BANNED_OUTPUT_PATTERNS = [
  /现价\s*\$?\d/i,
  /强弱排序已拉开/,
  /^目前.{0,12}表现/,
  /^[A-Z0-9]{2,12}\s+24h\s*[+-]?\d/i,
];
const GAMMA_V1_TERMS = ["极端", "均值回归", "近期高位", "近期低位", "高低位", "range_change"];
const GAMMA_V1_FRAMEWORK = [
  "24h 极端涨跌 + 接近近期高低位 = 回归观察区",
  "range_change 连续出现时先等价格稳定，不接飞刀",
  "回归判断只看现价、24h 涨跌和近期高低位，不引用 RSI / 布林带 / EMA144 偏离",
];
const GAMMA_V1_EXAMPLES = [
  "BTC 24h 极端下跌才进观察区",
  "接近近期低位先看是否停止扩散",
  "极端涨幅后不追，等回归窗口",
  "均值回归只在高低位失速后出手",
];
const GAMMA_V1_FALLBACKS = {
  stream: [
    "BTC 24h 极端涨跌才进观察区",
    "近期高位失速比单根拉升更重要",
    "接近近期低位先看是否停止扩散",
    "树不会长到天上，极端涨幅后等回归",
    "极端位置最怕接飞刀",
    "range_change 连续出现时先缩小判断半径",
    "回归不是反转，先等高低位重新确认",
    "数字不会骗人，极端波动会骗人",
  ],
  heroBubbles: [
    "极端涨跌才值得看",
    "先等回归窗口",
    "不接飞刀",
    "近期高低位是锚",
    "range_change 正在发酵",
  ],
  coinComments: {
    BTC: "BTC 先看 24h 极端涨跌和近期高低位，没失速不做均值回归。",
    ETH: "ETH 如果靠近近期高低位但波动收窄，Gamma 才会进入观察。",
    SOL: "SOL 波动更大，只有极端涨跌后的失速才算回归窗口。",
    USDT: "USDT 主要作稳定锚，不按极端涨跌逻辑处理。",
  } satisfies Record<CoinSymbol, string>,
};

const SKILLS: Record<AgentId, AgentSkill> = {
  alpha: alphaSkill as AgentSkill,
  beta: betaSkill as AgentSkill,
  gamma: gammaSkill as AgentSkill,
};

type ProviderName = "minimax" | "deepseek" | "claude";

type LiveCacheEntry = {
  value: AgentAnalysisPayload;
  freshUntil: number;
  staleUntil: number;
};

type TimedCacheEntry = {
  value: AgentAnalysisPayload;
  expiresAt: number;
};

let liveCache: LiveCacheEntry | null = null;
let backgroundRefreshInFlight = false;
let staticFallbackCache: TimedCacheEntry | null = null;
const HISTORY_BUFFER_MAX_MESSAGES = 200;
let historyBuffer: HistoryMessageEntry[] = [];
const seenHistoryIds = new Set<string>();

function formatMarketPrice(symbol: CoinSymbol, price: number): string {
  return `$${price.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "USDT" ? 4 : 2,
  })}`;
}

function formatMarketChange(change24h: number): string {
  const sign = change24h >= 0 ? "+" : "";
  return `${sign}${change24h.toFixed(2)}%`;
}

function rankedRiskCoins(tickers: TickerMap): CoinSymbol[] {
  return [...RISK_COINS].sort((a, b) => tickers[b].change24h - tickers[a].change24h);
}

function fallbackSeed(tickers: TickerMap): number {
  const [leader, runnerUp, laggard] = rankedRiskCoins(tickers);
  return (
    Math.round(Date.now() / 60_000) +
    Math.round(tickers[leader].change24h * 100) +
    Math.round(tickers[runnerUp].price) -
    Math.round(tickers[laggard].price)
  );
}

function fallbackIndex(seed: number, length: number): number {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

function selectFallback(items: string[], seed: number): string {
  if (items.length === 0) return "";
  return items[fallbackIndex(seed, items.length)] ?? items[0] ?? "";
}

function selectAgentStreamFallback(agentId: AgentId, seed: number): string {
  if (agentId === "gamma") return selectFallback(GAMMA_V1_FALLBACKS.stream, seed);
  return selectFallback(SKILLS[agentId].fallbacks.stream, seed);
}

function selectAgentHeroBubble(agentId: AgentId, seed: number): string {
  if (agentId === "gamma") return selectFallback(GAMMA_V1_FALLBACKS.heroBubbles, seed);
  return selectFallback(SKILLS[agentId].fallbacks.heroBubbles, seed);
}

function fallbackCoinComment(agentId: AgentId, symbol: CoinSymbol): string {
  if (agentId === "gamma") return GAMMA_V1_FALLBACKS.coinComments[symbol];
  return SKILLS[agentId].fallbacks.coinComments[symbol];
}

function formatLiveTickerBrief(tickers: TickerMap): string {
  const [leader, runnerUp, laggard] = rankedRiskCoins(tickers);
  return [
    `${leader} ${formatMarketPrice(leader, tickers[leader].price)} ${formatMarketChange(
      tickers[leader].change24h,
    )}`,
    `${runnerUp} ${formatMarketChange(tickers[runnerUp].change24h)}`,
    `${laggard} ${formatMarketChange(tickers[laggard].change24h)}`,
  ].join(" / ");
}

function buildFallbackStreamContent(agentId: AgentId, tickers: TickerMap, seed: number): string {
  const [leader, runnerUp] = rankedRiskCoins(tickers);
  const first = selectAgentStreamFallback(agentId, seed);
  const second = selectAgentStreamFallback(agentId, seed + 17);

  if (agentId === "alpha") {
    return `${leader} 先盯 5m 放量和前高反应，${first}；${second}，没回踩确认不追。`;
  }

  if (agentId === "beta") {
    return `${leader} 暂时只看 EMA12/13 是否重新共振。${first}；${second}，趋势没确认前仓位别一次打满。`;
  }

  return `${leader} 和 ${runnerUp} 都还没给出足够极端的回归窗口。${first}；${second}，先等近期高低位失速。`;
}

function buildFallbackStream(tickers: TickerMap): StreamMessage[] {
  const seed = fallbackSeed(tickers);
  return AGENTS.map((agentId, index) => ({
    agentId,
    content: buildFallbackStreamContent(agentId, tickers, seed + index * 11),
  }));
}

function buildFallbackHeroBubbles(tickers: TickerMap): string[] {
  const seed = fallbackSeed(tickers);
  return AGENTS.map((agentId, index) =>
    selectAgentHeroBubble(agentId, seed + index * 7),
  );
}

function buildFallbackComments(): CoinComments {
  return COINS.reduce((comments, symbol) => {
    comments[symbol] = {} as Record<AgentId, string>;
    for (const agentId of AGENTS) {
      comments[symbol][agentId] = fallbackCoinComment(agentId, symbol);
    }
    return comments;
  }, {} as CoinComments);
}

function fallbackFocusForAgent(
  agentId: AgentId,
  pool: CoinPoolPayload,
  generatedAt: number,
): AgentFocus {
  const sortedMajors = [...pool.majors].sort((a, b) => b.change24h - a.change24h);
  const opportunity = pool.opportunity[0] ?? pool.trending[0] ?? sortedMajors[0];
  const leader = sortedMajors[0] ?? pool.majors[0];
  const laggard = [...pool.majors].sort((a, b) => a.change24h - b.change24h)[0] ?? leader;
  const target = agentId === "alpha" ? opportunity : agentId === "beta" ? leader : laggard;
  const symbol = target?.symbol ?? "BTC";
  const priceLevel = Number.isFinite(target?.price) ? target.price : undefined;

  if (agentId === "alpha") {
    return {
      agentId,
      symbol,
      judgment: `${symbol} 先看关键位和放量确认，没信号就不追。`,
      trigger: {
        type: "breakout_with_volume",
        symbol,
        priceLevel,
        description: `${symbol} 放量突破并回踩不破后再确认。`,
      },
      fail: {
        type: "volume_dry",
        symbol,
        priceLevel,
        description: `${symbol} 缩量冲高或跌回当前区间，视为假突破。`,
      },
      evidenceCount: 0,
      generatedAt,
    };
  }

  if (agentId === "beta") {
    return {
      agentId,
      symbol,
      judgment: `${symbol} 趋势信号不足，先等 EMA12/13 共振再提高仓位。`,
      trigger: {
        type: "ema_cross",
        symbol,
        priceLevel,
        description: `${symbol} EMA12 重新站上 EMA13 且价格不回落再持有。`,
      },
      fail: {
        type: "ema_break",
        symbol,
        priceLevel,
        description: `${symbol} 跌回 EMA13 下方，趋势判断降级。`,
      },
      evidenceCount: 0,
      generatedAt,
    };
  }

  return {
    agentId,
    symbol,
    judgment: `${symbol} 还没到足够极端位置，回归派先等高低位失速。`,
    trigger: {
      type: "range_break",
      symbol,
      priceLevel,
      description: `${symbol} 24h 涨跌进入极端区并靠近近期高低位再观察回归。`,
    },
    fail: {
      type: "price_break",
      symbol,
      priceLevel,
      description: `${symbol} 继续扩大区间并脱离当前锚点，回归判断失效。`,
    },
    evidenceCount: 0,
    generatedAt,
  };
}

function buildFallbackFocus(pool: CoinPoolPayload, generatedAt: number): AgentFocus[] {
  return AGENTS.map((agentId) => fallbackFocusForAgent(agentId, pool, generatedAt));
}

function buildStaticFallback(pool: CoinPoolPayload): AgentAnalysisPayload {
  const now = Date.now();
  if (staticFallbackCache && staticFallbackCache.expiresAt > now) {
    return { ...staticFallbackCache.value, servedAt: now };
  }
  const { tickers } = pool;

  const value: AgentAnalysisPayload = {
    generatedAt: now,
    servedAt: now,
    ttl: 60,
    source: "static-fallback",
    marketSource: pool.source,
    degraded: true,
    tickers,
    pool,
    focus: buildFallbackFocus(pool, now),
    stream: buildFallbackStream(tickers),
    heroBubbles: buildFallbackHeroBubbles(tickers),
    coinComments: buildFallbackComments(),
  };

  staticFallbackCache = { value, expiresAt: now + PROVIDER_FAILURE_FALLBACK_TTL_MS };
  return value;
}

function pushHistoryFromBatch(payload: AgentAnalysisPayload) {
  if (payload.source === "cache" || payload.source === "static-fallback") return;

  payload.stream.forEach((item, index) => {
    const id = `${payload.generatedAt}-${item.agentId}-${index}`;
    if (seenHistoryIds.has(id)) return;

    const entry: HistoryMessageEntry = {
      id,
      generatedAt: payload.generatedAt,
      agentId: item.agentId,
      content: item.content,
      tickerSnapshot: payload.tickers,
      source: payload.source as ProviderSource,
    };

    historyBuffer.push(entry);
    seenHistoryIds.add(id);
  });

  if (historyBuffer.length > HISTORY_BUFFER_MAX_MESSAGES) {
    const trimCount = historyBuffer.length - HISTORY_BUFFER_MAX_MESSAGES;
    const removed = historyBuffer.slice(0, trimCount);
    historyBuffer = historyBuffer.slice(trimCount);
    removed.forEach((entry) => seenHistoryIds.delete(entry.id));
  }
}

export function getHistoryMessages(limit: number): HistoryMessageEntry[] {
  const safeLimit = Math.max(1, Math.min(limit, HISTORY_BUFFER_MAX_MESSAGES));
  return historyBuffer.slice(-safeLimit);
}

export function getNewestGeneratedAt(): number | null {
  if (historyBuffer.length === 0) return null;
  return historyBuffer[historyBuffer.length - 1].generatedAt;
}

function formatMarketLine(tickers: TickerMap): string {
  return COINS.map((symbol) => {
    const ticker = tickers[symbol];
    return `${symbol} ${formatMarketPrice(symbol, ticker.price)} ${formatMarketChange(
      ticker.change24h,
    )}`;
  }).join("  ");
}

function formatNullablePrice(value: number | null): string {
  if (value === null) return "N/A";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatNullableRatio(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(2)}x`;
}

function formatTimeframeSignal(label: string, signal: TimeframeSignal | null): string {
  if (!signal) return `${label}: K线不足`;
  return [
    `${label}: close ${formatNullablePrice(signal.latestClose)}`,
    `change ${formatMarketChange(signal.changePct)}`,
    `trend ${signal.trend}`,
    `support ${formatNullablePrice(signal.support)}`,
    `resistance ${formatNullablePrice(signal.resistance)}`,
    `EMA12 ${formatNullablePrice(signal.ema12)}`,
    `EMA13 ${formatNullablePrice(signal.ema13)}`,
    `EMA144 ${formatNullablePrice(signal.ema144)}`,
    `EMA169 ${formatNullablePrice(signal.ema169)}`,
    `vol ${formatNullableRatio(signal.volumeRatio)}`,
    `candles ${signal.candleCount}`,
  ].join(" | ");
}

function formatCoinWContext(
  source: MarketDataSource,
  context?: Partial<Record<CoinSymbol, CoinMarketContext>>,
): string {
  if (source !== "coinw-kline" || !context) {
    return [
      "CoinW K线: 不可用，当前只有现价/24h涨跌。",
      "此状态下不得声称完成维加斯通道、趋势追踪、均值回归或突破体系，只能提示需要 K 线确认。",
    ].join("\n");
  }

  return RISK_COINS.map((symbol) => {
    const item = context[symbol];
    if (!item) return `${symbol}: CoinW K线不足`;
    return [
      `### ${symbol} (${item.pair})`,
      formatTimeframeSignal("5m", item.m5),
      formatTimeframeSignal("15m", item.m15),
      formatTimeframeSignal("4h", item.h4),
    ].join("\n");
  }).join("\n\n");
}

const CROSS_BANNED_PHRASES: Record<AgentId, string[]> = {
  alpha: [
    "EMA12",
    "EMA13",
    "EMA144",
    "EMA169",
    "多头排列",
    "空头排列",
    "均值回归",
    "布林带",
    "RSI",
    "超买",
    "超卖",
    "上轨",
    "下轨",
    "中轨",
    "偏离均线",
  ],
  beta: ["突破", "起涨点", "假突破", "关键位", "前高", "前低", "布林带", "RSI", "超买", "超卖"],
  gamma: [
    "趋势是朋友",
    "顺势",
    "多头排列",
    "空头排列",
    "突破",
    "起涨点",
    "假突破",
    "关键位",
    "前高",
    "前低",
  ],
};

function formatTerminology(skill: AgentSkill): string {
  if (!skill.terminology) return "无强制术语";
  return `每条至少 ${skill.terminology.minPerMessage} 个：${skill.terminology.required.join(
    "、",
  )}`;
}

function formatAgentTerminology(agentId: AgentId, skill: AgentSkill): string {
  if (agentId === "gamma") return `每条至少 1 个：${GAMMA_V1_TERMS.join("、")}`;
  return formatTerminology(skill);
}

function skillPromptBlock(agentId: AgentId): string {
  const skill = SKILLS[agentId];
  const bannedPhrases = Array.from(
    new Set([...skill.style.bannedPhrases, ...CROSS_BANNED_PHRASES[agentId]]),
  );
  const shape =
    agentId === "alpha"
      ? "35-55字，1句短刀式判断；可以凶，但必须有触发价/失效条件。"
      : agentId === "beta"
        ? "70-95字，必须2句；第一句读趋势和EMA，第二句给持有/减仓/观望动作。"
        : "55-80字，必须2句；第一句报24h极端涨跌或近期高低位，第二句给回归边界。";
  const persona =
    agentId === "gamma"
      ? "你是 Gamma，加密交易均值回归派 Agent。v1 只用 24h 极端涨跌、近期高低位和 range_change 看回归窗口，不引用 RSI / 布林带 / EMA144 偏离。"
      : skill.persona;
  const coreLogic = agentId === "gamma" ? GAMMA_V1_FRAMEWORK : skill.analyticalFramework.coreLogic;
  const examples = agentId === "gamma" ? GAMMA_V1_EXAMPLES : skill.style.examples;
  return [
    `### ${skill.displayName}（${skill.tagline}）`,
    `人设：${persona}`,
    `语气：${skill.style.tone}`,
    `句式和长度：${shape}`,
    `必须使用术语：${formatAgentTerminology(agentId, skill)}`,
    `核心框架：${coreLogic.join("；")}`,
    `禁用词/禁用风格：${bannedPhrases.join("、")}`,
    `参考口吻：${examples.join(" / ")}`,
  ].join("\n");
}

function formatPoolGroup(label: string, entries: CoinPoolPayload["majors"]): string {
  if (entries.length === 0) return `【${label}】暂无`;
  return `【${label}】 ${entries
    .map(
      (entry) =>
        `${entry.symbol} $${entry.price.toLocaleString("en-US", {
          maximumFractionDigits: entry.price < 1 ? 6 : 2,
        })} ${formatMarketChange(entry.change24h)}`,
    )
    .join("  ")}`;
}

function formatCollectiveSignalBrief(summary: ReturnType<typeof buildSignalSummary>): string {
  const collectiveTypes: SignalRecord["type"][] = [
    "near_high",
    "near_low",
    "volume_spike",
    "breakout",
    "ema_cross",
  ];
  const lines = ["## 集体信号检测"];

  for (const type of collectiveTypes) {
    const symbols = RISK_COINS.filter((symbol) => summary.bySymbol[symbol]?.types.includes(type));
    if (symbols.length >= 3) {
      lines.push(
        `- ${symbols.join(" / ")} 同时出现 ${type}，3 个 Agent 至少 1 条 stream 必须引用这个集体信号。`,
      );
    }
  }

  if (lines.length === 1) {
    lines.push("- 暂无三大主流同类集体信号。Agent 可以分散关注不同币种。");
  }

  return lines.join("\n");
}

function buildPrompt(pool: CoinPoolPayload): string {
  const tickers = pool.tickers;
  const summary = buildSignalSummary();
  const summaryText = formatSummaryForPrompt(summary);
  const collectiveSignalText = formatCollectiveSignalBrief(summary);
  const lastBatch = getLastBatchSummary();
  const lastBatchText = lastBatch
    ? `## 上轮 stream 摘要（${Math.max(1, Math.round(lastBatch.ageMs / 60_000))} 分钟前）\n${lastBatch.summary}`
    : "## 上轮 stream 摘要\n暂无上一轮成功输出。";

  return `你扮演 3 个加密交易 Agent 同时基于累积市场信号做判断。三人必须像不同交易员在同一块屏幕前看盘：同一份实时行情，不同方法论、不同术语、不同判断重点。

## 当前实时行情数据
${formatMarketLine(tickers)}

## 当前多币种池
${formatPoolGroup("主流", pool.majors)}
${formatPoolGroup("热门", pool.trending)}
${formatPoolGroup("机会", pool.opportunity)}

## 当前强弱速写
${formatLiveTickerBrief(tickers)}

## CoinW K线技术上下文
${formatCoinWContext(pool.source, pool.signals)}

${summaryText}

${collectiveSignalText}

${lastBatchText}

## 写作总目标
- 不是行情新闻摘要，而是实时看盘 Agent 的短判断。
- 必须引用上方真实市场数据：币种代码、buffer 信号事件、priceLevel / volumeRatio / distancePct / change24h 等具体数字。
- 每条都要给可观察条件：看哪个价位、哪条均线、哪个区间、什么失效。
- 不要三个人说同一套话。Alpha 看关键位突破，Beta 看 EMA 趋势，Gamma 看极端涨跌和回归。
- 三条 stream 不能同长度、不能同句式、不能都只有一句话。Beta 和 Gamma 必须是两句，Alpha 可以一刀短句。
- focus 必须基于上方“市场信号沉淀”，如果信号不足就明确写“观察中”，不要编造。

## Agent 人设

${skillPromptBlock("alpha")}

${skillPromptBlock("beta")}

${skillPromptBlock("gamma")}

## 输出格式（严格 JSON，不加任何 markdown 代码块）

{
  "focus": [
    {
      "agentId": "alpha",
      "symbol": "<Alpha 当前关注币 symbol>",
      "judgment": "<基于信号的当前判断，<=80字，必须含 Alpha 术语>",
      "trigger": {
        "type": "<breakout_with_volume|retest_hold|ema_cross|range_break|custom>",
        "symbol": "<symbol>",
        "priceLevel": <number 可选>,
        "volumeRatio": <number 可选>,
        "description": "<触发条件，自然语言，必须可验证>"
      },
      "fail": {
        "type": "<price_break|volume_dry|ema_break|custom>",
        "symbol": "<symbol>",
        "priceLevel": <number 可选>,
        "description": "<失效条件，自然语言，必须可验证>"
      },
      "evidenceCount": <引用了 buffer 里多少条 signal，0-10>
    },
    { "agentId": "beta", "...": "同结构" },
    { "agentId": "gamma", "...": "同结构" }
  ],
  "stream": [
    { "agentId": "alpha", "content": "<35-55字，1句，必须含币种、数字、突破/失效条件，并使用 Alpha 术语>" },
    { "agentId": "beta", "content": "<70-95字，2句，必须含币种、数字、EMA/趋势边界，并使用 Beta 术语>" },
    { "agentId": "gamma", "content": "<55-80字，2句，必须含币种、数字、极端涨跌/回归边界，并使用 Gamma 术语>" }
  ],
  "heroBubbles": [
    "<Hero 机器人嘴里说的短句 1，<=40 字，必须含币种或数字，像实时看盘>",
    "<Hero 机器人嘴里说的短句 2>",
    "<Hero 机器人嘴里说的短句 3>"
  ],
  "coinComments": {
    "BTC": { "alpha": "<对 BTC 的点评>", "beta": "<>", "gamma": "<>" },
    "ETH": { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "SOL": { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "USDT": { "alpha": "<>", "beta": "<>", "gamma": "<>" }
  }
}

硬性规则:
- 全部中文输出
- 直接输出 JSON，不加 markdown 代码块
- stream 每条都必须同时包含：币种代码、来自 buffer 或 K 线的具体数字、一个条件/触发/失效点
- Alpha 只能像突破派：关键位、前高/前低、整数关口、放量、假突破、回踩确认
- Beta 只能像趋势派：EMA12/13/144/169、多头/空头排列、回撤、共振、持有/减仓
- Gamma 只能像回归派，但 v1 只能引用 24h 极端涨跌、近期高低位、range_change，不得引用 RSI 数值、布林带上下轨、EMA144 偏离百分比
- 每个 Agent 的 stream 必须至少出现自己的强制术语 1 个；coinComments 也要尽量延续本 Agent 术语
- 三个 Agent 的 stream 内容长度必须明显不同：Alpha 最短，Beta 最长，Gamma 居中
- Beta 和 Gamma 必须各自输出两句，句号/分号分隔；不要把所有信息塞成一句
- 当前 buffer 只有 6 类信号：volume_spike / near_high / near_low / breakout / ema_cross / range_change
- 禁止编造 RSI、布林带、KDJ、MACD、EMA144 偏离百分比等 buffer 没有的数据
- 如果 CoinW K线不可用，必须明确说“K线不足，只能看现价”，不能给入场/止盈/止损计划
- 禁止只输出“强、弱、风险、仓位、机会、别追”这类口号；必须说明“看什么价位/什么变化后怎么处理”
- coinComments 每条 40-80 字，同样要带币种和数字，不要复述 stream
- 禁用词: 综上所述、值得注意的是、赋能、leverage、moreover
- 不要输出英文，不要输出解释文字
- 禁止 markdown 格式

## 输出纪律（task-11，硬性遵守，违反则输出无效）

### A 禁止套话开头
- 禁止以“X 现价 $Y，24h Z%”开头
- 禁止“ETH/BTC/SOL 强弱排序已拉开”
- 禁止“目前 X 表现如何”
- 禁止任何以行情概览或价格描述开头的句式
- 开头必须直接进入判断：例如“BTC 前低被反复测试”“SOL 5m EMA 死叉后还没修复”

### B 禁止复读 Ticker
用户已经在顶部 Ticker 看到：4 主流币 + 3 热门 + 3 机会的当前价 + 24h 涨跌幅。
- 不要在 stream content 或 focus.judgment 里再写“现价 $X”或“24h -X%”
- 直接说判断、引用 buffer 信号事件、给触发/失效条件

### C 必须引用 buffer 信号事件
每个 Agent 的 stream + focus 必须引用至少 1 条 buffer 摘要里具体的信号事件作为论据：
- “BTC 接近前低 $75,677 已经第 3 次”——引用 NEAR_LOW
- “ZKJ 24h +209% 已经飞起来”——引用 RANGE_CHANGE
- “BCAP 5m 放量 2.1x + 突破 $103”——引用 VOLUME_SPIKE + BREAKOUT
- 禁止只说“市场偏弱”“看着不太行”这类无具体信号的话

### D 集体信号检测
如果上方“集体信号检测”提示 BTC / ETH / SOL 同时出现同类型信号，3 Agent stream 至少 1 条必须引用这个集体信号：
- Alpha 可以写“主流三个都接近前低，止损单密集，破一个就连环”
- Beta 可以写“BTC ETH SOL 同步测前低，趋势已经偏弱了”
- Gamma 可以写“三大主流同时进近期低位，集体极端信号出现”
如果没有集体信号，3 Agent 各看各的币，可以分散视角

### E 派别口诀限频（任务 11 新增）
- “突破派/趋势派/回归派”这类派别口号最多 1 条 stream 可以出现，且不能连续两轮重复同一句。
- 优先输出具体动作，不要每条都复述人设。

### F 上轮 stream 摘要避免连续重复（任务 11 新增）
- 上方“上轮 stream 摘要”是上一批成功输出；本轮禁止复用同一开头、同一 symbol+同一结论、同一触发/失效描述。
- 如果继续关注同一个 symbol，必须换一个新证据或新条件，而不是换词重说。

### G 每条 stream 必须含具体币 symbol（继承 task-08）
- 每条 stream 必须至少包含 1 个来自当前多币种池的 symbol。
- 不能用“大盘”“主流”“机会币”替代具体币。

### H 句式风格（继承 task-07）
- Alpha 短促 + 江湖气，必须用突破派术语
- Beta 中长 + 克制，必须用趋势派术语
- Gamma 数据 + 谨慎，必须用回归派术语
- 3 Agent 气泡内容明显风格差异，用户能区分`;
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAnalysisJson(text: string) {
  const cleaned = stripCodeFence(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("json object not found");
  return JSON.parse(cleaned.slice(start, end + 1)) as {
    focus?: AgentFocus[];
    stream?: StreamMessage[];
    heroBubbles?: string[];
    coinComments?: CoinComments;
  };
}

const ACTIONABLE_MARKERS = [
  "若",
  "如果",
  "否则",
  "站稳",
  "跌破",
  "回踩",
  "放量",
  "缩量",
  "突破",
  "失守",
  "守住",
  "确认",
  "压力",
  "支撑",
  "风控",
  "仓位",
  "加仓",
  "减仓",
  "降仓",
  "止损",
  "跌回",
  "价差",
  "强弱",
  "轮动",
  "前高",
  "前低",
  "整数关口",
  "盘整",
  "关键位",
  "EMA12",
  "EMA13",
  "EMA144",
  "EMA169",
  "多头排列",
  "空头排列",
  "共振",
  "持有",
  "均值回归",
  "极端",
];

function hasMarketSymbol(content: string, symbols: Set<string>): boolean {
  return Array.from(symbols).some((symbol) => content.includes(symbol));
}

function hasNumericMarketData(content: string): boolean {
  return /[$+\-]?\d+(?:\.\d+)?%?/.test(content);
}

function hasActionableMarker(content: string): boolean {
  return ACTIONABLE_MARKERS.some((marker) => content.includes(marker));
}

function hasAgentTerminology(agentId: AgentId, content: string): boolean {
  const terminology = SKILLS[agentId].terminology;
  if (!terminology || terminology.required.length === 0) return true;

  const terms = agentId === "gamma" ? GAMMA_V1_TERMS : terminology.required;
  const minPerMessage = agentId === "gamma" ? 1 : terminology.minPerMessage;
  const hits = terms.filter((term) => content.includes(term)).length;
  return hits >= minPerMessage;
}

function hasUnsupportedV1DataClaim(content: string): boolean {
  return UNSUPPORTED_V1_DATA_MARKERS.some((marker) => content.includes(marker));
}

function hasBannedOutputPattern(content: string): boolean {
  return BANNED_OUTPUT_PATTERNS.some((pattern) => pattern.test(content.trim()));
}

function isActionableMarketNote(content: string, symbols: Set<string>): boolean {
  return (
    hasMarketSymbol(content, symbols) &&
    hasNumericMarketData(content) &&
    hasActionableMarker(content)
  );
}

function hasAgentMessageShape(agentId: AgentId, content: string): boolean {
  if (agentId === "alpha") return content.length >= 28 && content.length <= 90;
  if (agentId === "beta") return content.length >= 55 && /[。；;]/.test(content);
  return content.length >= 45 && /[。；;]/.test(content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFocusTriggerType(value: unknown): value is AgentFocus["trigger"]["type"] {
  return typeof value === "string" && FOCUS_TRIGGER_TYPES.has(value as AgentFocus["trigger"]["type"]);
}

function isFocusFailType(value: unknown): value is AgentFocus["fail"]["type"] {
  return typeof value === "string" && FOCUS_FAIL_TYPES.has(value as AgentFocus["fail"]["type"]);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizeFocusText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length < 4) {
    throw new Error(`focus ${field} missing`);
  }
  const text = value.trim().slice(0, maxLength);
  if (hasUnsupportedV1DataClaim(text)) {
    throw new Error(`focus ${field} uses unsupported v1 indicator`);
  }
  if (hasBannedOutputPattern(text)) {
    throw new Error(`focus ${field} uses banned opener`);
  }
  return text;
}

function buildPoolSymbolSet(pool: CoinPoolPayload): Set<string> {
  return new Set(
    [...pool.majors, ...pool.trending, ...pool.opportunity].map((entry) =>
      entry.symbol.toUpperCase(),
    ),
  );
}

function normalizePoolSymbol(value: unknown, symbols: Set<string>, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} symbol missing`);
  }
  const symbol = value.trim().toUpperCase();
  if (!symbols.has(symbol)) {
    throw new Error(`${field} symbol outside pool`);
  }
  return symbol;
}

function normalizeEvidenceCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function normalizeFocus(
  rawFocus: AgentFocus[] | undefined,
  pool: CoinPoolPayload,
  generatedAt: number,
): AgentFocus[] {
  if (!Array.isArray(rawFocus) || rawFocus.length < 3) throw new Error("focus missing");
  const symbols = buildPoolSymbolSet(pool);

  return AGENTS.map((agentId) => {
    const found = rawFocus.find((item) => isRecord(item) && item.agentId === agentId);
    if (!isRecord(found)) throw new Error(`${agentId} focus missing`);

    const symbol = normalizePoolSymbol(found.symbol, symbols, `${agentId}.focus`);
    const judgment = normalizeFocusText(found.judgment, `${agentId}.judgment`, 120);
    const triggerRaw = found.trigger;
    const failRaw = found.fail;
    if (!isRecord(triggerRaw)) throw new Error(`${agentId}.trigger missing`);
    if (!isRecord(failRaw)) throw new Error(`${agentId}.fail missing`);
    if (!isFocusTriggerType(triggerRaw.type)) throw new Error(`${agentId}.trigger invalid`);
    if (!isFocusFailType(failRaw.type)) throw new Error(`${agentId}.fail invalid`);

    const triggerSymbol = normalizePoolSymbol(triggerRaw.symbol, symbols, `${agentId}.trigger`);
    const failSymbol = normalizePoolSymbol(failRaw.symbol, symbols, `${agentId}.fail`);

    return {
      agentId,
      symbol,
      judgment,
      trigger: {
        type: triggerRaw.type,
        symbol: triggerSymbol,
        priceLevel: normalizeOptionalNumber(triggerRaw.priceLevel),
        volumeRatio: normalizeOptionalNumber(triggerRaw.volumeRatio),
        description: normalizeFocusText(triggerRaw.description, `${agentId}.trigger.description`, 140),
      },
      fail: {
        type: failRaw.type,
        symbol: failSymbol,
        priceLevel: normalizeOptionalNumber(failRaw.priceLevel),
        description: normalizeFocusText(failRaw.description, `${agentId}.fail.description`, 140),
      },
      evidenceCount: normalizeEvidenceCount(found.evidenceCount),
      generatedAt,
    };
  });
}

function validateAnalysis(
  raw: ReturnType<typeof parseAnalysisJson>,
  pool: CoinPoolPayload,
  generatedAt: number,
) {
  const tickers = pool.tickers;
  const marketSource = pool.source;
  const stream = raw.stream;
  const heroBubbles = raw.heroBubbles;
  const coinComments = raw.coinComments;
  const symbols = buildPoolSymbolSet(pool);

  if (!Array.isArray(stream) || stream.length < 3) throw new Error("stream missing");
  if (!Array.isArray(heroBubbles) || heroBubbles.length < 3) {
    throw new Error("heroBubbles missing");
  }
  const normalizedFocus = normalizeFocus(raw.focus, pool, generatedAt);

  const normalizedStream = AGENTS.map((agentId) => {
    const found = stream.find((item) => item.agentId === agentId);
    if (!found?.content || typeof found.content !== "string") {
      throw new Error(`${agentId} content missing`);
    }
    if (!isActionableMarketNote(found.content, symbols)) {
      throw new Error(`${agentId} content too generic`);
    }
    if (!hasAgentTerminology(agentId, found.content)) {
      throw new Error(`${agentId} terminology missing`);
    }
    if (!hasAgentMessageShape(agentId, found.content)) {
      throw new Error(`${agentId} message shape too flat`);
    }
    if (hasUnsupportedV1DataClaim(found.content)) {
      throw new Error(`${agentId} uses unsupported v1 indicator`);
    }
    if (hasBannedOutputPattern(found.content)) {
      throw new Error(`${agentId} uses banned opener`);
    }
    return { agentId, content: found.content.slice(0, 180) };
  });

  const normalizedHeroBubbles = heroBubbles.slice(0, 3).map((item) => {
    const content = String(item).slice(0, 100);
    if (hasUnsupportedV1DataClaim(content)) throw new Error("hero bubble uses unsupported v1 indicator");
    if (hasBannedOutputPattern(content)) throw new Error("hero bubble uses banned opener");
    return content;
  });

  const normalizedComments = {} as CoinComments;
  for (const symbol of COINS) {
    normalizedComments[symbol] = {} as Record<AgentId, string>;
    for (const agentId of AGENTS) {
      const content = coinComments?.[symbol]?.[agentId];
      if (!content || typeof content !== "string") {
        throw new Error(`${symbol}.${agentId} comment missing`);
      }
      if (hasUnsupportedV1DataClaim(content)) {
        throw new Error(`${symbol}.${agentId} comment uses unsupported v1 indicator`);
      }
      if (hasBannedOutputPattern(content)) {
        throw new Error(`${symbol}.${agentId} comment uses banned opener`);
      }
      normalizedComments[symbol][agentId] = content.slice(0, 160);
    }
  }

  return {
    ttl: 60,
    tickers,
    pool,
    focus: normalizedFocus,
    marketSource,
    stream: normalizedStream,
    heroBubbles: normalizedHeroBubbles,
    coinComments: normalizedComments,
  };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callMiniMax(prompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("missing MINIMAX_API_KEY");

  const model = process.env.MINIMAX_MODEL || "MiniMax-Text-01";
  const endpoint =
    process.env.MINIMAX_ENDPOINT || "https://api.minimaxi.com/v1/text/chatcompletion_v2";

  return withTimeout(async (signal) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1400,
        temperature: 0.78,
        top_p: 0.9,
      }),
      signal,
    });

    if (!response.ok) throw new Error(`minimax ${response.status}`);
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("minimax empty response");
    return content;
  });
}

async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("missing DEEPSEEK_API_KEY");

  return withTimeout(async (signal) => {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1400,
        temperature: 0.78,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    if (!response.ok) throw new Error(`deepseek ${response.status}`);
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("deepseek empty response");
    return content;
  });
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("missing ANTHROPIC_API_KEY");

  return withTimeout(async (signal) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        temperature: 0.78,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });

    if (!response.ok) throw new Error(`claude ${response.status}`);
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const content = data.content?.find((item) => item.type === "text")?.text?.trim();
    if (!content) throw new Error("claude empty response");
    return content;
  });
}

type ProviderEntry = {
  name: ProviderName;
  call: (prompt: string) => Promise<string>;
  envKey: string;
};

const ALL_PROVIDERS: ProviderEntry[] = [
  { name: "deepseek", call: callDeepSeek, envKey: "DEEPSEEK_API_KEY" },
  { name: "minimax", call: callMiniMax, envKey: "MINIMAX_API_KEY" },
  { name: "claude", call: callClaude, envKey: "ANTHROPIC_API_KEY" },
];

const PROVIDERS = ALL_PROVIDERS.filter((provider) => Boolean(process.env[provider.envKey]));

if (PROVIDERS.length === 0) {
  console.warn("[claw42] no LLM provider configured, will use static fallback only");
} else {
  console.info(`[claw42] LLM chain: ${PROVIDERS.map((provider) => provider.name).join(" → ")}`);
}

async function refreshAnalysis(): Promise<AgentAnalysisPayload> {
  const now = Date.now();
  const pool = (await triggerSignalGeneration()) ?? (await getCoinPool());
  const { tickers } = pool;
  const prompt = buildPrompt(pool);

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.call(prompt);
      const parsed = parseAnalysisJson(text);
      const generatedAt = Date.now();
      const value = {
        ...validateAnalysis(parsed, pool, generatedAt),
        generatedAt,
        servedAt: generatedAt,
        source: provider.name,
        degraded: pool.source !== "coinw-kline",
      } satisfies AgentAnalysisPayload;
      liveCache = {
        value,
        freshUntil: generatedAt + FRESH_TTL_MS,
        staleUntil: generatedAt + STALE_TTL_MS,
      };
      pushHistoryFromBatch(value);
      recordSuccessfulPayload(value);
      return value;
    } catch (error) {
      console.warn(
        `[claw42] ${provider.name} analysis fallback`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (liveCache) {
    console.warn("[claw42] all providers failed, using last known cache");
    return {
      ...liveCache.value,
      source: "cache",
      servedAt: now,
      tickers,
      pool,
      marketSource: pool.source,
      degraded: pool.source !== "coinw-kline",
    };
  }

  console.warn("[claw42] using static analysis fallback");
  return buildStaticFallback(pool);
}

export async function getAgentAnalysis(): Promise<AgentAnalysisPayload> {
  const now = Date.now();

  if (liveCache && liveCache.freshUntil > now) {
    return { ...liveCache.value, source: "cache", servedAt: now };
  }

  if (liveCache && liveCache.staleUntil > now) {
    if (!backgroundRefreshInFlight) {
      backgroundRefreshInFlight = true;
      void refreshAnalysis().finally(() => {
        backgroundRefreshInFlight = false;
      });
    }
    return { ...liveCache.value, source: "cache", servedAt: now };
  }

  return refreshAnalysis();
}
