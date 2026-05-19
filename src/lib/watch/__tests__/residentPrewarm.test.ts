import { describe, expect, it } from "vitest";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import { residentPrewarmCandidates } from "@/lib/watch/residentPrewarm";

const now = Date.parse("2026-05-13T19:20:00.000Z");

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: {
        price: 101000,
        change24h: 12,
      },
      ETH: { price: 4200, change24h: 0.4 },
      SOL: { price: 220, change24h: 0.3 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [
      {
        symbol: "BTC",
        price: 101000,
        change24h: 12,
        category: "majors",
        marketCapUsd: 2_000_000_000_000,
        totalVolumeUsd24h: 60_000_000_000,
      },
    ],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

function highImpactNews(): NewsItem {
  return {
    id: "news-btc",
    title: "BTC ETF inflows accelerate as volatility breaks higher",
    url: "https://example.com/btc-etf",
    source: "CoinDesk",
    currencies: ["BTC"],
    sentiment: "bullish",
    publishedAt: now - 5 * 60_000,
    votes: {
      positive: 9,
      negative: 0,
      important: 8,
    },
  };
}

describe("residentPrewarmCandidates", () => {
  it("can emit a burst hotspot outside the fixed 3-hour baseline window", () => {
    const candidates = residentPrewarmCandidates({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [highImpactNews()],
    });

    expect(candidates.map((candidate) => candidate.candidateKey)).toEqual([
      "hotspot:burst:zh_CN:2026-05-13T19:BTC",
    ]);
    expect(candidates[0]).toMatchObject({
      candidateType: "hotspot",
      symbol: "BTC",
      executable: false,
    });
  });
});
