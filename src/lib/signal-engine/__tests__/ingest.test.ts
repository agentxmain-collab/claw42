import { describe, expect, test } from "vitest";
import { ingestCandidates, severityToImpact } from "@/lib/signal-engine/ingest";
import { makeNewsItem } from "@/lib/signal-engine/__tests__/test-helpers";

describe("signal ingest", () => {
  test("ingests news into raw candidates with market evidence when price moves", () => {
    const [candidate] = ingestCandidates({
      newsItems: [makeNewsItem()],
      priceSnapshots: [{ symbol: "BTC", price: 70000, change24h: 5.2, volumeChange24h: 40, source: "test-market", updatedAt: "2026-04-19T08:31:00.000Z" }],
      calendarItems: []
    });

    expect(candidate.id).toBe("sig-btc-etf-flow");
    expect(candidate.primaryAsset).toBe("BTC");
    expect(candidate.evidence.map((piece) => piece.kind)).toContain("market");
  });

  test("falls back to inferred MARKET candidate when impacted assets are absent", () => {
    const [candidate] = ingestCandidates({
      newsItems: [makeNewsItem({ impactedAssets: [], title: { zh: "宏观风险事件", en: "Macro risk event" } })],
      priceSnapshots: [],
      calendarItems: []
    });

    expect(candidate.primaryAsset).toBe("MARKET");
    expect(candidate.tracks).toContain("btc_eth");
    expect(candidate.tradingPairs).toEqual([]);
  });

  test("ignores non-high calendar items and maps high calendar items into candidates", () => {
    const candidates = ingestCandidates({
      newsItems: [],
      priceSnapshots: [],
      calendarItems: [
        { id: "low", range: "today", name: { zh: "低影响", en: "Low impact" }, datetime: "2026-04-19T08:00:00.000Z", forecast: "1", actual: "--", impact: "low" },
        { id: "cpi", range: "today", name: { zh: "CPI", en: "CPI" }, datetime: "2026-04-19T09:00:00.000Z", forecast: "2.9%", actual: "--", impact: "high" }
      ]
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("sig-macro-cpi");
    expect(candidates[0].eventType).toBe("macro");
  });

  test("maps severity into impact levels for downstream scoring", () => {
    expect(severityToImpact("high")).toBe("high");
    expect(severityToImpact("medium")).toBe("medium");
    expect(severityToImpact("low")).toBe("low");
  });
});
