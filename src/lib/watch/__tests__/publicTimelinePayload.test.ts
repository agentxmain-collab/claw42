import { describe, expect, it } from "vitest";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  resolvePublicTimelineRecordCutoff,
  selectResidentFloorRecordEvents,
} from "@/lib/watch/publicTimelinePayload";

function pmEvent(
  id: string,
  ts: number,
  candidateType: "symbol" | "market_overview" | "hotspot",
): PublicTimelineEvent {
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
      recordId: `record-${id}`,
      symbol:
        candidateType === "market_overview"
          ? "MARKET"
          : candidateType === "hotspot"
            ? "HOTSPOT"
            : "BTC",
      candidateType,
      candidateKey: `${candidateType}:zh_CN:${id}`,
      displayTitle: id,
      executable: candidateType === "symbol",
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

describe("publicTimelinePayload", () => {
  it("keeps the public record backfill window at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 24 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });

  it("caps oversized public record backfill windows at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 48 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });

  it("keeps one stale-but-real resident market and hotspot record as a public floor", () => {
    const servedAt = Date.UTC(2026, 4, 18, 12, 0, 0);
    const before = servedAt + 1;
    const events = [
      pmEvent("market-old", servedAt - 34 * 60 * 60_000, "market_overview"),
      pmEvent("market-latest", servedAt - 30 * 60 * 60_000, "market_overview"),
      pmEvent("hotspot-latest", servedAt - 26 * 60 * 60_000, "hotspot"),
      pmEvent("symbol-old", servedAt - 30 * 60 * 60_000, "symbol"),
      pmEvent("market-too-old", servedAt - 80 * 60 * 60_000, "market_overview"),
    ];

    expect(
      selectResidentFloorRecordEvents(events, {
        locale: "zh_CN",
        before,
        servedAt,
      }).map((event) => event.id),
    ).toEqual(["market-latest", "hotspot-latest"]);
  });
});
