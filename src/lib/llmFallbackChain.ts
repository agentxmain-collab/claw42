import alphaSkill from "@/modules/agent-watch/skills/alpha.json";
import betaSkill from "@/modules/agent-watch/skills/beta.json";
import gammaSkill from "@/modules/agent-watch/skills/gamma.json";
import { getMarketAnalysisContext } from "@/lib/marketDataCache";
import type {
  AgentAnalysisPayload,
  AgentId,
  AgentSkill,
  CoinComments,
  CoinMarketContext,
  CoinSymbol,
  MarketDataSource,
  HistoryMessageEntry,
  ProviderSource,
  StreamMessage,
  TickerMap,
  TimeframeSignal,
} from "@/modules/agent-watch/types";

const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 30 * 60_000;
const PROVIDER_FAILURE_FALLBACK_TTL_MS = 30 * 60_000;
const PROVIDER_TIMEOUT_MS = 5000;
const COINS: CoinSymbol[] = ["BTC", "ETH", "SOL", "USDT"];
const RISK_COINS: CoinSymbol[] = ["BTC", "ETH", "SOL"];
const AGENTS: AgentId[] = ["alpha", "beta", "gamma"];

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

function buildFallbackStream(tickers: TickerMap): StreamMessage[] {
  const [leader, , laggard] = rankedRiskCoins(tickers);
  const leaderTicker = tickers[leader];
  const laggardTicker = tickers[laggard];
  const btcTicker = tickers.BTC;
  const spread = (leaderTicker.change24h - laggardTicker.change24h).toFixed(2);

  return [
    {
      agentId: "alpha",
      content: `${leader} ${formatMarketChange(leaderTicker.change24h)} 领涨，若回踩守住 ${formatMarketPrice(
        leader,
        leaderTicker.price,
      )} 附近，我才看突破延续。`,
    },
    {
      agentId: "beta",
      content: `BTC ${formatMarketChange(btcTicker.change24h)}，先按 ${formatMarketPrice(
        "BTC",
        btcTicker.price,
      )} 附近做风控线；跌回去就降仓，不追情绪。`,
    },
    {
      agentId: "gamma",
      content: `${leader} 比 ${laggard} 强 ${spread}pct，价差窗口在强币；若差值收窄，轮动先降温。`,
    },
  ];
}

function buildFallbackHeroBubbles(tickers: TickerMap): string[] {
  const [leader, runnerUp, laggard] = rankedRiskCoins(tickers);
  return [
    `${leader} ${formatMarketChange(tickers[leader].change24h)}，先看回踩`,
    `${runnerUp} 跟不跟量，是下一步信号`,
    `${laggard} 偏弱，别急着补仓`,
  ];
}

function buildFallbackComments(tickers: TickerMap): CoinComments {
  return {
    BTC: {
      alpha: `BTC ${formatMarketChange(tickers.BTC.change24h)}，站稳 ${formatMarketPrice(
        "BTC",
        tickers.BTC.price,
      )} 上方才看突破延续。`,
      beta: `BTC 当前价 ${formatMarketPrice("BTC", tickers.BTC.price)}，回踩不破再考虑加仓，跌破先降风险。`,
      gamma: `BTC 是基准，24h ${formatMarketChange(tickers.BTC.change24h)} 决定主线强弱是否还成立。`,
    },
    ETH: {
      alpha: `ETH ${formatMarketChange(tickers.ETH.change24h)}，只有放量越过 ${formatMarketPrice(
        "ETH",
        tickers.ETH.price,
      )} 附近才算补涨。`,
      beta: `ETH 若继续弱于 BTC，仓位应低一档；先等 ${formatMarketPrice("ETH", tickers.ETH.price)} 附近确认。`,
      gamma: `ETH 24h ${formatMarketChange(tickers.ETH.change24h)}，重点看相对 BTC 的强弱差能否修复。`,
    },
    SOL: {
      alpha: `SOL ${formatMarketChange(tickers.SOL.change24h)} 弹性最大，守住 ${formatMarketPrice(
        "SOL",
        tickers.SOL.price,
      )} 才有短打空间。`,
      beta: `SOL 波动高，靠近 ${formatMarketPrice("SOL", tickers.SOL.price)} 试错要小仓，止损先写清。`,
      gamma: `SOL 24h ${formatMarketChange(tickers.SOL.change24h)}，价差机会更活跃，但滑点也要计入。`,
    },
    USDT: {
      alpha: `USDT ${formatMarketPrice("USDT", tickers.USDT.price)}，弹药稳定就等强币回踩，不急着打光。`,
      beta: `USDT 24h ${formatMarketChange(tickers.USDT.change24h)}，保留现金仓能避免被动扛波动。`,
      gamma: `USDT 接近 ${formatMarketPrice("USDT", tickers.USDT.price)}，稳定币未异常，风险偏好暂未失控。`,
    },
  };
}

