import { fetchFearGreed, type FearGreedData } from "@/lib/api/fearGreed";
import { getCachedJson, setCachedJson } from "@/lib/cache/fileCache";
import { getCoinPool } from "@/lib/marketDataCache";
import type { Locale } from "@/i18n/types";
import type { CoinPoolPayload, CoinTickerEntry } from "@/modules/agent-watch/types";

export type DailyBriefMajorSymbol = "BTC" | "ETH" | "SOL";
export type DailyBriefTier = "trending" | "opportunity" | "majors";
export type DailyBriefNarratives = Record<DailyBriefMajorSymbol, string>;

export type DailyBriefMajor = {
  symbol: DailyBriefMajorSymbol;
  price: number | null;
  change24h: number | null;
  narrative: string;
};

export type DailyBriefMover = {
  symbol: string;
  change24h: number;
  tier: DailyBriefTier;
};

export type DailyBriefData = {
  majors: DailyBriefMajor[];
  fearGreed: FearGreedData | null;
  todayMover: DailyBriefMover | null;
  generatedAt: number;
};

type ProviderName = "deepseek" | "minimax" | "claude";

type ProviderEntry = {
  name: ProviderName;
  envKey: string;
  call: (prompt: string) => Promise<string>;
};

const DAILY_NARRATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const DAILY_NARRATIVE_CACHE_KEY = "daily-narratives-zh-cn-v1";
const PROVIDER_TIMEOUT_MS = 5000;
const MAJOR_SYMBOLS: DailyBriefMajorSymbol[] = ["BTC", "ETH", "SOL"];
const NON_MOVER_SYMBOLS = new Set(["BTC", "ETH", "SOL", "USDT"]);
const FALLBACK_ZH_NARRATIVES: DailyBriefNarratives = {
  BTC: "关键位观察",
  ETH: "趋势等待确认",
  SOL: "波动继续放大",
};
const FALLBACK_EN_NARRATIVES: DailyBriefNarratives = {
  BTC: "Key level watch",
  ETH: "Trend needs confirmation",
  SOL: "Volatility expanding",
};

function isZhNarrativeLocale(locale: Locale | string): boolean {
  return locale === "zh_CN";
}

function fallbackNarratives(locale: Locale | string): DailyBriefNarratives {
  return isZhNarrativeLocale(locale) ? FALLBACK_ZH_NARRATIVES : FALLBACK_EN_NARRATIVES;
}

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 2 : 4,
  })}`;
}

function normalizeNarrative(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const cleaned = value
    .replace(/```(?:json)?/g, "")
    .replace(/^[A-Z]{2,5}\s*[:：\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;
  return Array.from(cleaned).slice(0, 28).join("");
}

function parseNarratives(raw: string, fallback: DailyBriefNarratives): DailyBriefNarratives | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const source = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(source) as Partial<Record<DailyBriefMajorSymbol, unknown>>;

    return {
      BTC: normalizeNarrative(parsed.BTC, fallback.BTC),
      ETH: normalizeNarrative(parsed.ETH, fallback.ETH),
      SOL: normalizeNarrative(parsed.SOL, fallback.SOL),
    };
  } catch {
    return null;
  }
}

function buildNarrativePrompt(pool: CoinPoolPayload): string {
  const marketLines = MAJOR_SYMBOLS.map((symbol) => {
    const ticker = pool.tickers[symbol];
    return `${symbol}: ${formatPrice(ticker.price)}, 24h ${formatSignedPct(ticker.change24h)}`;
  }).join("\n");

  const moverLines = [...pool.trending, ...pool.opportunity]
    .slice(0, 6)
    .map((item) => `${item.symbol}: 24h ${formatSignedPct(item.change24h)}`)
    .join("\n");

  return `
基于当前加密市场数据，给 BTC、ETH、SOL 各生成 1 句 narrative tag。

[主流币]
${marketLines}

[热门/机会币参考]
${moverLines || "暂无"}

输出严格 JSON：
{"BTC":"...","ETH":"...","SOL":"..."}

约束：
- 每币 narrative 尽量 12 个汉字以内，最多 18 个汉字
- 只写定性叙事，不引用具体价格数字
- 不用“可能”“或许”“建议”“关注一下”等空词
- 不输出 Markdown，不输出解释
`.trim();
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
        max_tokens: 500,
        temperature: 0.45,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    if (!response.ok) throw new Error(`deepseek ${response.status}`);
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("deepseek empty response");
    return content;
  });
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
        max_tokens: 500,
        temperature: 0.45,
        top_p: 0.9,
      }),
      signal,
    });

    if (!response.ok) throw new Error(`minimax ${response.status}`);
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("minimax empty response");
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
        max_tokens: 500,
        temperature: 0.45,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });

    if (!response.ok) throw new Error(`claude ${response.status}`);
    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const content = payload.content?.find((item) => item.type === "text")?.text?.trim();
    if (!content) throw new Error("claude empty response");
    return content;
  });
}

