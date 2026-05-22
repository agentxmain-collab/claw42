import { describe, expect, it } from "vitest";
import { evaluateMarketTriggers } from "@/lib/watch/marketTriggers";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const now = Date.parse("2026-05-22T00:00:00.000Z");

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 100000, change24h: 1 },
      ETH: { price: 4000, change24h: 1 },
      SOL: { price: 200, change24h: 1 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [],
    trending: [
      {
        symbol: "HYPE",
        price: 38,
        change24h: 9.2,
        marketCapUsd: 1_000_000_000,
        totalVolumeUsd24h: 120_000_000,
        category: "trending",
      },
      {
        symbol: "QUIET",
        price: 1,
        change24h: 0.2,
        marketCapUsd: 1_000_000_000,
        totalVolumeUsd24h: 10_000_000,
        category: "trending",
      },
    ],
    opportunity: [],
    source: "coingecko-ticker",
  };
}

function news(symbol: string, id: string): NewsItem {
  return {
    id,
    title: `${symbol} headline`,
    url: `https://example.com/${id}`,
    source: "CryptoPanic",
    currencies: [symbol],
    sentiment: "neutral",
    publishedAt: now,
  };
}

describe("evaluateMarketTriggers", () => {
  it("emits price, volume, news, and social triggers from real inputs", () => {
    const triggers = evaluateMarketTriggers({
      pool: pool(),
      newsItems: [news("HYPE", "n1"), news("HYPE", "n2")],
      socialSignals: [{ symbol: "HYPE", score: 80 }],
      now,
    });

    expect(triggers.map((trigger) => `${trigger.kind}:${trigger.symbol}`)).toEqual([
      "volume_anomaly:HYPE",
      "price_volatility:HYPE",
      "social_spike:HYPE",
      "news_intensity:HYPE",
    ]);
  });

  it("accepts an empty trigger set instead of forcing filler coins", () => {
    expect(evaluateMarketTriggers({ pool: { ...pool(), trending: [] }, now })).toEqual([]);
  });
});
