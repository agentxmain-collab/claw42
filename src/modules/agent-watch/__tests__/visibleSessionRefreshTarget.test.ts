import { describe, expect, test } from "vitest";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  mergeTimelinePayloadForDisplay,
  resolveVisibleSessionRefreshTarget,
} from "../AgentWatchBoard";

function pmEvent(recordId: string, ts: number): PublicTimelineEvent {
  return {
    id: `event-${recordId}`,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    locale: "zh_CN",
    evidenceIds: [],
    payload: {
      kind: "pm_decision",
      recordId,
      symbol: recordId.toUpperCase(),
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

function evidence(id: string): NewsEvidence {
  return {
    id,
    source: "Test",
    title: id,
    url: "https://example.com",
    publishedAt: new Date(200).toISOString(),
    fetchedAt: new Date(300).toISOString(),
    symbol: ["BTC"],
    impactSeverity: "medium",
    summary: id,
  };
}

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

  test("merges primary and fallback timeline windows before replacing display events", () => {
    const primary = {
      events: [pmEvent("btc", 200)],
      evidenceMap: { ev_primary: evidence("ev_primary") },
      oldestTs: 200,
      hasMore: false,
      windowMinutes: 60,
      servedAt: 300,
      nextPollMs: 90_000,
    };
    const fallback = {
      events: [pmEvent("eth", 100), pmEvent("btc", 200)],
      evidenceMap: { ev_fallback: evidence("ev_fallback") },
      oldestTs: 100,
      hasMore: true,
      windowMinutes: 720,
      servedAt: 300,
      nextPollMs: 30_000,
    };

    const merged = mergeTimelinePayloadForDisplay(primary, fallback);

    expect(
      merged.events.map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["btc", "eth"]);
    expect(merged.oldestTs).toBe(100);
    expect(merged.hasMore).toBe(true);
    expect(merged.windowMinutes).toBe(720);
    expect(merged.evidenceMap).toMatchObject({
      ev_primary: { id: "ev_primary" },
      ev_fallback: { id: "ev_fallback" },
    });
  });
});
