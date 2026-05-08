import type { CoinPoolPayload, CoinTickerEntry } from "@/modules/agent-watch/types";

export const LIVE_PRICE_TTL_MS = 10_000;

export interface LivePricePoint {
  current: number;
  change24h: number;
  high24h: number;
  low24h: number;
  high7d: number;
  low7d: number;
  last5min: number[];
  last30min: number[];
}

export interface TickerSnapshot {
  fetchedAt: number;
  prices: Record<string, LivePricePoint>;
}

type CoinGeckoMarket = {
  symbol?: string;
  current_price?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: {
    price?: number[];
  };
};

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,tether&order=market_cap_desc&per_page=4&page=1&sparkline=true&price_change_percentage=24h,7d";

let lastFetch = 0;
let lastData: TickerSnapshot | null = null;

function coinGeckoHeaders(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactSeries(values: unknown[] | undefined, fallback: number, count: number): number[] {
  const series = (values ?? [])
    .map(finiteNumber)
    .filter((value): value is number => value !== null && value > 0);

  if (series.length >= count) return series.slice(-count);
  if (series.length > 0) return [...Array(count - series.length).fill(series[0]), ...series];
  return Array(count).fill(fallback);
}

function pointFromMarket(item: CoinGeckoMarket): [string, LivePricePoint] | null {
  const symbol = item.symbol?.toUpperCase();
  const current = finiteNumber(item.current_price);
  if (!symbol || current === null || current <= 0) return null;

  const sparkline = item.sparkline_in_7d?.price;
  const last30min = compactSeries(sparkline, current, 30);
  const last5min = compactSeries(sparkline, current, 5);
  const sevenDaySeries = compactSeries(sparkline, current, 168);
  const high24h = finiteNumber(item.high_24h) ?? Math.max(...last30min, current);
  const low24h = finiteNumber(item.low_24h) ?? Math.min(...last30min, current);

  return [
    symbol,
    {
      current,
      change24h: finiteNumber(item.price_change_percentage_24h) ?? 0,
      high24h,
      low24h,
      high7d: Math.max(...sevenDaySeries, high24h, current),
      low7d: Math.min(...sevenDaySeries, low24h, current),
      last5min,
      last30min,
    },
  ];
}

function pointFromPoolTicker(ticker: CoinTickerEntry): [string, LivePricePoint] | null {
  const symbol = ticker.symbol.toUpperCase();
  const current = finiteNumber(ticker.price);
  if (!symbol || current === null || current <= 0) return null;

  const change = finiteNumber(ticker.change24h) ?? 0;
  const prior = current / (1 + change / 100 || 1);
  const high = Math.max(current, prior);
  const low = Math.min(current, prior);
  const last30min = Array.from({ length: 30 }, (_, index) => {
    const ratio = index / 29;
    return prior + (current - prior) * ratio;
  });

  return [
    symbol,
    {
      current,
      change24h: change,
      high24h: high,
      low24h: low,
      high7d: high,
      low7d: low,
      last5min: last30min.slice(-5),
      last30min,
    },
  ];
}

async function fetchCoinGeckoMarkets(): Promise<Record<string, LivePricePoint>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(COINGECKO_MARKETS_URL, {
      cache: "no-store",
      headers: coinGeckoHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`coingecko live ${response.status}`);
    const payload = (await response.json()) as CoinGeckoMarket[];
    return Object.fromEntries(
      payload
        .map(pointFromMarket)
        .filter((entry): entry is [string, LivePricePoint] => Boolean(entry)),
    );
  } finally {
    clearTimeout(timer);
  }
}

function mergePoolFallback(
  prices: Record<string, LivePricePoint>,
  pool?: CoinPoolPayload,
): Record<string, LivePricePoint> {
  if (!pool) return prices;
  const entries = [...pool.majors, ...pool.trending, ...pool.opportunity];
  for (const ticker of entries) {
    const symbol = ticker.symbol.toUpperCase();
    if (prices[symbol]) continue;
    const fallback = pointFromPoolTicker(ticker);
    if (fallback) prices[fallback[0]] = fallback[1];
  }
  return prices;
}

export async function fetchLivePriceSnapshot(
  pool?: CoinPoolPayload,
): Promise<TickerSnapshot | null> {
  const now = Date.now();
  if (lastData && now - lastFetch < LIVE_PRICE_TTL_MS) {
    return { ...lastData, prices: mergePoolFallback({ ...lastData.prices }, pool) };
  }

  try {
    const prices = mergePoolFallback(await fetchCoinGeckoMarkets(), pool);
    if (Object.keys(prices).length === 0) return null;
    lastData = { fetchedAt: now, prices };
    lastFetch = now;
    return lastData;
  } catch (error) {
    console.warn(
      "[claw42] live price snapshot failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
  })}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function formatSeries(values: number[]): string {
  return values
    .map((value) =>
      value.toLocaleString("en-US", {
        maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
      }),
    )
    .join(" → ");
}

export function formatLiveSnapshotForPrompt(
  snapshot: TickerSnapshot | null,
  symbols: string[],
): string {
  if (!snapshot) {
    return [
      "## 实时市场状态",
      "tickerFailed: true",
      "实时价格抓取失败。Agent 只能短句表态等数据，不得输出策略或点位。",
    ].join("\n");
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - snapshot.fetchedAt) / 1000));
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));

  return [
    `## 实时市场状态 — 数据 ${ageSeconds} 秒前抓取`,
    ...uniqueSymbols.map((symbol) => {
      const point = snapshot.prices[symbol];
      if (!point) return `${symbol}: <数据缺失>（严禁用其他币价格替代）`;
      return [
        `${symbol}:`,
        `  当前 ${formatUsd(point.current)} (24h ${formatPct(point.change24h)})`,
        `  24h 高 ${formatUsd(point.high24h)} / 24h 低 ${formatUsd(point.low24h)}`,
        `  7d 高 ${formatUsd(point.high7d)} / 7d 低 ${formatUsd(point.low7d)}`,
        `  最近 5 个价格点: ${formatSeries(point.last5min)}`,
        `  最近 30 个价格点: ${formatSeries(point.last30min)}`,
      ].join("\n");
    }),
    "硬约束：发言必须引用上方至少 1 个具体数字，并用“所以 + 行动/观察 + 价格触发条件”收束。",
  ].join("\n");
}
