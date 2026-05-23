import { describe, expect, it } from "vitest";
import {
  buildCoinWFuturesInstrumentSet,
  filterCoinWFuturesPoolEntries,
  normalizeCoinWFuturesInstruments,
} from "@/lib/coinw/futuresInstruments";

describe("CoinW futures instruments", () => {
  it("normalizes official perpum instrument rows into executable USDT futures metadata", () => {
    const instruments = normalizeCoinWFuturesInstruments({
      code: 0,
      data: [
        {
          id: 1,
          name: "BTC",
          base: "btc",
          quote: "usdt",
          status: "online",
          minSize: 1,
          oneLotSize: 0.001,
          pricePrecision: 1,
          maxLeverage: 200,
          leverage: [5, 10, 20, 50, 100, 125, 200],
        },
        {
          id: 999,
          name: "OLD",
          base: "old",
          quote: "usdt",
          status: "offline",
        },
        {
          id: 1000,
          name: "BTCUSD",
          base: "btc",
          quote: "usd",
          status: "online",
        },
      ],
    });

    expect(instruments).toEqual([
      {
        symbol: "BTC",
        coinwPair: "BTC_USDT",
        instrumentId: "1",
        status: "online",
        minSize: 1,
        oneLotSize: 0.001,
        pricePrecision: 1,
        maxLeverage: 200,
        leverage: [5, 10, 20, 50, 100, 125, 200],
      },
    ]);
  });

  it("filters candidate pool entries to confirmed CoinW futures symbols only", () => {
    const instrumentSet = buildCoinWFuturesInstrumentSet([
      {
        symbol: "HYPE",
        coinwPair: "HYPE_USDT",
        instrumentId: "153",
        status: "online",
      },
      {
        symbol: "BILL",
        coinwPair: "BILL_USDT",
        instrumentId: "214",
        status: "online",
      },
    ]);

    const filtered = filterCoinWFuturesPoolEntries(
      [
        { symbol: "HYPE", price: 38, change24h: 4, category: "trending" },
        { symbol: "IRYS", price: 0.03, change24h: 18, category: "trending" },
        { symbol: "BILL", price: 0.01, change24h: 12, category: "opportunity" },
      ],
      instrumentSet,
    );

    expect(filtered.map((item) => item.symbol)).toEqual(["HYPE", "BILL"]);
    expect(filtered[0]?.execution).toEqual({
      executable: true,
      coinwPair: "HYPE_USDT",
      watchOnly: false,
    });
  });
});
