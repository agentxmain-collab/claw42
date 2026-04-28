import alphaSkill from "@/modules/agent-watch/skills/alpha.json";
import betaSkill from "@/modules/agent-watch/skills/beta.json";
import gammaSkill from "@/modules/agent-watch/skills/gamma.json";
import { getMarketTickers } from "@/lib/marketDataCache";
import type {
  AgentAnalysisPayload,
  AgentId,
  AgentSkill,
  CoinComments,
  CoinSymbol,
  HistoryMessageEntry,
  ProviderSource,
  StreamMessage,
  TickerMap,
} from "@/modules/agent-watch/types";

const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 30 * 60_000;
const PROVIDER_FAILURE_FALLBACK_TTL_MS = 30 * 60_000;
const PROVIDER_TIMEOUT_MS = 5000;
const COINS: CoinSymbol[] = ["BTC", "ETH", "SOL", "USDT"];
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

function pick<T>(items: T[], offset = 0): T {
  return items[Math.floor((Date.now() / 1000 + offset) % items.length)];
}

function buildFallbackComments(): CoinComments {
  return {
    BTC: {
      alpha: SKILLS.alpha.fallbacks.coinComments.BTC,
      beta: SKILLS.beta.fallbacks.coinComments.BTC,
      gamma: SKILLS.gamma.fallbacks.coinComments.BTC,
    },
    ETH: {
      alpha: SKILLS.alpha.fallbacks.coinComments.ETH,
      beta: SKILLS.beta.fallbacks.coinComments.ETH,
      gamma: SKILLS.gamma.fallbacks.coinComments.ETH,
    },
    SOL: {
      alpha: SKILLS.alpha.fallbacks.coinComments.SOL,
      beta: SKILLS.beta.fallbacks.coinComments.SOL,
      gamma: SKILLS.gamma.fallbacks.coinComments.SOL,
    },
    USDT: {
      alpha: SKILLS.alpha.fallbacks.coinComments.USDT,
      beta: SKILLS.beta.fallbacks.coinComments.USDT,
      gamma: SKILLS.gamma.fallbacks.coinComments.USDT,
    },
  };
}

function buildStaticFallback(tickers: TickerMap): AgentAnalysisPayload {
  const now = Date.now();
  if (staticFallbackCache && staticFallbackCache.expiresAt > now) {
    return { ...staticFallbackCache.value, servedAt: now, tickers };
  }

  const stream: StreamMessage[] = AGENTS.map((agentId, index) => ({
    agentId,
    content: pick(SKILLS[agentId].fallbacks.stream, index * 7),
  }));

  const value: AgentAnalysisPayload = {
    generatedAt: now,
    servedAt: now,
    ttl: 60,
    source: "static-fallback",
    degraded: true,
    tickers,
    stream,
    heroBubbles: [
      pick(SKILLS.alpha.fallbacks.heroBubbles, 0),
      pick(SKILLS.beta.fallbacks.heroBubbles, 3),
      pick(SKILLS.gamma.fallbacks.heroBubbles, 6),
    ],
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
    const sign = ticker.change24h >= 0 ? "+" : "";
    return `${symbol} $${ticker.price.toLocaleString("en-US", {
      maximumFractionDigits: symbol === "USDT" ? 4 : 2,
    })} ${sign}${ticker.change24h.toFixed(2)}%`;
  }).join("  ");
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

function buildPrompt(tickers: TickerMap): string {
  return `你扮演 3 个加密交易 Agent 同时点评当前市场。每个 Agent 人设见下方。

## 当前行情数据
${formatMarketLine(tickers)}

## Agent 人设

${skillPromptBlock("alpha")}

${skillPromptBlock("beta")}

${skillPromptBlock("gamma")}

## 输出格式（严格 JSON，不加任何 markdown 代码块）

{
  "stream": [
    { "agentId": "alpha", "content": "<Alpha 当前对市场的 1-2 句点评，<=50字，基于上述行情真分析>" },
    { "agentId": "beta", "content": "<Beta 当前对市场的 1-2 句点评>" },
    { "agentId": "gamma", "content": "<Gamma 当前对市场的 1-2 句点评>" }
  ],
  "heroBubbles": [
    "<Hero 机器人嘴里说的短句 1，<=40 字，行情相关>",
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

function validateAnalysis(raw: ReturnType<typeof parseAnalysisJson>, tickers: TickerMap) {
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
    return { agentId, content: found.content.slice(0, 120) };
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
  const { tickers } = await getMarketTickers();
  const prompt = buildPrompt(tickers);

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.call(prompt);
      const parsed = parseAnalysisJson(text);
      const generatedAt = Date.now();
      const value = {
        ...validateAnalysis(parsed, tickers),
        generatedAt,
        servedAt: generatedAt,
        source: provider.name,
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
