import { describe, expect, it } from "vitest";
import { buildDecisionOpsPublicOutputStability } from "@/lib/team/decisionOpsPublicOutputStability";
import type {
  PublicDecisionStageTraceEntry,
  PublicTimelineEvent,
} from "@/lib/watch/publicTimelineEvent";
import type { CandidateType } from "@/lib/watch/decisionCandidate";

const now = Date.parse("2026-05-19T03:00:00.000Z");
const observedAt = "2026-05-19T02:59:00.000Z";

function stage(
  stageId: PublicDecisionStageTraceEntry["stageId"],
  status: PublicDecisionStageTraceEntry["status"],
): PublicDecisionStageTraceEntry {
  return { stageId, status, observedAt };
}

function completeTrace(): PublicDecisionStageTraceEntry[] {
  return [
    stage("analyst_inputs", "done"),
    stage("research_lead", "done"),
    stage("trade_decision", "done"),
    stage("risk_lead", "done"),
    stage("record_write", "done"),
    stage("public_timeline", "done"),
  ];
}

function pmEvent({
  id,
  recordId = id,
  candidateType = "symbol",
  candidateKey = id,
  symbol = "BTC",
  ts,
  stageTrace = completeTrace(),
}: {
  id: string;
  recordId?: string;
  candidateType?: CandidateType;
  candidateKey?: string;
  symbol?: string;
  ts: number;
  stageTrace?: PublicDecisionStageTraceEntry[];
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
      stageTrace,
    },
  };
}

describe("buildDecisionOpsPublicOutputStability", () => {
  it("stays healthy when visible cards are unique, ordered, and stage-complete", () => {
    const events = [
      pmEvent({
        id: "market",
        candidateType: "market_overview",
        candidateKey: "market_overview:daily:zh_CN:2026-05-19",
        symbol: "MARKET",
        ts: now,
      }),
      pmEvent({
        id: "hotspot",
        candidateType: "hotspot",
        candidateKey: "hotspot:stablecoin-flow:2026-05-19",
        symbol: "USDT",
        ts: now - 60_000,
      }),
      pmEvent({
        id: "symbol-btc",
        candidateType: "symbol",
        candidateKey: "BTC",
        symbol: "BTC",
        ts: now - 120_000,
      }),
    ];

    const report = buildDecisionOpsPublicOutputStability({ publicEvents: events, now });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      counts: {
        publicPmEvents: 3,
        uniqueCandidateCards: 3,
        duplicateCandidateCards: 0,
        stageProgressGaps: 0,
      },
      byCandidateType: {
        market_overview: 1,
        hotspot: 1,
        symbol: 1,
      },
      byPublicStatus: {
        done: 3,
        active: 0,
        pending: 0,
      },
      order: {
        stable: true,
      },
      actions: [],
    });
  });

  it("flags duplicate candidate cards before they can reach the UI", () => {
    const duplicateA = pmEvent({
      id: "market-a",
      recordId: "pm:MARKET:1",
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-19",
      symbol: "MARKET",
      ts: now,
    });
    const duplicateB = pmEvent({
      id: "market-b",
      recordId: "pm:MARKET:2",
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-19",
      symbol: "MARKET",
      ts: now - 60_000,
    });

    const report = buildDecisionOpsPublicOutputStability({
      publicEvents: [duplicateA, duplicateB],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("duplicate_candidate_card");
    expect(report.duplicateCandidateKeys).toEqual(["zh_CN:market_overview"]);
    expect(report.actions).toEqual([
      expect.objectContaining({
        title: "Inspect candidate dedupe and hydration",
        executable: false,
      }),
    ]);
  });

  it("flags duplicate hotspot cards by public lane instead of time-window key", () => {
    const report = buildDecisionOpsPublicOutputStability({
      publicEvents: [
        pmEvent({
          id: "hotspot-a",
          recordId: "pm:HOTSPOT:1",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T03:market",
          symbol: "HOTSPOT",
          ts: now,
        }),
        pmEvent({
          id: "hotspot-b",
          recordId: "pm:HOTSPOT:2",
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
          symbol: "HOTSPOT",
          ts: now - 60_000,
        }),
      ],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("duplicate_candidate_card");
    expect(report.duplicateCandidateKeys).toEqual(["zh_CN:hotspot"]);
  });

  it("flags public event order that does not match the canonical comparator", () => {
    const symbol = pmEvent({
      id: "symbol-btc",
      candidateType: "symbol",
      candidateKey: "BTC",
      symbol: "BTC",
      ts: now,
    });
    const market = pmEvent({
      id: "market",
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-19",
      symbol: "MARKET",
      ts: now - 60_000,
    });

    const report = buildDecisionOpsPublicOutputStability({
      publicEvents: [symbol, market],
      now,
    });

    expect(report.status).toBe("degraded");
    expect(report.primaryIssue).toBe("unstable_order");
    expect(report.order.stable).toBe(false);
    expect(report.order.eventIds[0]).toContain("symbol-btc");
    expect(report.order.expectedEventIds[0]).toContain("market");
  });

  it("flags skipped public stages when a later stage advanced first", () => {
    const report = buildDecisionOpsPublicOutputStability({
      publicEvents: [
        pmEvent({
          id: "stage-gap",
          ts: now,
          stageTrace: [
            stage("analyst_inputs", "pending"),
            stage("research_lead", "done"),
            stage("trade_decision", "pending"),
          ],
        }),
        pmEvent({
          id: "market",
          candidateType: "market_overview",
          candidateKey: "market_overview:daily:zh_CN:2026-05-19",
          symbol: "MARKET",
          ts: now - 60_000,
        }),
      ],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("stage_progress_gap");
    expect(report.counts.stageProgressGaps).toBe(1);
  });

  it("treats empty or single-card output as an explicit stability risk", () => {
    const empty = buildDecisionOpsPublicOutputStability({ publicEvents: [], now });
    const single = buildDecisionOpsPublicOutputStability({
      publicEvents: [pmEvent({ id: "single", ts: now })],
      now,
    });

    expect(empty).toMatchObject({
      status: "critical",
      primaryIssue: "empty_public_output",
      counts: { publicPmEvents: 0 },
    });
    expect(single).toMatchObject({
      status: "degraded",
      primaryIssue: "minimum_visible_cards_gap",
      counts: { publicPmEvents: 1 },
    });
  });
});
