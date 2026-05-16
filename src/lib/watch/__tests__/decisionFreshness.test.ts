import { describe, expect, it } from "vitest";
import { deriveDecisionFreshness } from "@/lib/watch/decisionFreshness";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.UTC(2026, 4, 15, 12, 0, 0);

function record(createdAt: number, symbol = "BTC"): StrategyDecisionRecord {
  return {
    id: `record-${symbol}`,
    schemaVersion: 2,
    recordSource: "paper",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(createdAt).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "test",
  };
}

function event(ts: number, symbol = "BTC"): PublicTimelineEvent {
  return {
    id: `event-${symbol}`,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: `record-${symbol}`,
      symbol,
      rationaleByMember: {},
    },
  };
}

describe("deriveDecisionFreshness", () => {
  it("uses strategy records as a fresh source inside the 15 minute window", () => {
    const snapshot = deriveDecisionFreshness({
      symbol: "BTC_USDT",
      records: [record(now - 5 * 60_000)],
      now,
    });

    expect(snapshot).toMatchObject({
      symbol: "BTC",
      refreshSource: "records",
      isFresh: true,
      lastDecisionAt: new Date(now - 5 * 60_000).toISOString(),
    });
  });

  it("falls back to timeline projection events when records are older", () => {
    const snapshot = deriveDecisionFreshness({
      symbol: "$BTC",
      records: [record(now - 60 * 60_000)],
      timelineEvents: [event(now - 20 * 60_000)],
      now,
    });

    expect(snapshot).toMatchObject({
      refreshSource: "timeline",
      isFresh: false,
      lastDecisionAt: new Date(now - 20 * 60_000).toISOString(),
    });
  });
});
