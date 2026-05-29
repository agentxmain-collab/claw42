import { describe, expect, it, vi } from "vitest";
import { buildCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import {
  resolveCurrentPricesForOpenStrategies,
  type CoinWPriceResolution,
} from "@/lib/coinw/futuresPrices";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";

const now = Date.UTC(2026, 4, 29, 0, 0, 0);
const instruments = buildCoinWFuturesInstrumentSet([
  { symbol: "BTC", coinwPair: "BTC_USDT", status: "online" },
  { symbol: "HYPE", coinwPair: "HYPE_USDT", status: "online" },
  { symbol: "HOOD", coinwPair: "HOOD_USDT", status: "online" },
  { symbol: "BILL", coinwPair: "BILL_USDT", status: "online" },
]);

describe("resolveCurrentPricesForOpenStrategies", () => {
  it("uses the same-run executable pool snapshot before network sources", async () => {
    const fetcher = vi.fn();
    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["BTC"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "BTC")).toMatchObject({
      symbol: "BTC",
      price: 101000,
      source: "pool",
      coinwPair: "BTC_USDT",
      fetchedAt: new Date(now).toISOString(),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches arbitrary CoinW futures ticker prices when the symbol is not in the pool", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(
        String(url).includes("/ticker/list")
          ? {
              code: 0,
              data: [
                {
                  base_coin: "hype",
                  name: "HYPEUSDT",
                  last_price: 61.78,
                },
              ],
            }
          : { code: 404 },
      ),
    );

    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["HYPE"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "HYPE")).toMatchObject({
      symbol: "HYPE",
      price: 61.78,
      source: "coinw-futures-ticker",
      coinwPair: "HYPE_USDT",
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/v1/perpumPublic/ticker/list?symbols=HYPE"),
      expect.any(Object),
    );
  });

  it("falls back to CoinW kline close when ticker data is unavailable", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/ticker/list")) return jsonResponse({ code: 500, data: null });
      return jsonResponse({
        code: 0,
        data: [
          [now - 60_000, 10, 12, 9, 11, 1],
          [now, 11, 13, 10, 12.34, 2],
        ],
      });
    });

    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["BILL"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "BILL")).toMatchObject({
      symbol: "BILL",
      price: 12.34,
      source: "coinw-kline",
      coinwPair: "BILL_USDT",
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/v1/perpumPublic/klines?currencyCode=BILL"),
      expect.any(Object),
    );
  });

  it("keeps missing CoinW prices internal when all CoinW price sources fail", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ code: 904, data: null }));

    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["BILL"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "BILL")).toEqual({
      symbol: "BILL",
      price: null,
      source: "missingCoinWPrice",
      fetchedAt: new Date(now).toISOString(),
      coinwPair: "BILL_USDT",
      reason: "coinw_price_unavailable",
    });
  });

  it("accepts HOOD when CoinW lists it as an online futures instrument", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: [{ base_coin: "hood", name: "HOODUSDT", last_price: 85.12 }],
      }),
    );

    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["HOOD"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "HOOD")).toMatchObject({
      symbol: "HOOD",
      price: 85.12,
      source: "coinw-futures-ticker",
      coinwPair: "HOOD_USDT",
    });
  });

  it("does not resolve symbols that are not in the CoinW futures instrument set", async () => {
    const fetcher = vi.fn();

    const result = await resolveCurrentPricesForOpenStrategies({
      symbols: ["IRYS"],
      pool: coinwPool(),
      now,
      fetcher,
      instruments,
    });

    expect(price(result, "IRYS")).toEqual({
      symbol: "IRYS",
      price: null,
      source: "missingCoinWPrice",
      fetchedAt: new Date(now).toISOString(),
      reason: "not_listed_on_coinw",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function coinwPool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 3.3 },
      ETH: { price: 4200, change24h: 0.5 },
      SOL: { price: 220, change24h: 0.2 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [
      {
        symbol: "BTC",
        price: 101000,
        change24h: 3.3,
        category: "majors",
        execution: { executable: true, coinwPair: "BTC_USDT", watchOnly: false },
      },
    ],
    trending: [
      {
        symbol: "ETH",
        price: 4200,
        change24h: 0.5,
        category: "trending",
      },
    ],
    opportunity: [],
    source: "coinw-kline",
  };
}

function price(results: Map<string, CoinWPriceResolution>, symbol: string) {
  const result = results.get(symbol);
  if (!result) throw new Error(`missing ${symbol}`);
  return result;
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}
