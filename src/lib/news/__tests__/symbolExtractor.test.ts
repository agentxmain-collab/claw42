import { describe, expect, it } from "vitest";
import type { NewsItem } from "@/lib/types";
import {
  buildNewsDrivenCandidates,
  extractSymbolsFromNewsText,
  matchSingleSymbol,
} from "@/lib/news/symbolExtractor";
import { staticCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";

const instruments = staticCoinWFuturesInstrumentSet();
const now = Date.UTC(2026, 4, 26, 8, 0, 0);

function news(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: "news:base",
    title: "比特币 ETF 净流入回升",
    url: "https://example.com/news",
    source: "PANews 快讯",
    currencies: [],
    sentiment: "bullish",
    publishedAt: now,
    ...overrides,
  };
}

describe("news-driven symbol extraction", () => {
  it("matches a single CoinW futures symbol from Chinese aliases", () => {
    const item = news({ title: "比特币现货 ETF 净流入回升" });

    expect(extractSymbolsFromNewsText(item, instruments)).toEqual(["BTC"]);
    expect(matchSingleSymbol(item, instruments)).toBe("BTC");
  });

  it("rejects multi-symbol news instead of forcing a candidate", () => {
    const item = news({ title: "比特币与以太坊资金同步回流" });

    expect(extractSymbolsFromNewsText(item, instruments)).toEqual(["BTC", "ETH"]);
    expect(matchSingleSymbol(item, instruments)).toBeNull();
  });

  it("filters symbols that are not listed in the CoinW futures set", () => {
    const item = news({ title: "NEAR 生态资金活跃", currencies: ["NEAR"] });

    expect(extractSymbolsFromNewsText(item, instruments)).toEqual([]);
    expect(matchSingleSymbol(item, instruments)).toBeNull();
  });

  it("builds a source-news-specific candidate key", async () => {
    const [candidate] = await buildNewsDrivenCandidates({
      newsItems: [news({ id: "pa:btc:1", title: "比特币突破关键区间" })],
      instruments,
      now,
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        symbol: "BTC",
        candidate: expect.objectContaining({
          candidateType: "symbol",
          candidateKey: expect.stringContaining("news-driven:BTC:"),
          executable: true,
        }),
      }),
    );
  });
});
