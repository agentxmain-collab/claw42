import { describe, expect, test } from "vitest";
import { resolveVisibleSessionRefreshTarget } from "../AgentWatchBoard";

describe("resolveVisibleSessionRefreshTarget", () => {
  test("does not trigger before timeline has loaded", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [],
        timelineLoaded: false,
        locale: "zh_CN",
      }),
    ).toBeNull();
  });

  test("fills market overview before hotspot when no resident card exists", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "MARKET",
      params: { candidateType: "market_overview" },
    });
  });

  test("fills missing hotspot after market overview exists", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [{ candidateType: "market_overview", symbol: "MARKET" }],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "HOTSPOT",
      params: { candidateType: "hotspot" },
    });
  });

  test("does not refresh pseudo-symbols once resident cards exist", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "market_overview", symbol: "MARKET" },
          { candidateType: "hotspot", symbol: "HOTSPOT" },
        ],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toBeNull();
  });

  test("refreshes latest executable symbol after resident cards exist", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "market_overview", symbol: "MARKET" },
          { candidateType: "hotspot", symbol: "HOTSPOT" },
          { candidateType: "symbol", symbol: "BTC" },
        ],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "BTC",
      params: { symbol: "BTC" },
    });
  });
});
