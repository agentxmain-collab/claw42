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

  it("does not count resident cards that lack a public information-collection voice", () => {
    const report = buildDecisionOpsResidentPublicVisibility({
      publicEvents: [
        pmEvent({
          recordId: "market-1",
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-19T09",
          symbol: "MARKET",
          ts: now,
          rounds: [
            {
              round: 2,
              memberId: "bullish_researcher",
              rationale: "BTC momentum remains constructive after peer debate",
            },
          ],
        }),
        pmEvent({
          recordId: "hotspot-1",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-19T09:market",
          symbol: "HOTSPOT",
          ts: now - 60_000,
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      allResidentCardsVisible: false,
      counts: {
        marketOverview: 0,
        hotspot: 1,
      },
      missingResidentTypes: ["market_overview"],
    });
  });

  it("does not count resident cards with incomplete public stage trace", () => {
    const report = buildDecisionOpsResidentPublicVisibility({
      publicEvents: [
        pmEvent({
          recordId: "market-partial",
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-19T09",
          symbol: "MARKET",
          ts: now,
          stageTrace: [
            {
              stageId: "analyst_inputs",
              status: "done",
              observedAt: new Date(now - 120_000).toISOString(),
            },
            {
              stageId: "research_lead",
              status: "in_progress",
              observedAt: new Date(now - 60_000).toISOString(),
            },
          ],
        }),
        pmEvent({
          recordId: "hotspot-1",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-19T09:market",
          symbol: "HOTSPOT",
          ts: now - 60_000,
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      allResidentCardsVisible: false,
      counts: {
        marketOverview: 0,
        hotspot: 1,
      },
      missingResidentTypes: ["market_overview"],
    });
  });
});

function pmEvent({
  recordId,
  candidateType,
  candidateKey,
  symbol,
  ts,
  rounds,
  stageTrace,
}: {
  recordId: string;
  candidateType: "market_overview" | "hotspot" | "symbol";
  candidateKey: string;
  symbol: string;
  ts: number;
  rounds?: NonNullable<Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>["rounds"]>;
  stageTrace?: Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>["stageTrace"];
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
      rounds,
      stageTrace: stageTrace ?? [
        {
          stageId: "analyst_inputs",
          status: "done",
          observedAt: new Date(ts - 120_000).toISOString(),
        },
      ],
    },
  };
}