const ALL_PROVIDERS: ProviderEntry[] = [
  { name: "deepseek", envKey: "DEEPSEEK_API_KEY", call: callDeepSeek },
  { name: "minimax", envKey: "MINIMAX_API_KEY", call: callMiniMax },
  { name: "claude", envKey: "ANTHROPIC_API_KEY", call: callClaude },
];

const PROVIDERS = ALL_PROVIDERS.filter((provider) => Boolean(process.env[provider.envKey]));

async function generateZhNarratives(pool: CoinPoolPayload): Promise<DailyBriefNarratives | null> {
  const prompt = buildNarrativePrompt(pool);

  for (const provider of PROVIDERS) {
    try {
      const raw = await provider.call(prompt);
      const parsed = parseNarratives(raw, FALLBACK_ZH_NARRATIVES);
      if (parsed) {
        console.info(`[dailyBrief] narrative provider=${provider.name}`);
        return parsed;
      }
    } catch (error) {
      console.warn(
        `[dailyBrief] narrative provider failed provider=${provider.name}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return null;
}

export async function getDailyNarratives(
  locale: Locale | string = "zh_CN",
  pool?: CoinPoolPayload,
): Promise<DailyBriefNarratives> {
  const fallback = fallbackNarratives(locale);
  if (!isZhNarrativeLocale(locale)) return fallback;

  const cached = await getCachedJson<DailyBriefNarratives>(DAILY_NARRATIVE_CACHE_KEY);
  if (cached && Date.now() - cached.generatedAt < DAILY_NARRATIVE_TTL_MS) {
    return cached.data;
  }

  if (PROVIDERS.length === 0) return fallback;

  const sourcePool = pool ?? (await getCoinPool());
  const generated = await generateZhNarratives(sourcePool);
  if (!generated) return fallback;

  await setCachedJson(DAILY_NARRATIVE_CACHE_KEY, {
    data: generated,
    generatedAt: Date.now(),
  });

  return generated;
}

function majorFromPool(
  pool: CoinPoolPayload | null,
  symbol: DailyBriefMajorSymbol,
  narratives: DailyBriefNarratives,
): DailyBriefMajor {
  const ticker =
    pool && !pool.isFallback && pool.source !== "fallback" ? pool.tickers[symbol] : null;

  return {
    symbol,
    price: ticker && Number.isFinite(ticker.price) ? ticker.price : null,
    change24h: ticker && Number.isFinite(ticker.change24h) ? ticker.change24h : null,
    narrative: narratives[symbol],
  };
}

function pickTodayMover(pool: CoinPoolPayload | null): DailyBriefMover | null {
  if (!pool || pool.isFallback || pool.source === "fallback") return null;

  const candidates = [...pool.trending, ...pool.opportunity].filter(
    (item): item is CoinTickerEntry =>
      !NON_MOVER_SYMBOLS.has(item.symbol.toUpperCase()) && Number.isFinite(item.change24h),
  );

  if (candidates.length === 0) return null;

  const mover = candidates.reduce((max, item) =>
    Math.abs(item.change24h) > Math.abs(max.change24h) ? item : max,
  );

  return {
    symbol: mover.symbol,
    change24h: mover.change24h,
    tier: mover.category,
  };
}

export async function getDailyBrief(locale: Locale | string = "zh_CN"): Promise<DailyBriefData> {
  const [poolResult, fearGreedResult] = await Promise.allSettled([getCoinPool(), fetchFearGreed()]);

  const pool = poolResult.status === "fulfilled" ? poolResult.value : null;
  if (poolResult.status === "rejected") {
    console.warn(
      "[dailyBrief] ticker pool failed",
      poolResult.reason instanceof Error ? poolResult.reason.message : poolResult.reason,
    );
  }

  const fearGreed = fearGreedResult.status === "fulfilled" ? fearGreedResult.value : null;
  const narratives = await getDailyNarratives(locale, pool ?? undefined);

  return {
    majors: MAJOR_SYMBOLS.map((symbol) => majorFromPool(pool, symbol, narratives)),
    fearGreed,
    todayMover: pickTodayMover(pool),
    generatedAt: Date.now(),
  };
}
