"use client";

import { useEffect, useState } from "react";
import type { HeroTrendingCoin, HeroTrendingCoinsResponse } from "../types/trending-coin";

const SESSION_STORAGE_KEY = "hero_trending_session_v1";

const sessionFallbackCoins: HeroTrendingCoin[] = [
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

function readSessionCache() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HeroTrendingCoinsResponse;
    if (!Array.isArray(parsed.coins) || parsed.coins.length < 4) return null;
    return { ...parsed, source: "session" as const };
  } catch {
    return null;
  }
}

function writeSessionCache(payload: HeroTrendingCoinsResponse) {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Session caching should not block the hero.
  }
}

export function useTrendingCoins() {
  const [response, setResponse] = useState<HeroTrendingCoinsResponse>(() => ({
    coins: sessionFallbackCoins,
    generatedAt: new Date().toISOString(),
    source: "fallback",
  }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sessionCached = readSessionCache();
    if (sessionCached) {
      setResponse(sessionCached);
      setIsLoading(false);
      return;
    }

    async function loadCoins() {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch("/api/hero/trending-coins", {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Hero coin request failed with ${res.status}`);
        const payload = (await res.json()) as HeroTrendingCoinsResponse;
        if (cancelled) return;
        setResponse(payload);
        writeSessionCache(payload);
      } catch {
        if (!cancelled) {
          setResponse({
            coins: sessionFallbackCoins,
            generatedAt: new Date().toISOString(),
            source: "fallback",
          });
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadCoins();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    coins: response.coins.slice(0, 4),
    generatedAt: response.generatedAt,
    source: response.source,
    isLoading,
    isStale: response.source === "last-cache" || response.source === "fallback",
  };
}
