import { describe, expect, it } from "vitest";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  resolvePublicTimelineRecordCutoff,
  selectResidentFloorRecordEvents,
  selectSymbolFloorRecordEvents,
} from "@/lib/watch/publicTimelinePayload";

function pmEvent(
  id: string,
  ts: number,
  candidateType: "symbol" | "market_overview" | "hotspot",
  symbol = "BTC",
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
            : symbol,
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

  it("keeps up to three stale-but-real executable symbol records as a public floor", () => {
    const servedAt = Date.UTC(2026, 4, 18, 12, 0, 0);
    const before = servedAt + 1;
    const events = [
      pmEvent("btc-old", servedAt - 34 * 60 * 60_000, "symbol", "BTC"),
      pmEvent("btc-latest", servedAt - 30 * 60 * 60_000, "symbol", "BTC"),
      pmEvent("eth-latest", servedAt - 28 * 60 * 60_000, "symbol", "ETH"),
      pmEvent("sol-latest", servedAt - 26 * 60 * 60_000, "symbol", "SOL"),
      pmEvent("btc-too-old", servedAt - 80 * 60 * 60_000, "symbol", "BTC"),
      {
        ...pmEvent("irys-watch-only", servedAt - 24 * 60 * 60_000, "symbol", "IRYS"),
        payload: {
          ...(pmEvent("irys-watch-only", servedAt - 24 * 60 * 60_000, "symbol", "IRYS")
            .payload as Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>),
          executable: false,
        },
      },
    ];

    expect(
      selectSymbolFloorRecordEvents(events, {
        locale: "zh_CN",
        before,
        servedAt,
      }).map((event) => event.id),
    ).toEqual(["sol-latest", "eth-latest", "btc-latest"]);
  });
});
