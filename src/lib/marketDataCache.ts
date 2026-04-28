import fallbackTickerData from "@/modules/agent-watch/skills/fallback-tickers.json";
import type { MarketTickerPayload, TickerMap } from "@/modules/agent-watch/types";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
let lastKnownTickers: MarketTickerPayload | null = null;

const TICKER_CACHE_KEY = "coingecko:ticker:v1";
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=usd&include_24hr_change=true";

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;

  const fresh = await fetcher();
  cache.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
  return fresh;
}

function fallbackTickers(): MarketTickerPayload {
  return {
    ts: Date.now(),
    tickers: fallbackTickerData.tickers as TickerMap,
    isFallback: true,
    error: "ticker_unavailable",
  };
}

function normalizeCoinGeckoPayload(payload: unknown): TickerMap {
  const source = payload as Record<string, { usd?: number; usd_24h_change?: number }>;
  return {
    BTC: {
      price: Number(source.bitcoin?.usd ?? fallbackTickerData.tickers.BTC.price),
      change24h: Number(
        source.bitcoin?.usd_24h_change ?? fallbackTickerData.tickers.BTC.change24h,
      ),
    },
    ETH: {
      price: Number(source.ethereum?.usd ?? fallbackTickerData.tickers.ETH.price),
      change24h: Number(
        source.ethereum?.usd_24h_change ?? fallbackTickerData.tickers.ETH.change24h,
      ),
    },
    SOL: {
      price: Number(source.solana?.usd ?? fallbackTickerData.tickers.SOL.price),
      change24h: Number(
        source.solana?.usd_24h_change ?? fallbackTickerData.tickers.SOL.change24h,
      ),
    },
    USDT: {
      price: Number(source.tether?.usd ?? fallbackTickerData.tickers.USDT.price),
      change24h: Number(
        source.tether?.usd_24h_change ?? fallbackTickerData.tickers.USDT.change24h,
      ),
    },
  };
}

async function fetchCoinGeckoTickers(): Promise<MarketTickerPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const headers: HeadersInit = {};
    if (process.env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    }

    const response = await fetch(COINGECKO_URL, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`coingecko ${response.status}`);

    const payload = await response.json();
    const fresh = {
      ts: Date.now(),
      tickers: normalizeCoinGeckoPayload(payload),
    };
    lastKnownTickers = fresh;
    return fresh;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMarketTickers(): Promise<MarketTickerPayload> {
  try {
    return await getCached(TICKER_CACHE_KEY, 30_000, fetchCoinGeckoTickers);
  } catch (error) {
    console.warn("[claw42] ticker fallback", error instanceof Error ? error.message : error);
    if (lastKnownTickers) {
      return {
        ...lastKnownTickers,
        ts: Date.now(),
        isStale: true,
        error: "ticker_unavailable",
      };
    }
    return fallbackTickers();
  }
}
