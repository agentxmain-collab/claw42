import { describe, expect, it } from "vitest";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { mergePublicTimelineEvents } from "@/lib/watch/publicTimelineOrdering";

const now = Date.UTC(2026, 4, 16, 9, 0, 0);

function pmDecision({
  recordId,
  symbol,
  ts = now,
  id = `pm-decision:${recordId}`,
}: {
  recordId: string;
  symbol: string;
  ts?: number;
  id?: string;
}): PublicTimelineEvent {
  return {
    id,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId,
      symbol,
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

function newsEvent(id: string, ts = now): PublicTimelineEvent {
  return {
    id,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "news",
    evidenceIds: [id],
    locale: "zh_CN",
    payload: {
      kind: "news",
      evidenceId: id,
      symbols: ["BTC"],
    },
  };
}

describe("mergePublicTimelineEvents", () => {
  it("handles empty and single event inputs", () => {
    expect(mergePublicTimelineEvents([])).toEqual([]);
    const [single] = mergePublicTimelineEvents([
      pmDecision({ recordId: "pm:BILL:latest", symbol: "BILL" }),
    ]);

    expect(single?.payload.kind).toBe("pm_decision");
    expect(single?.payload.kind === "pm_decision" ? single.payload.recordId : null).toBe(
      "pm:BILL:latest",
    );
  });

  it("dedupes duplicate event ids while keeping deterministic order", () => {
    const first = newsEvent("news-1", now);
    const duplicate = newsEvent("news-1", now - 1);

    expect(mergePublicTimelineEvents([duplicate, first]).map((event) => event.id)).toEqual([
      "news-1",
    ]);
  });

  it("keeps only the latest public PM decision per locale and symbol", () => {
    const latest = pmDecision({
      recordId: "pm:BILL:1778923198583",
      symbol: "BILL",
      ts: now,
    });
    const stale = pmDecision({
      recordId: "pm:BILL:1778902920550",
      symbol: "BILL",
      ts: now - 6 * 60 * 60 * 1000,
    });
    const hype = pmDecision({
      recordId: "pm:HYPE:1778908242659",
      symbol: "HYPE",
      ts: now - 2 * 60 * 60 * 1000,
    });

    expect(
      mergePublicTimelineEvents([stale, hype, latest]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:BILL:1778923198583", "pm:HYPE:1778908242659"]);
  });

  it("uses record id as a stable tie-breaker for same-timestamp PM decisions", () => {
    const beta = pmDecision({ recordId: "pm:ETH:beta", symbol: "ETH", ts: now });
    const alpha = pmDecision({ recordId: "pm:BTC:alpha", symbol: "BTC", ts: now });

    expect(
      mergePublicTimelineEvents([beta, alpha]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:BTC:alpha", "pm:ETH:beta"]);
  });
});
