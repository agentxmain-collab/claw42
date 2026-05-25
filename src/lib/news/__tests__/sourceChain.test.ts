import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "@/lib/types";

const adapterState = vi.hoisted(() => ({
  availableBySource: new Map<string, boolean>(),
  itemsBySource: new Map<string, NewsItem[]>(),
  errorsBySource: new Map<string, Error>(),
}));

function sourceItem(sourceId: string): NewsItem {
  return {
    id: `${sourceId}:news`,
    title: `${sourceId} headline`,
    url: `https://example.com/${sourceId}`,
    source: sourceId,
    currencies: ["BTC"],
    sentiment: "neutral",
    publishedAt: Date.now(),
  };
}

function mockAdapter(sourceId: string) {
  return class {
    readonly source;
    readonly sourceId;

    constructor(source?: { id: string; displayName: string }) {
      this.source = source ?? { id: sourceId, displayName: sourceId };
      this.sourceId = this.source.id;
    }

    isAvailable() {
      return adapterState.availableBySource.get(this.sourceId) ?? false;
    }

    async fetch({ limit }: { limit: number }) {
      const error = adapterState.errorsBySource.get(this.sourceId);
      if (error) throw error;
      return (adapterState.itemsBySource.get(this.sourceId) ?? []).slice(0, limit);
    }
  };
}

vi.mock("@/lib/news/adapters/cryptocompare-adapter", () => ({
  CryptoCompareAdapter: mockAdapter("cryptocompare"),
}));

vi.mock("@/lib/news/adapters/coingecko-news-adapter", () => ({
  CoinGeckoNewsAdapter: mockAdapter("coingecko"),
}));

vi.mock("@/lib/news/adapters/rss-adapter", () => ({
  RssNewsAdapter: mockAdapter("rss"),
}));

vi.mock("@/lib/news/adapters/binance-announcements-adapter", () => ({
  BinanceAnnouncementsAdapter: mockAdapter("binance-announcements"),
}));

vi.mock("@/lib/news/adapters/coinw-announcements-adapter", () => ({
  CoinWAnnouncementsAdapter: mockAdapter("coinw-announcements"),
}));

vi.mock("@/lib/news/adapters/cryptopanic-adapter", () => ({
  CryptoPanicAdapter: mockAdapter("cryptopanic"),
}));

vi.mock("@/lib/news/adapters/foresightnewsAdapter", () => ({
  ForesightNewsAdapter: mockAdapter("foresightnews"),
}));

vi.mock("@/lib/news/adapters/panewsRssAdapter", () => ({
  PanewsRssAdapter: mockAdapter("rss-panews"),
}));

describe("fetchNewsWithChain", () => {
  beforeEach(() => {
    vi.resetModules();
    adapterState.availableBySource.clear();
    adapterState.itemsBySource.clear();
    adapterState.errorsBySource.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports mock as the serving source when every real source is unavailable", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { fetchNewsWithChain } = await import("@/lib/news/sourceChain");

    try {
      const result = await fetchNewsWithChain({ limit: 2 });

      expect(result.servedBy).toBe("mock");
      expect(result.items).toHaveLength(2);
      expect(result.items.every((item) => item.source === "Claw 42 Mock News")).toBe(true);
      expect(result.fellBackFrom).toEqual([
        "cryptocompare",
        "foresightnews",
        "rss-panews-flash",
        "coingecko",
        "cryptopanic",
        "rss-coindesk",
        "rss-cointelegraph",
        "rss-decrypt",
        "rss-panews-featured",
        "binance-announcements",
      ]);
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('"served_by":"mock"'));
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("includes CryptoPanic in the active fallback chain", async () => {
    adapterState.availableBySource.set("cryptopanic", true);
    adapterState.itemsBySource.set("cryptopanic", [sourceItem("cryptopanic")]);

    const { fetchNewsWithChain } = await import("@/lib/news/sourceChain");
    const result = await fetchNewsWithChain({ limit: 2 });

    expect(result.servedBy).toBe("cryptopanic");
    expect(result.fellBackFrom).toEqual([
      "cryptocompare",
      "foresightnews",
      "rss-panews-flash",
      "coingecko",
    ]);
  });

  it("honors a preferred active fallback source", async () => {
    vi.stubEnv("NEWS_PRIMARY_SOURCE", "cryptopanic");
    adapterState.availableBySource.set("cryptocompare", true);
    adapterState.itemsBySource.set("cryptocompare", [sourceItem("cryptocompare")]);
    adapterState.availableBySource.set("cryptopanic", true);
    adapterState.itemsBySource.set("cryptopanic", [sourceItem("cryptopanic")]);

    const { fetchNewsWithChain } = await import("@/lib/news/sourceChain");
    const result = await fetchNewsWithChain({ limit: 2 });

    expect(result.servedBy).toBe("cryptopanic");
    expect(result.items).toEqual([expect.objectContaining({ source: "cryptopanic" })]);
    expect(result.fellBackFrom).toEqual([]);
  });

  it("falls through to the next real source when the primary adapter fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      adapterState.availableBySource.set("cryptocompare", true);
      adapterState.availableBySource.set("rss-coindesk", true);
      adapterState.errorsBySource.set("cryptocompare", new Error("cryptocompare unavailable"));
      adapterState.itemsBySource.set("rss-coindesk", [sourceItem("rss-coindesk")]);

      const { fetchNewsWithChain } = await import("@/lib/news/sourceChain");
      const result = await fetchNewsWithChain({ limit: 2 });

      expect(result.servedBy).toBe("rss-coindesk");
      expect(result.items).toEqual([expect.objectContaining({ source: "rss-coindesk" })]);
      expect(result.fellBackFrom).toEqual([
        "cryptocompare",
        "foresightnews",
        "rss-panews-flash",
        "coingecko",
        "cryptopanic",
      ]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("can fetch from every configured source without cross-source dedupe", async () => {
    adapterState.availableBySource.set("cryptocompare", true);
    adapterState.availableBySource.set("rss-panews-flash", true);
    adapterState.itemsBySource.set("cryptocompare", [sourceItem("cryptocompare")]);
    adapterState.itemsBySource.set("rss-panews-flash", [sourceItem("rss-panews-flash")]);

    const { fetchNewsFromAllSources } = await import("@/lib/news/sourceChain");
    const result = await fetchNewsFromAllSources({ limitPerSource: 2 });

    expect(result.items).toEqual([
      expect.objectContaining({ sourceId: "cryptocompare" }),
      expect.objectContaining({ sourceId: "rss-panews-flash" }),
    ]);
    expect(result.fellBackFrom).toContain("foresightnews");
  });
});
