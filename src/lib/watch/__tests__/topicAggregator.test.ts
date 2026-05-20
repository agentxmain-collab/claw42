import { describe, expect, it } from "vitest";
import {
  groupPublicTimelineEventsByTopic,
  TOPIC_AGGREGATION_WINDOW_MS,
} from "@/lib/watch/topicAggregator";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.UTC(2026, 4, 13, 8, 0, 0);

function pmDecision(
  id: string,
  overrides: Partial<PublicTimelineEvent> & { symbol?: string } = {},
): PublicTimelineEvent {
  const { symbol: overrideSymbol, ...eventOverrides } = overrides;
  const symbol = overrideSymbol ?? "BTC";
  return {
    id,
    ts: now,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: id,
      symbol,
      tradeDecision: null,
      rationaleByMember: {},
    },
    ...eventOverrides,
  };
}

describe("groupPublicTimelineEventsByTopic", () => {
  it("groups same-locale same-symbol PM decisions inside the 30 minute window", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("older", { ts: now - 10 * 60 * 1000, evidenceIds: ["ev_1"] }),
      pmDecision("latest", { ts: now, evidenceIds: ["ev_2"] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].latestDecision.payload.recordId).toBe("latest");
    expect(groups[0].decisionsInWindow.map((event) => event.payload.recordId)).toEqual([
      "latest",
      "older",
    ]);
    expect(groups[0].evidenceIds).toEqual(["ev_2", "ev_1"]);
  });

  it("does not merge the same symbol across locales", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("zh", { locale: "zh_CN" }),
      pmDecision("en", { locale: "en_US" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((group) => group.locale))).toEqual(new Set(["zh_CN", "en_US"]));
  });

  it("keeps only the latest same-symbol public topic outside the 30 minute window", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("old", { ts: now - TOPIC_AGGREGATION_WINDOW_MS - 1 }),
      pmDecision("new", { ts: now }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].latestDecision.payload.recordId).toBe("new");
    expect(groups[0].decisionsInWindow.map((event) => event.payload.recordId)).toEqual(["new"]);
  });

  it("uses record id as a stable tie-breaker for equal timestamps", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("pm:ETH:beta", { symbol: "ETH", ts: now }),
      pmDecision("pm:BTC:alpha", { symbol: "BTC", ts: now }),
    ]);

    expect(groups.map((group) => group.latestDecision.payload.recordId)).toEqual([
      "pm:BTC:alpha",
      "pm:ETH:beta",
    ]);
  });

  it("groups non-symbol candidate records by candidate key instead of dropping them", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("market-overview", {
        symbol: "MARKET",
        payload: {
          kind: "pm_decision",
          recordId: "market-overview",
          symbol: "MARKET",
          candidateType: "market_overview",
          candidateKey: "market_overview:daily:zh_CN:2026-05-13",
          displayTitle: "今日大盘综述",
          executable: false,
          tradeDecision: null,
          rationaleByMember: {},
        },
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-13",
      displayTitle: "今日大盘综述",
      symbol: "MARKET",
    });
  });

  it("keeps one market overview topic across candidate windows", () => {
    const stale = pmDecision("market-morning", {
      ts: Date.parse("2026-05-17T23:48:00.000Z"),
      symbol: "MARKET",
      payload: {
        kind: "pm_decision",
        recordId: "market-morning",
        symbol: "MARKET",
        candidateType: "market_overview",
        candidateKey: "market_overview:zh_CN:2026-05-17",
        displayTitle: "今日大盘综述",
        executable: false,
        tradeDecision: null,
        rationaleByMember: {},
      },
    });
    const latest = pmDecision("market-afternoon", {
      ts: Date.parse("2026-05-18T05:18:00.000Z"),
      symbol: "MARKET",
      payload: {
        kind: "pm_decision",
        recordId: "market-afternoon",
        symbol: "MARKET",
        candidateType: "market_overview",
        candidateKey: "market_overview:zh_CN:2026-05-18",
        displayTitle: "今日大盘综述",
        executable: false,
        tradeDecision: null,
        rationaleByMember: {},
      },
    });

    const groups = groupPublicTimelineEventsByTopic([stale, latest]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      latestDecision: expect.objectContaining({
        payload: expect.objectContaining({ recordId: "market-afternoon" }),
      }),
      candidateType: "market_overview",
      candidateKey: "market_overview:zh_CN:2026-05-18",
      displayTitle: "今日大盘综述",
    });
  });

  it("keeps one hotspot topic across candidate windows", () => {
    const stale = pmDecision("hotspot-older", {
      ts: Date.parse("2026-05-20T04:47:00.000Z"),
      symbol: "HOTSPOT",
      payload: {
        kind: "pm_decision",
        recordId: "hotspot-older",
        symbol: "HOTSPOT",
        candidateType: "hotspot",
        candidateKey: "hotspot:utc:zh_CN:2026-05-20T03:market",
        displayTitle: "热点叙事追踪",
        executable: false,
        tradeDecision: null,
        rationaleByMember: {},
      },
    });
    const latest = pmDecision("hotspot-latest", {
      ts: Date.parse("2026-05-20T10:12:00.000Z"),
      symbol: "HOTSPOT",
      payload: {
        kind: "pm_decision",
        recordId: "hotspot-latest",
        symbol: "HOTSPOT",
        candidateType: "hotspot",
        candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
        displayTitle: "热点叙事追踪",
        executable: false,
        tradeDecision: null,
        rationaleByMember: {},
      },
    });

    const groups = groupPublicTimelineEventsByTopic([stale, latest]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      latestDecision: expect.objectContaining({
        payload: expect.objectContaining({ recordId: "hotspot-latest" }),
      }),
      candidateType: "hotspot",
      candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
      displayTitle: "热点叙事追踪",
    });
  });

  it("skips events without a usable symbol", () => {
    expect(
      groupPublicTimelineEventsByTopic([pmDecision("missing", { symbol: "UNKNOWN" })]),
    ).toEqual([]);
  });

  it("normalizes lowercase and dollar-prefixed PM symbols before grouping", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("dollar-symbol", { symbol: "$$btc" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "zh_CN:BTC:dollar-symbol",
      symbol: "BTC",
    });
  });

  it("skips malformed PM events with non-string symbols", () => {
    const malformed = pmDecision("malformed");
    if (malformed.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");

    expect(
      groupPublicTimelineEventsByTopic([
        {
          ...malformed,
          payload: {
            ...malformed.payload,
            symbol: null,
          } as unknown as PublicTimelineEvent["payload"],
        },
      ]),
    ).toEqual([]);
  });
});
