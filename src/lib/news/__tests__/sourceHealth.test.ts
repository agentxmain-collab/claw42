import { describe, expect, it } from "vitest";
import { getNewsSourceHealthSnapshot } from "@/lib/news/sourceHealth";

describe("getNewsSourceHealthSnapshot", () => {
  it("reports auth configuration without exposing secrets", () => {
    const health = getNewsSourceHealthSnapshot({
      env: {
        CRYPTOCOMPARE_API_KEY: "secret-cryptocompare",
        COINGECKO_DEMO_KEY: "",
      },
      standbyEnabled: false,
    });

    expect(health.find((source) => source.id === "cryptocompare")).toMatchObject({
      id: "cryptocompare",
      inFetchChain: true,
      fetchChainRank: 0,
      authRequired: true,
      authConfigured: true,
      availableByConfig: true,
      unavailableReason: null,
    });
    expect(health.find((source) => source.id === "coingecko")).toMatchObject({
      id: "coingecko",
      inFetchChain: true,
      fetchChainRank: 3,
      authRequired: true,
      authConfigured: false,
      availableByConfig: false,
      unavailableReason: "missing_env",
    });
    expect(health.find((source) => source.id === "foresightnews")).toMatchObject({
      id: "foresightnews",
      inFetchChain: true,
      fetchChainRank: 1,
      authRequired: true,
      authConfigured: false,
      availableByConfig: false,
      unavailableReason: "missing_env",
    });
    expect(health.find((source) => source.id === "rss-panews-flash")).toMatchObject({
      id: "rss-panews-flash",
      inFetchChain: true,
      fetchChainRank: 2,
      authRequired: false,
      authConfigured: true,
      availableByConfig: true,
    });
    expect(health.find((source) => source.id === "rss-coindesk")).toMatchObject({
      id: "rss-coindesk",
      authRequired: false,
      authConfigured: true,
      availableByConfig: true,
    });
    expect(health.find((source) => source.id === "cryptopanic")).toMatchObject({
      id: "cryptopanic",
      inFetchChain: true,
      fetchChainRank: 4,
      unavailableReason: "missing_env",
    });
    expect(health.find((source) => source.id === "coinw-announcements")).toMatchObject({
      id: "coinw-announcements",
      inFetchChain: false,
      unavailableReason: "planned_endpoint",
    });
    expect(JSON.stringify(health)).not.toContain("secret-cryptocompare");
  });

  it("reports preferred standby source order when standby sources are enabled", () => {
    const health = getNewsSourceHealthSnapshot({
      env: {
        NEWS_ENABLE_STANDBY_SOURCES: "1",
        NEWS_PRIMARY_SOURCE: "cryptopanic",
        CRYPTOCOMPARE_API_KEY: "secret-cryptocompare",
        COINGECKO_DEMO_KEY: "secret-coingecko",
        CRYPTOPANIC_API_KEY: "secret-cryptopanic",
      },
    });

    expect(health.find((source) => source.id === "cryptopanic")).toMatchObject({
      id: "cryptopanic",
      inFetchChain: true,
      fetchChainRank: 0,
      authConfigured: true,
      availableByConfig: true,
      unavailableReason: null,
    });
    expect(health.find((source) => source.id === "cryptocompare")).toMatchObject({
      id: "cryptocompare",
      inFetchChain: true,
      fetchChainRank: 1,
    });
    expect(JSON.stringify(health)).not.toContain("secret-cryptopanic");
  });
});
