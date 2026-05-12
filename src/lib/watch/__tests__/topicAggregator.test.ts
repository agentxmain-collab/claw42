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
  const symbol = overrides.symbol ?? "BTC";
  const { symbol: _symbol, ...eventOverrides } = overrides;
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

  it("starts a new group outside the 30 minute window", () => {
    const groups = groupPublicTimelineEventsByTopic([
      pmDecision("old", { ts: now - TOPIC_AGGREGATION_WINDOW_MS - 1 }),
      pmDecision("new", { ts: now }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.latestDecision.payload.recordId)).toEqual(["new", "old"]);
  });

  it("skips events without a usable symbol", () => {
    expect(
      groupPublicTimelineEventsByTopic([pmDecision("missing", { symbol: "UNKNOWN" })]),
    ).toEqual([]);
  });
});
