import type { PublicTimelineEvent, PublicTradeDecision } from "@/lib/watch/publicTimelineEvent";
import { describe, expect, test } from "vitest";
import { buildHeroAnalysisBriefFromEvents } from "./heroAnalysisBrief";

const completeSummary = "BTC 成交与新闻共振，短线偏多；若跌回前低，Agent 会撤销这次观察。";

const publicDecisionEvent: PublicTimelineEvent = {
  id: "pm-decision:btc-brief",
  ts: Date.parse("2026-05-30T12:00:00.000Z"),
  visibility: "public",
  importance: "high",
  sourceTrigger: "pm_decision",
  evidenceIds: ["news-btc-1"],
  locale: "zh_CN",
  payload: {
    kind: "pm_decision",
    recordId: "decision-btc-brief",
    symbol: "BTC",
    candidateType: "symbol",
    analysisSummary: completeSummary,
    tradeDecision: {
      direction: "long",
      confidence: 0.72,
      positionSizing: 0.1,
    } as PublicTradeDecision,
  },
};

describe("hero analysis brief", () => {
  test("uses the public watch timeline analysisSummary as the hover summary without truncation", () => {
    const brief = buildHeroAnalysisBriefFromEvents({
      events: [publicDecisionEvent],
      evidenceMap: {},
      locale: "zh_CN",
    });

    expect(brief?.source).toBe("watch-timeline-analysis-summary");
    expect(brief?.recordId).toBe("decision-btc-brief");
    expect(brief?.line).toContain("$BTC");
    expect(brief?.line).toContain("LONG 10%");
    expect(brief?.line).toContain(completeSummary);
    expect(brief?.line).not.toMatch(/\.{3}|…/);
  });

  test("falls back to the same public event context when a compact analysis summary is missing", () => {
    const brief = buildHeroAnalysisBriefFromEvents({
      events: [
        {
          ...publicDecisionEvent,
          payload: {
            kind: "pm_decision",
            recordId: "decision-eth-round",
            symbol: "ETH",
            rounds: [
              {
                round: 1,
                rationale: "ETH 波动放大，风险团队建议先收紧仓位。",
                oneLineSummary: "ETH 波动放大，先收紧仓位。",
              },
            ],
          },
        },
      ],
      evidenceMap: {},
      locale: "zh_CN",
    });

    expect(brief?.source).toBe("watch-timeline-analysis-summary");
    expect(brief?.line).toContain("$ETH");
    expect(brief?.line).toContain("ETH 波动放大，先收紧仓位。");
  });
});
