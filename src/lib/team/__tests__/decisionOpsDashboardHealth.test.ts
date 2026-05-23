import { describe, expect, it } from "vitest";
import { buildPublicDashboardHealth } from "@/lib/team/decisionOpsDashboardHealth";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-22T09:00:00.000Z");

describe("buildPublicDashboardHealth", () => {
  it("reports ready when resident records are fresh and visible", () => {
    const report = buildPublicDashboardHealth({
      records: [
        record("market_overview", "2026-05-22T08:30:00.000Z"),
        record("hotspot", "2026-05-22T08:45:00.000Z"),
      ],
      jobs: [],
      now,
    });

    expect(report).toMatchObject({
      status: "ready",
      aligned: true,
      visibleCards: {
        marketOverview: 1,
        hotspot: 1,
      },
      blockingReasons: [],
    });
    expect(report.residentStatus.marketOverview).not.toHaveProperty("jobId");
  });

  it("reports critical when a resident lane is missing from the visible cards", () => {
    const report = buildPublicDashboardHealth({
      records: [record("market_overview", "2026-05-22T08:30:00.000Z")],
      jobs: [],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.aligned).toBe(false);
    expect(report.visibleCards).toMatchObject({
      marketOverview: 1,
      hotspot: 0,
    });
    expect(report.blockingReasons).toContain("resident_hotspot_not_visible");
  });
});

function record(
  candidateType: "market_overview" | "hotspot",
  createdAt: string,
): StrategyDecisionRecord {
  return {
    id: `pm:${candidateType}:${createdAt}`,
    schemaVersion: 2,
    recordSource: "paper",
    symbol: candidateType === "market_overview" ? "MARKET" : "HOTSPOT",
    candidate: {
      candidateType,
      candidateKey: `${candidateType}:zh_CN:${createdAt}`,
      displayTitle: candidateType === "market_overview" ? "今日大盘综述" : "热点叙事追踪",
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "intraday",
      score: 100,
      reasons: [],
    },
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "test",
  };
}
