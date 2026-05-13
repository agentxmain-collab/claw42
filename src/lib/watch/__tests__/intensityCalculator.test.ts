import { describe, expect, it } from "vitest";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { calculateTopicIntensity } from "@/lib/watch/intensityCalculator";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

function event(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "event-1",
    ts: Date.now(),
    visibility: "public",
    importance: "medium",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "record-1",
      symbol: "BTC",
      tradeDecision: null,
      rationaleByMember: {},
    },
    ...overrides,
  };
}

const evidence: NewsEvidence = {
  id: "ev_1",
  source: "CoinDesk",
  title: "BTC ETF inflow",
  url: "https://example.com",
  publishedAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  symbol: ["BTC"],
  impactSeverity: "high",
  summary: "BTC ETF inflow",
};

describe("calculateTopicIntensity", () => {
  it("starts from public timeline importance", () => {
    expect(calculateTopicIntensity({ event: event({ importance: "low" }) })).toBe(1);
    expect(calculateTopicIntensity({ event: event({ importance: "critical" }) })).toBe(4);
  });

  it("uses NewsEvidence.impactSeverity from top-level evidenceIds", () => {
    expect(
      calculateTopicIntensity({
        event: event({ importance: "low", evidenceIds: ["ev_1"] }),
        evidenceMap: { ev_1: evidence },
      }),
    ).toBe(3);
  });

  it("amplifies low confidence and multiple evidence sources", () => {
    expect(
      calculateTopicIntensity({
        event: event({ evidenceIds: ["ev_1", "ev_2", "ev_3"] }),
        confidence: 0.42,
      }),
    ).toBe(4);
  });

  it("ignores missing evidence records safely", () => {
    expect(calculateTopicIntensity({ event: event({ evidenceIds: ["missing"] }) })).toBe(2);
  });
});
