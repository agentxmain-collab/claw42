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

function buildFallbackStream(tickers: TickerMap): StreamMessage[] {
  const seed = fallbackSeed(tickers);
  return AGENTS.map((agentId, index) => ({
    agentId,
    content: selectFallback(SKILLS[agentId].fallbacks.stream, seed + index * 11),
  }));
}

function buildFallbackHeroBubbles(tickers: TickerMap): string[] {
  const seed = fallbackSeed(tickers);
  return AGENTS.map((agentId, index) =>
    selectFallback(SKILLS[agentId].fallbacks.heroBubbles, seed + index * 7),
  );
}

function buildFallbackComments(): CoinComments {
  return COINS.reduce((comments, symbol) => {
    comments[symbol] = {} as Record<AgentId, string>;
    for (const agentId of AGENTS) {
      comments[symbol][agentId] = SKILLS[agentId].fallbacks.coinComments[symbol];
    }
    return comments;
  }, {} as CoinComments);
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

function skillPromptBlock(agentId: AgentId): string {
  const skill = SKILLS[agentId];
  const bannedPhrases = Array.from(
    new Set([...skill.style.bannedPhrases, ...CROSS_BANNED_PHRASES[agentId]]),
  );
  return [
    `### ${skill.displayName}（${skill.tagline}）`,
    `人设：${skill.persona}`,
    `语气：${skill.style.tone}`,
    `长度：每条 <= ${skill.style.maxLength} 字`,
    `必须使用术语：${formatTerminology(skill)}`,
    `核心框架：${skill.analyticalFramework.coreLogic.join("；")}`,
    `禁用词/禁用风格：${bannedPhrases.join("、")}`,
    `参考口吻：${skill.style.examples.join(" / ")}`,
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
  return `你扮演 3 个加密交易 Agent 同时点评当前市场。三人必须像不同交易员在同一块屏幕前看盘：同一份实时行情，不同方法论、不同术语、不同判断重点。

## 当前实时行情数据
${formatMarketLine(tickers)}

## CoinW K线技术上下文
${formatCoinWContext(source, coinw)}

## 写作总目标
- 不是行情新闻摘要，而是实时看盘 Agent 的短判断。
- 必须引用上方真实市场数据：币种代码、价格或 24h 涨跌幅、CoinW K线位置信息。
- 每条都要给可观察条件：看哪个价位、哪条均线、哪个轨道、什么失效。
- 不要三个人说同一套话。Alpha 看关键位突破，Beta 看 EMA 趋势，Gamma 看偏离和回归。

## Agent 人设

${skillPromptBlock("alpha")}

${skillPromptBlock("beta")}

${skillPromptBlock("gamma")}

## 输出格式（严格 JSON，不加任何 markdown 代码块）

{
  "stream": [
    { "agentId": "alpha", "content": "<Alpha 1-2句，必须含币种、数字、突破/失效条件，并使用 Alpha 术语>" },
    { "agentId": "beta", "content": "<Beta 1-2句，必须含币种、数字、EMA/趋势边界，并使用 Beta 术语>" },
    { "agentId": "gamma", "content": "<Gamma 1-2句，必须含币种、数字、偏离/回归边界，并使用 Gamma 术语>" }
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
- stream 每条都必须同时包含：币种代码（BTC/ETH/SOL/USDT）、当前价格或 24h 涨跌幅数字、一个条件/触发/失效点
- Alpha 只能像突破派：关键位、前高/前低、整数关口、放量、假突破、回踩确认
- Beta 只能像趋势派：EMA12/13/144/169、多头/空头排列、回撤、共振、持有/减仓
- Gamma 只能像回归派：布林带、RSI、偏离、上轨/下轨/中轨、超买/超卖、均值回归
- 每个 Agent 的 stream 必须至少出现自己的强制术语 1 个；coinComments 也要尽量延续本 Agent 术语
- 如果 CoinW K线不可用，必须明确说“K线不足，只能看现价”，不能给入场/止盈/止损计划
- 禁止只输出“强、弱、风险、仓位、机会、别追”这类口号；必须说明“看什么价位/什么变化后怎么处理”
- coinComments 每条 40-80 字，同样要带币种和数字，不要复述 stream
- 禁用词: 综上所述、值得注意的是、赋能、leverage、moreover
- 不要输出英文，不要输出解释文字
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
  "布林带",
  "RSI",
  "偏离",
  "均值回归",
  "上轨",
  "下轨",
  "中轨",
  "超买",
  "超卖",
  "极端",
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

function hasAgentTerminology(agentId: AgentId, content: string): boolean {
  const terminology = SKILLS[agentId].terminology;
  if (!terminology || terminology.required.length === 0) return true;

  const hits = terminology.required.filter((term) => content.includes(term)).length;
  return hits >= terminology.minPerMessage;
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
    if (!hasAgentTerminology(agentId, found.content)) {
      throw new Error(`${agentId} terminology missing`);
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
