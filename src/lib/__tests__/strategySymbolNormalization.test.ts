import { describe, expect, it } from "vitest";
import { buildCoinwDeeplink } from "@/lib/strategyDeeplink";
import { validateStrategyAgainstSnapshot } from "@/lib/strategyValidator";
import { normalizeThreadSymbol } from "@/lib/sharedThreadStore";
import { isCoreCoinSymbol, normalizeDebateSymbol, type FinalStrategy } from "@/lib/types";
import type { TickerSnapshot } from "@/lib/news/livePriceFetch";

function strategy(symbol: string): FinalStrategy {
  return {
    id: "strategy-1",
    symbol,
    direction: "long",
    rating: "Buy",
    entryCondition: "ETH confirms support",
    stopLoss: 95,
    takeProfit: [105, 110],
    consensusRatio: "3:0",
    consensusAgents: ["alpha"],
    dissentAgents: [],
    dissentNote: "",
    riskNote: "Support can fail",
    followCount: 0,
    viewCount: 0,
    createdAt: Date.UTC(2026, 4, 13, 20, 0, 0),
    expiresAt: Date.UTC(2026, 4, 13, 21, 0, 0),
    deeplink: "",
  };
}

const snapshot: TickerSnapshot = {
  fetchedAt: Date.UTC(2026, 4, 13, 20, 0, 0),
  prices: {
    ETH: {
      current: 100,
      change24h: 2,
      high24h: 104,
      low24h: 96,
      high7d: 112,
      low7d: 90,
      last5min: [99, 100],
      last30min: [96, 100],
    },
  },
};

describe("strategy symbol normalization", () => {
  it("strips repeated cash-tag prefixes across strategy helpers", () => {
    expect(normalizeThreadSymbol(" $$eth ")).toBe("ETH");
    expect(normalizeDebateSymbol(" $$sol ")).toBe("SOL");
    expect(isCoreCoinSymbol(" $$sol ")).toBe(true);

    const validation = validateStrategyAgainstSnapshot(strategy(" $$eth "), snapshot);
    expect(validation.ok).toBe(true);
    expect(validation.reasons).not.toContain("missing live price for $ETH");

    const deeplink = buildCoinwDeeplink(strategy(" $$eth "));
    expect(deeplink).toBe("https://www.coinw.com/zh_CN/futures/usdt/ethusdt");
    expect(deeplink).not.toContain("%24ETHUSDT");
  });

  it("falls back to CoinW futures landing when the symbol is not in the local futures whitelist", () => {
    expect(buildCoinwDeeplink(strategy("NOTLISTED"))).toBe(
      "https://www.coinw.com/zh_CN/futures/usdt",
    );
  });
});
