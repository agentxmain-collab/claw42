import { describe, expect, it } from "vitest";
import {
  buildCoinWFuturesTradeUrl,
  normalizeCoinWFuturesLocale,
  normalizeCoinWFuturesPair,
} from "@/lib/coinw/futuresLinks";

describe("CoinW futures links", () => {
  it("normalizes CoinW futures pair identifiers", () => {
    expect(normalizeCoinWFuturesPair("btc_usdt")).toBe("BTC_USDT");
    expect(normalizeCoinWFuturesPair("BTCUSDT")).toBe("BTC_USDT");
    expect(normalizeCoinWFuturesPair(" HYPE-USDT ")).toBe("HYPE_USDT");
    expect(normalizeCoinWFuturesPair("")).toBeNull();
  });

  it("normalizes CoinW route locales", () => {
    expect(normalizeCoinWFuturesLocale("zh_CN")).toBe("zh_CN");
    expect(normalizeCoinWFuturesLocale("en_US")).toBe("en_US");
    expect(normalizeCoinWFuturesLocale("bad-locale")).toBe("zh_CN");
  });

  it("builds locale-aware CoinW futures URLs by default", () => {
    expect(buildCoinWFuturesTradeUrl({ coinwPair: "BTC_USDT", locale: "zh_CN" })).toBe(
      "https://www.coinw.com/zh_CN/futures/usdt/btcusdt",
    );
    expect(buildCoinWFuturesTradeUrl({ coinwPair: null, locale: "zh_CN" })).toBe(
      "https://www.coinw.com/zh_CN/futures/usdt",
    );
  });

  it("uses an explicit pair template when CoinW confirms the route shape", () => {
    expect(
      buildCoinWFuturesTradeUrl({
        coinwPair: "BTC_USDT",
        locale: "en_US",
        template: "https://www.coinw.com/{locale}/futures/{pairCompactLower}",
      }),
    ).toBe("https://www.coinw.com/en_US/futures/btcusdt");
  });
});
