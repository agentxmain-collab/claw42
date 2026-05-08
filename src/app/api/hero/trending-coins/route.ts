import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { hasKvConfig } from "@/lib/observability/kv-metrics";
import {
  computeTrendingScore,
  HERO_TRENDING_STABLE_SYMBOLS,
} from "@/modules/landing/HeroSceneInteractive/utils/computeTrendingScore";
import type {
  HeroTrendingCoin,
  HeroTrendingCoinsResponse,
} from "@/modules/landing/HeroSceneInteractive/types/trending-coin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 30 * 60;
const LAST_CACHE_TTL_SECONDS = 24 * 60 * 60;
const COINGECKO_TIMEOUT_MS = 2500;
const CACHE_PREFIX = "hero:trending";
const LAST_CACHE_KEY = `${CACHE_PREFIX}:last`;
const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h&locale=en";

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
}

const fallbackCoins: HeroTrendingCoin[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    priceUsd: 94000,
    changePercent24h: 6.8,
    totalVolumeUsd24h: 42_000_000_000,
    marketCapUsd: 1_860_000_000_000,
    score: 31.6,
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    priceUsd: 3200,
    changePercent24h: 4.2,
    totalVolumeUsd24h: 21_000_000_000,
    marketCapUsd: 386_000_000_000,
    score: 27.8,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    image: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    priceUsd: 184,
    changePercent24h: 9.5,
    totalVolumeUsd24h: 8_200_000_000,
    marketCapUsd: 86_000_000_000,
    score: 26.3,
  },
  {
    id: "tether",
    symbol: "USDT",
    name: "Tether",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    priceUsd: 1,
    changePercent24h: 0.02,
    totalVolumeUsd24h: 58_000_000_000,
    marketCapUsd: 144_000_000_000,
    score: 18.2,
  },
];

let memoryCache:
  | {
      key: string;
      expiresAt: number;
      payload: HeroTrendingCoinsResponse;
    }
  | undefined;
let memoryLast: HeroTrendingCoinsResponse | undefined;

function currentSlot(date = new Date()) {
  const slotMs = CACHE_TTL_SECONDS * 1000;
  return Math.floor(date.getTime() / slotMs);
}

function cacheKey(slot = currentSlot()) {
  return `${CACHE_PREFIX}:${slot}`;
}

function fallbackResponse(source: HeroTrendingCoinsResponse["source"]): HeroTrendingCoinsResponse {
  return {
    coins: fallbackCoins,
    generatedAt: new Date().toISOString(),
    source,
  };
}

function normalizeCoin(coin: CoinGeckoMarketCoin): HeroTrendingCoin | null {
  const symbol = coin.symbol.toUpperCase();
  const volume = coin.total_volume ?? 0;
  const marketCap = coin.market_cap ?? 0;
  const change = coin.price_change_percentage_24h ?? 0;

  if (HERO_TRENDING_STABLE_SYMBOLS.has(symbol.toLowerCase())) return null;
  if (volume < 10_000_000 || marketCap < 50_000_000) return null;

  return {
    id: coin.id,
    symbol,
    name: coin.name,
    image: coin.image,
    priceUsd: coin.current_price ?? 0,
    changePercent24h: change,
    totalVolumeUsd24h: volume,
    marketCapUsd: marketCap,
    score: computeTrendingScore(change, volume),
  };
}

async function fetchTrendingCoins(): Promise<HeroTrendingCoinsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COINGECKO_TIMEOUT_MS);

  const response = await fetch(COINGECKO_MARKETS_URL, {
    headers: { accept: "application/json" },
    next: { revalidate: CACHE_TTL_SECONDS },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with ${response.status}`);
  }

  const payload = (await response.json()) as CoinGeckoMarketCoin[];
  const coins = payload
    .map(normalizeCoin)
    .filter((coin): coin is HeroTrendingCoin => Boolean(coin))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (coins.length < 4) {
    throw new Error("CoinGecko response did not contain enough eligible coins");
  }

  return {
    coins,
    generatedAt: new Date().toISOString(),
    source: "coingecko",
  };
}

async function readKv<T>(key: string): Promise<T | null> {
  if (!hasKvConfig()) return null;

  try {
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

async function writeKv(key: string, payload: HeroTrendingCoinsResponse, ttlSeconds: number) {
  if (!hasKvConfig()) return;

  try {
    await kv.set(key, payload, { ex: ttlSeconds });
  } catch {
    // Trending data is a progressive enhancement; KV failures fall back to memory or static data.
  }
}

async function resolveTrendingCoins(): Promise<HeroTrendingCoinsResponse> {
  const key = cacheKey();
  const now = Date.now();

  if (memoryCache?.key === key && memoryCache.expiresAt > now) {
    return memoryCache.payload;
  }

  const kvCached = await readKv<HeroTrendingCoinsResponse>(key);
  if (kvCached) {
    memoryCache = { key, expiresAt: now + CACHE_TTL_SECONDS * 1000, payload: kvCached };
    memoryLast = kvCached;
    return kvCached;
  }

  try {
    const fresh = await fetchTrendingCoins();
    memoryCache = { key, expiresAt: now + CACHE_TTL_SECONDS * 1000, payload: fresh };
    memoryLast = fresh;
    await Promise.all([
      writeKv(key, fresh, CACHE_TTL_SECONDS),
      writeKv(LAST_CACHE_KEY, fresh, LAST_CACHE_TTL_SECONDS),
    ]);
    return fresh;
  } catch {
    const last = memoryLast ?? (await readKv<HeroTrendingCoinsResponse>(LAST_CACHE_KEY));
    if (last) {
      return { ...last, source: "last-cache", generatedAt: last.generatedAt };
    }

    return fallbackResponse("fallback");
  }
}

export async function GET() {
  const payload = await resolveTrendingCoins();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800",
    },
  });
}
