import { describe, expect, it } from "vitest";
import { buildDecisionOpsResidentPublicVisibility } from "@/lib/team/decisionOpsResidentPublicVisibility";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("buildDecisionOpsResidentPublicVisibility", () => {
  it("is ready only when market overview and hotspot are both visible in public PM events", () => {
    const report = buildDecisionOpsResidentPublicVisibility({
      publicEvents: [
        pmEvent({
          recordId: "market-1",
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-19T09",
          symbol: "MARKET",
          ts: now,
        }),
        pmEvent({
          recordId: "hotspot-1",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-19T09:market",
          symbol: "HOTSPOT",
          ts: now - 60_000,
        }),
        pmEvent({
          recordId: "hype-1",
          candidateType: "symbol",
          candidateKey: "HYPE",
          symbol: "HYPE",
          ts: now - 120_000,
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      allResidentCardsVisible: true,
      counts: {
        marketOverview: 1,
        hotspot: 1,
        symbol: 1,
      },
      missingResidentTypes: [],
      blockingReasons: [],
    });
  });

  it("blocks runtime stability when market overview is absent from the public card set", () => {
    const report = buildDecisionOpsResidentPublicVisibility({
      publicEvents: [
        pmEvent({
          recordId: "hotspot-1",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-19T09:market",
          symbol: "HOTSPOT",
          ts: now,
        }),
        pmEvent({
          recordId: "hype-1",
          candidateType: "symbol",
          candidateKey: "HYPE",
          symbol: "HYPE",
          ts: now - 60_000,
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      allResidentCardsVisible: false,
      missingResidentTypes: ["market_overview"],
      blockingReasons: ["resident_market_overview_not_visible"],
    });
  });
});

function pmEvent({
  recordId,
  candidateType,
  candidateKey,
  symbol,
  ts,
}: {
  recordId: string;
  candidateType: "market_overview" | "hotspot" | "symbol";
  candidateKey: string;
  symbol: string;
  ts: number;
}): PublicTimelineEvent {
  return {
    id: `pm-decision:${recordId}`,
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
      candidateType,
      candidateKey,
      displayTitle: `${symbol} analysis`,
      executable: candidateType === "symbol",
      tradeDecision: null,
      stageTrace: [
        {
          stageId: "analyst_inputs",
          status: "done",
          observedAt: new Date(ts - 120_000).toISOString(),
        },
      ],
    },
  };
}
