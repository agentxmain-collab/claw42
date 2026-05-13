import { describe, expect, it } from "vitest";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { mapPublicTimelineEventsToTopics } from "@/lib/watch/v9TopicAdapter";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.UTC(2026, 4, 13, 8, 0, 0);

const tradeDecision: TradeDecision = {
  id: "trade-1",
  schemaVersion: 1,
  symbol: "BTC",
  generatedBy: "pm",
  generatedAt: new Date(now).toISOString(),
  direction: "short",
  entryType: "limit",
  entryPrice: 80500,
  entryRange: { low: 80300, high: 80700 },
  stopLoss: 81200,
  takeProfit: [79000, 78000],
  positionSizing: 0.06,
  timeHorizon: "intraday",
  rating: 4,
  confidence: 0.78,
  evidenceIds: ["ev_1"],
  riskNote: "Risk budget remains inside the limit.",
  invalidatesIf: "BTC reclaims 81200",
  promptVersion: "test",
  modelProvider: "stub",
  severity: "high",
};

const evidence: NewsEvidence = {
  id: "ev_1",
  source: "CoinDesk",
  title: "BTC ETF outflows rise",
  url: "https://example.com/btc",
  publishedAt: new Date(now - 60_000).toISOString(),
  fetchedAt: new Date(now).toISOString(),
  symbol: ["BTC"],
  impactSeverity: "high",
  summary: "ETF outflows rise and support is under pressure",
};

function pmDecision(overrides: Partial<PublicTimelineEvent> = {}): PublicTimelineEvent {
  return {
    id: "event-1",
    ts: now,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: ["ev_1"],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "record-1",
      symbol: "BTC",
      tradeDecision,
      rationaleByMember: {
        chart_analyst: "BTC is testing support.",
        onchain_analyst: "Exchange inflow increased.",
        research_lead: "Short thesis is stronger.",
        risk_lead: "Keep sizing conservative.",
      },
      citationsByMember: {
        chart_analyst: ["ev_1"],
      },
    },
    ...overrides,
  };
}

function pmDecisionWithRecordId(recordId: string, overrides: Partial<PublicTimelineEvent> = {}) {
  const event = pmDecision(overrides);
  if (event.payload.kind !== "pm_decision") throw new Error("expected pm decision fixture");
  return {
    ...event,
    payload: {
      ...event.payload,
      recordId,
    },
  };
}

describe("mapPublicTimelineEventsToTopics", () => {
  it("adapts a real pm_decision event into a v9 dispatch topic", () => {
    const [topic] = mapPublicTimelineEventsToTopics({
      events: [pmDecision()],
      evidenceMap: { ev_1: evidence },
      followStatsByRecordId: {
        "record-1": { watchCount: 12, followCount: 3, userFollowed: false },
      },
      locale: "zh_CN",
      now,
    });

    expect(topic).toMatchObject({
      id: "record-1",
      symbol: "BTC",
      status: "done",
      originalUrl: "https://example.com/btc",
      intensity: 3,
      strategy: {
        action: "short",
        actionLabel: "SHORT 6%",
        entry: "80,300 - 80,700",
        stopLoss: "81,200",
        takeProfit: "79,000 / 78,000",
        follow: { watchCount: 12, followCount: 3 },
      },
    });
    expect(topic.stages).toHaveLength(6);
    expect(topic.stages[5]).toMatchObject({
      label: "阶段 6 · 复盘沉淀",
      status: "pending",
      note: "TODO：真实 memory_loop 尚未接入，等待写入",
    });
    expect(topic.messages.map((message) => message.agentId)).toContain("technical_analyst");
    expect(topic.messages.map((message) => message.agentId)).toContain("portfolio_manager");
    expect("source" in topic).toBe(false);
  });

  it("ignores non pm_decision events", () => {
    expect(
      mapPublicTimelineEventsToTopics({
        events: [
          { ...pmDecision(), payload: { kind: "news", evidenceId: "ev_1", symbols: ["BTC"] } },
        ],
        locale: "zh_CN",
        now,
      }),
    ).toEqual([]);
  });

  it("uses the latest decision when multiple decisions aggregate into one topic", () => {
    const topics = mapPublicTimelineEventsToTopics({
      events: [
        pmDecisionWithRecordId("old-record", {
          id: "old-event",
          ts: now - 10 * 60 * 1000,
        }),
        pmDecisionWithRecordId("latest-record", { id: "latest-event" }),
      ],
      locale: "zh_CN",
      now,
    });

    expect(topics).toHaveLength(1);
    expect(topics[0].id).toBe("latest-record");
  });
});
