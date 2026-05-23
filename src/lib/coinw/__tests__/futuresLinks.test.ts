import { describe, expect, it } from "vitest";
import { buildCoinWFuturesTradeUrl, normalizeCoinWFuturesPair } from "@/lib/coinw/futuresLinks";

describe("CoinW futures links", () => {
  it("normalizes CoinW futures pair identifiers", () => {
    expect(normalizeCoinWFuturesPair("btc_usdt")).toBe("BTC_USDT");
    expect(normalizeCoinWFuturesPair("BTCUSDT")).toBe("BTC_USDT");
    expect(normalizeCoinWFuturesPair(" HYPE-USDT ")).toBe("HYPE_USDT");
    expect(normalizeCoinWFuturesPair("")).toBeNull();
  });

  it("builds a safe futures landing URL when a pair URL template is not configured", () => {
    expect(buildCoinWFuturesTradeUrl({ coinwPair: "BTC_USDT" })).toBe(
      "https://www.coinw.com/market/futures",
    );
    expect(buildCoinWFuturesTradeUrl({ coinwPair: null })).toBe(
      "https://www.coinw.com/market/futures",
    );
  });

  it("uses an explicit pair template when CoinW confirms the route shape", () => {
    expect(
      buildCoinWFuturesTradeUrl({
        coinwPair: "BTC_USDT",
        template: "https://www.coinw.com/futures/{pairCompactLower}",
      }),
    ).toBe("https://www.coinw.com/futures/btcusdt");
  });
});
