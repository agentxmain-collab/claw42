import { describe, expect, it } from "vitest";
import { selectDynamicTrendingEntries } from "@/lib/watch/dynamicTrending";
import type { CoinTickerEntry } from "@/modules/agent-watch/types";
import type { MarketTrigger } from "@/lib/watch/marketTriggers";

function entry(symbol: string): CoinTickerEntry {
  return {
    symbol,
    price: 1,
    change24h: 1,
    category: "trending",
  };
}

function trigger(symbol: string, signalStrength: number): MarketTrigger {
  return {
    kind: "price_volatility",
    symbol,
    signalStrength,
    triggeredAt: "2026-05-22T00:00:00.000Z",
    sourceCount: 1,
  };
}

describe("selectDynamicTrendingEntries", () => {
  it("returns only triggered CoinW futures symbols in score order", () => {
    const selected = selectDynamicTrendingEntries({
      entries: [entry("HYPE"), entry("VVV"), entry("NOPE")],
      triggers: [trigger("VVV", 80), trigger("HYPE", 120), trigger("NOPE", 200)],
      futuresInstrumentSet: new Map([
        ["HYPE", { symbol: "HYPE", coinwPair: "HYPE_USDT" }],
        ["VVV", { symbol: "VVV", coinwPair: "VVV_USDT" }],
      ]),
    });

    expect(selected.map((item) => item.symbol)).toEqual(["HYPE", "VVV"]);
  });

  it("does not use fallback cron as a public trending filler", () => {
    const selected = selectDynamicTrendingEntries({
      entries: [entry("BTC")],
      triggers: [
        {
          kind: "fallback_cron",
          symbol: "BTC",
          signalStrength: 1,
          triggeredAt: "2026-05-22T00:00:00.000Z",
          sourceCount: 1,
        },
      ],
      futuresInstrumentSet: new Map([["BTC", { symbol: "BTC", coinwPair: "BTC_USDT" }]]),
    });

    expect(selected).toEqual([]);
  });
});