function buildStaticFallback(tickers: TickerMap): AgentAnalysisPayload {
  const now = Date.now();
  if (staticFallbackCache && staticFallbackCache.expiresAt > now) {
    return { ...staticFallbackCache.value, servedAt: now };
  }

  const value: AgentAnalysisPayload = {
    generatedAt: now,
    servedAt: now,
    ttl: 60,
    source: "static-fallback",
    marketSource: "fallback",
    degraded: true,
    tickers,
    stream: buildFallbackStream(tickers),
    heroBubbles: buildFallbackHeroBubbles(tickers),
    coinComments: buildFallbackComments(tickers),
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

function skillPromptBlock(agentId: AgentId): string {
  const skill = SKILLS[agentId];
  return [
    `### ${skill.displayName}（${skill.tagline}）`,
    skill.persona,
    `风格：${skill.style.tone}`,
    `框架：${skill.analyticalFramework.coreLogic.join("；")}`,
    `禁用词：${skill.style.bannedPhrases.join("、")}`,
    `参考：${skill.style.examples.join(" / ")}`,
  ].join("\n");
}

function buildPrompt({
  tickers,
  source,
  coinw,
}: {
  tickers: TickerMap;
  source: MarketDataSource;
  coinw?: Partial<Record<CoinSymbol, CoinMarketContext>>;
}): string {
  return `你扮演 3 个加密交易 Agent 同时点评当前市场。每个 Agent 人设见下方。

## 当前实时行情数据
${formatMarketLine(tickers)}

## CoinW K线技术上下文
${formatCoinWContext(source, coinw)}

## 可用交易 Skill 框架
- 维加斯通道：EMA12/13 看短期通道，EMA144/169 看中期趋势，EMA576/676 若数据不足必须说明不可判定。
- 龙虾趋势追踪：判断 5m/15m/4h 是否同向，回踩均线支撑后再给条件。
- 龙虾均值回归：只有在价格明显偏离均线/区间高低位时讨论回归，不得凭感觉抄底摸顶。
- 龙虾突破交易：必须给关键阻力/支撑、有效突破条件、失效点，影线刺破不算确认。

## Agent 人设

${skillPromptBlock("alpha")}

${skillPromptBlock("beta")}

${skillPromptBlock("gamma")}

## 输出格式（严格 JSON，不加任何 markdown 代码块）

{
  "stream": [
    { "agentId": "alpha", "content": "<Alpha 当前对市场的 1-2 句点评，60-90字，必须含币种、数字、条件/失效点>" },
    { "agentId": "beta", "content": "<Beta 当前对市场的 1-2 句点评，60-90字，必须含币种、数字、风控动作>" },
    { "agentId": "gamma", "content": "<Gamma 当前对市场的 1-2 句点评，60-90字，必须含币种、数字、强弱/价差判断>" }
  ],
  "heroBubbles": [
    "<Hero 机器人嘴里说的短句 1，<=40 字，必须含币种或数字>",
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
- 每条点评必须基于上面给的实时行情数据，不要泛泛而谈
- stream 每条都必须同时包含：币种代码（BTC/ETH/SOL/USDT）、当前价格或 24h 涨跌幅数字、一个条件/触发/失效点
- Alpha 给突破/追击条件；Beta 给仓位/回撤边界；Gamma 给相对强弱、价差或轮动结构
- 如果 CoinW K线不可用，必须明确说“K线不足，只能看现价”，不能给入场/止盈/止损计划
- 禁止只输出“强、弱、风险、仓位、机会、别追”这类口号；必须说明“看什么价位/什么变化后怎么处理”
- coinComments 每条 40-80 字，同样要带币种和数字，不要复述 stream
- 禁用词: 综上所述、值得注意的是、赋能、leverage、moreover
- 禁止 markdown 格式`;
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
];

function hasMarketSymbol(content: string): boolean {
  return COINS.some((symbol) => content.includes(symbol));
}

function hasNumericMarketData(content: string): boolean {
  return /[$+\-]?\d+(?:\.\d+)?%?/.test(content);
}

function hasActionableMarker(content: string): boolean {
  return ACTIONABLE_MARKERS.some((marker) => content.includes(marker));
}

function isActionableMarketNote(content: string): boolean {
  return hasMarketSymbol(content) && hasNumericMarketData(content) && hasActionableMarker(content);
}

function validateAnalysis(
  raw: ReturnType<typeof parseAnalysisJson>,
  tickers: TickerMap,
  marketSource: MarketDataSource,
) {
  const stream = raw.stream;
  const heroBubbles = raw.heroBubbles;
  const coinComments = raw.coinComments;

  if (!Array.isArray(stream) || stream.length < 3) throw new Error("stream missing");
  if (!Array.isArray(heroBubbles) || heroBubbles.length < 3) {
    throw new Error("heroBubbles missing");
  }

  const normalizedStream = AGENTS.map((agentId) => {
    const found = stream.find((item) => item.agentId === agentId);
    if (!found?.content || typeof found.content !== "string") {
      throw new Error(`${agentId} content missing`);
    }
    if (!isActionableMarketNote(found.content)) {
      throw new Error(`${agentId} content too generic`);
    }
    return { agentId, content: found.content.slice(0, 180) };
  });

  const normalizedComments = {} as CoinComments;
  for (const symbol of COINS) {
    normalizedComments[symbol] = {} as Record<AgentId, string>;
    for (const agentId of AGENTS) {
      const content = coinComments?.[symbol]?.[agentId];
      if (!content || typeof content !== "string") {
        throw new Error(`${symbol}.${agentId} comment missing`);
      }
      normalizedComments[symbol][agentId] = content.slice(0, 160);
    }
  }

  return {
    ttl: 60,
    tickers,
    marketSource,
    stream: normalizedStream,
    heroBubbles: heroBubbles.slice(0, 3).map((item) => String(item).slice(0, 100)),
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
        max_tokens: 1000,
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
        max_tokens: 1000,
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
        max_tokens: 1000,
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
  const market = await getMarketAnalysisContext();
  const { tickers } = market;
  const prompt = buildPrompt(market);

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.call(prompt);
      const parsed = parseAnalysisJson(text);
      const generatedAt = Date.now();
      const value = {
        ...validateAnalysis(parsed, tickers, market.source),
        generatedAt,
        servedAt: generatedAt,
        source: provider.name,
        degraded: market.source !== "coinw-kline",
      } satisfies AgentAnalysisPayload;
      liveCache = {
        value,
        freshUntil: generatedAt + FRESH_TTL_MS,
        staleUntil: generatedAt + STALE_TTL_MS,
      };
      pushHistoryFromBatch(value);
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
    return { ...liveCache.value, source: "cache", servedAt: now, tickers };
  }

  console.warn("[claw42] using static analysis fallback");
  return buildStaticFallback(tickers);
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
