import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";

const getCoinPoolMock = vi.hoisted(() => vi.fn());
const triggerSignalGenerationMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/marketSignals", () => ({
  triggerSignalGeneration: triggerSignalGenerationMock,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: rateLimitMock,
}));

function pool(source: CoinPoolPayload["source"] = "coinw-kline"): CoinPoolPayload {
  return {
    ts: 1_715_600_000_000,
    tickers: {
      BTC: { price: 100_000, change24h: 1 },
      ETH: { price: 3_000, change24h: 2 },
      SOL: { price: 200, change24h: 3 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [],
    trending: [],
    opportunity: [],
    source,
  };
}

describe("/api/market/ticker", () => {
  beforeEach(() => {
    getCoinPoolMock.mockReset();
    triggerSignalGenerationMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue(true);
    getCoinPoolMock.mockResolvedValue(pool());
    triggerSignalGenerationMock.mockResolvedValue(pool());
  });

  it("lets public ticker reads opt out of signal-generation side effects", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/market/ticker?signalTrigger=0"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.source).toBe("coinw-kline");
    expect(triggerSignalGenerationMock).not.toHaveBeenCalled();
    expect(getCoinPoolMock).toHaveBeenCalledTimes(1);
  });

  it("preserves legacy signal generation by default", async () => {
    const response = await GET(new NextRequest("https://claw42.ai/api/market/ticker"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.source).toBe("coinw-kline");
    expect(triggerSignalGenerationMock).toHaveBeenCalledTimes(1);
    expect(getCoinPoolMock).not.toHaveBeenCalled();
  });
});
