import { afterEach, describe, expect, it, vi } from "vitest";

const coingeckoPayload = {
  bitcoin: { usd: 101000, usd_24h_change: 1.2 },
  ethereum: { usd: 4200, usd_24h_change: -0.4 },
  solana: { usd: 220, usd_24h_change: 3.2 },
  tether: { usd: 1, usd_24h_change: 0.01 },
};

describe("getMarketTickers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses COINGECKO_DEMO_KEY when the legacy market-data key is absent", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "");
    vi.stubEnv("COINGECKO_DEMO_KEY", "demo-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(coingeckoPayload)));
    vi.stubGlobal("fetch", fetchMock);

    const { getMarketTickers } = await import("@/lib/marketDataCache");
    const tickers = await getMarketTickers();

    expect(tickers.source).toBe("coingecko-ticker");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.coingecko.com/api/v3/simple/price"),
      expect.objectContaining({
        headers: { "x-cg-demo-api-key": "demo-key" },
      }),
    );
  });

  it("keeps COINGECKO_API_KEY as the market-data key when both keys exist", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "market-key");
    vi.stubEnv("COINGECKO_DEMO_KEY", "demo-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(coingeckoPayload)));
    vi.stubGlobal("fetch", fetchMock);

    const { getMarketTickers } = await import("@/lib/marketDataCache");
    await getMarketTickers();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.coingecko.com/api/v3/simple/price"),
      expect.objectContaining({
        headers: { "x-cg-demo-api-key": "market-key" },
      }),
    );
  });
});
