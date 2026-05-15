import { describe, expect, it } from "vitest";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { calculateTopicRankingScore, formatTopicRanking } from "@/lib/watch/topicRanking";
import type { PmDecisionTimelineEvent } from "@/lib/watch/topicAggregator";

const now = Date.UTC(2026, 4, 15, 10, 0, 0);

function pmDecision(overrides: Partial<PmDecisionTimelineEvent> = {}): PmDecisionTimelineEvent {
  return {
    id: "event-1",
    ts: now,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: ["ev_1", "ev_2", "ev_3"],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "record-1",
      symbol: "BTC",
      tradeDecision: null,
      rationaleByMember: {},
      rounds: [
        { round: 1, memberId: "chart_analyst", direction: "long", confidence: 0.6, rationale: "a" },
        { round: 2, memberId: "chart_analyst", direction: "long", confidence: 0.8, rationale: "b" },
        { round: 2, memberId: "news_analyst", direction: "long", confidence: 0.7, rationale: "c" },
        {
          round: 2,
          memberId: "risk_lead",
          direction: "neutral",
          confidence: 0.5,
          rationale: "d",
        },
      ],
    },
    ...overrides,
  };
}

function newsEvidence(id: string, impactSeverity: NewsEvidence["impactSeverity"]): NewsEvidence {
  return {
    id,
    source: "CoinW",
    title: `${id} market context`,
    url: `https://example.com/${id}`,
    publishedAt: new Date(now - 60_000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    symbol: ["BTC"],
    impactSeverity,
    summary: `${id} summary`,
  };
}

describe("topic ranking v2", () => {
  it("combines severity, confidence, consensus, and news count into a 0-100 score", () => {
    const event = pmDecision();
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision");

    const ranking = calculateTopicRankingScore({
      event,
      evidenceMap: {
        ev_1: newsEvidence("ev_1", "high"),
        ev_2: newsEvidence("ev_2", "medium"),
        ev_3: newsEvidence("ev_3", "low"),
      },
    });

    expect(ranking.score).toBeGreaterThan(80);
    expect(ranking.intensity).toBe(5);
    expect(ranking.newsCount).toBe(3);
    expect(ranking.confidencePercent).toBe(67);
  });

  it("formats the rank explanation from a typed template", () => {
    const event = pmDecision({ evidenceIds: ["ev_1"] });
    if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision");
    const ranking = calculateTopicRankingScore({ event, confidence: 0.73 });

    expect(
      formatTopicRanking({
        symbol: "BTC",
        rank: 2,
        ranking,
        dict: {
          explanation_template: "{symbol} 因 {news_count} 条新闻 + {confidence}% 置信度排第 {rank}",
          rank_label: "排序 #{rank}",
        },
      }),
    ).toMatchObject({
      rank: 2,
      rankLabel: "排序 #2",
      explanation: "BTC 因 1 条新闻 + 73% 置信度排第 2",
    });
  });
});
