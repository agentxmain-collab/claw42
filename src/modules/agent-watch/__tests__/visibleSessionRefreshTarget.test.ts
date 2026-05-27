import { describe, expect, test } from "vitest";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { ResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";
import {
  mergeTimelinePayloadForDisplay,
  reconcileTimelineEventsForDisplay,
  retryDelayForVisibleSessionRefresh,
  resolveVisibleSessionRefreshTarget,
  shouldPersistVisibleSessionRefreshResult,
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

  test("does not ask user visits to create global resident cards", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "SYMBOL",
      params: { candidateType: "symbol" },
    });
  });

  test("skips missing hotspot because global prewarm owns resident analysis", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [{ candidateType: "market_overview", symbol: "MARKET" }],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "SYMBOL",
      params: { candidateType: "symbol" },
    });
  });

  test("asks the server to select a priority symbol once resident cards exist", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "market_overview", symbol: "MARKET" },
          { candidateType: "hotspot", symbol: "HOTSPOT" },
        ],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "SYMBOL",
      params: { candidateType: "symbol" },
    });
  });

  test("continues server-selected priority symbol refresh until symbol coverage is filled", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "market_overview", symbol: "MARKET" },
          { candidateType: "hotspot", symbol: "HOTSPOT" },
          { candidateType: "symbol", symbol: "HYPE" },
        ],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "SYMBOL",
      params: { candidateType: "symbol" },
    });
  });

  test("refreshes latest executable symbol after symbol coverage is filled", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "market_overview", symbol: "MARKET" },
          { candidateType: "hotspot", symbol: "HOTSPOT" },
          { candidateType: "symbol", symbol: "BTC" },
          { candidateType: "symbol", symbol: "ETH" },
          { candidateType: "symbol", symbol: "SOL" },
        ],
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "BTC",
      params: { symbol: "BTC" },
    });
  });

  test("fills missing public symbol coverage before repairing resident lanes", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "hotspot", symbol: "HOTSPOT" },
          { candidateType: "symbol", symbol: "HYPE" },
        ],
        residentStatus: residentStatus({
          marketOverviewState: "empty",
          hotspotState: "ready",
        }),
        timelineLoaded: true,
        locale: "zh_CN",
      }),
    ).toMatchObject({
      symbol: "SYMBOL",
      params: { candidateType: "symbol" },
    });
  });

  test("does not repair resident lanes after public symbol coverage is filled", () => {
    expect(
      resolveVisibleSessionRefreshTarget({
        topics: [
          { candidateType: "hotspot", symbol: "HOTSPOT" },
          { candidateType: "symbol", symbol: "BTC" },
          { candidateType: "symbol", symbol: "ETH" },
          { candidateType: "symbol", symbol: "SOL" },
        ],
        residentStatus: residentStatus({
          marketOverviewState: "empty",
          hotspotState: "ready",
        }),
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
      windowMinutes: 24 * 60,
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
    expect(merged.windowMinutes).toBe(24 * 60);
    expect(merged.evidenceMap).toMatchObject({
      ev_primary: { id: "ev_primary" },
      ev_fallback: { id: "ev_fallback" },
    });
  });

  test("keeps the previous non-empty display snapshot when a replace payload is transiently empty", () => {
    const current = [pmEvent("btc", 200), pmEvent("eth", 100)];

    expect(
      reconcileTimelineEventsForDisplay({
        current,
        next: [],
        mode: "replace",
      }),
    ).toBe(current);
    expect(
      reconcileTimelineEventsForDisplay({
        current: [],
        next: [],
        mode: "replace",
      }),
    ).toEqual([]);
  });

  test("keeps existing display cards when a replacement payload is a transient short-window subset", () => {
    const current = [pmEvent("btc", 200), pmEvent("eth", 150), pmEvent("sol", 100)];
    const next = [pmEvent("btc", 300)];

    expect(
      reconcileTimelineEventsForDisplay({
        current,
        next,
        mode: "replace",
      }).map((event) => (event.payload.kind === "pm_decision" ? event.payload.recordId : event.id)),
    ).toEqual(["btc", "eth", "sol"]);
  });

  test("does not persist no-signal visible refresh results as session-complete", () => {
    expect(shouldPersistVisibleSessionRefreshResult("no_signal")).toBe(false);
    expect(retryDelayForVisibleSessionRefresh({ status: "no_signal", nextAllowedAt: null })).toBe(
      5 * 60_000,
    );
    expect(shouldPersistVisibleSessionRefreshResult("stale")).toBe(true);
    expect(shouldPersistVisibleSessionRefreshResult("cached")).toBe(true);
  });

  test("keeps refresh-started stale responses active until completion can be observed", () => {
    expect(
      shouldPersistVisibleSessionRefreshResult({ status: "stale", refreshStarted: true }),
    ).toBe(false);
    expect(
      retryDelayForVisibleSessionRefresh({
        status: "stale",
        refreshStarted: true,
        nextAllowedAt: null,
      }),
    ).toBe(90_000);
  });

  test("uses the server nextAllowedAt when retrying locked visible refreshes", () => {
    const now = Date.UTC(2026, 4, 17, 12, 0, 0);
    expect(
      retryDelayForVisibleSessionRefresh(
        {
          status: "locked",
          nextAllowedAt: new Date(now + 45_000).toISOString(),
        },
        now,
      ),
    ).toBe(46_000);
  });
});

function residentStatus({
  marketOverviewState,
  hotspotState,
}: {
  marketOverviewState: ResidentPrewarmStatus["marketOverview"]["state"];
  hotspotState: ResidentPrewarmStatus["hotspot"]["state"];
}): ResidentPrewarmStatus {
  const servedAt = Date.parse("2026-05-20T12:00:00.000Z");
  return {
    schemaVersion: 1,
    servedAt,
    overallState:
      marketOverviewState === "running" || hotspotState === "running"
        ? "running"
        : marketOverviewState === "queued" || hotspotState === "queued"
          ? "queued"
          : marketOverviewState === "failed" || hotspotState === "failed"
            ? "failed"
            : marketOverviewState === "ready" || hotspotState === "ready"
              ? "ready"
              : "empty",
    slaState: marketOverviewState === "ready" && hotspotState === "ready" ? "healthy" : "critical",
    latestSucceededAt: hotspotState === "ready" ? "2026-05-20T11:00:00.000Z" : null,
    marketOverview: residentLane("market_overview", marketOverviewState),
    hotspot: residentLane("hotspot", hotspotState),
  };
}

function residentLane(
  kind: "market_overview" | "hotspot",
  state: ResidentPrewarmStatus["marketOverview"]["state"],
): ResidentPrewarmStatus["marketOverview"] {
  return {
    kind,
    state,
    slaState: state === "ready" ? "healthy" : "critical",
    stale: state !== "ready",
    ageMs: state === "ready" ? 60 * 60_000 : null,
    expectedIntervalMs: 3 * 60 * 60_000,
    staleAfterMs: 6 * 60 * 60_000,
    lastSucceededAt: state === "ready" ? "2026-05-20T11:00:00.000Z" : null,
    lastAttemptAt: null,
    nextRunAt: null,
    lastError: null,
    jobId: null,
    candidateKey: null,
  };
}
