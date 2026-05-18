import { describe, expect, it } from "vitest";
import { buildDecisionOpsLifecycleDiagnostics } from "@/lib/team/decisionOpsLifecycleDiagnostics";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const now = Date.parse("2026-05-19T00:45:00.000Z");

function record(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "pm:BTC:1779120000000",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-18T23:00:00.000Z",
    evaluationWindowEndsAt: "2026-05-19T04:00:00.000Z",
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek-chat",
    ...overrides,
  };
}

describe("buildDecisionOpsLifecycleDiagnostics", () => {
  it("stays healthy when open decisions are inside window and resolved records are complete", () => {
    const report = buildDecisionOpsLifecycleDiagnostics({
      records: [
        record({ id: "open:future" }),
        record({
          id: "resolved:tp",
          resolvedAt: "2026-05-19T00:10:00.000Z",
          resolvedOutcome: "hit_tp",
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      counts: {
        total: 2,
        open: 1,
        resolved: 1,
        staleOpen: 0,
        inconsistentResolution: 0,
      },
      outcomeCounts: {
        hit_tp: 1,
      },
      issues: [],
      actions: [],
    });
  });

  it("flags open decisions whose evaluation window elapsed without resolution", () => {
    const report = buildDecisionOpsLifecycleDiagnostics({
      records: [
        record({
          id: "open:stale",
          evaluationWindowEndsAt: "2026-05-18T21:00:00.000Z",
        }),
      ],
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      primaryIssue: "stale_open_decision",
      counts: {
        open: 1,
        staleOpen: 1,
      },
      issues: [
        expect.objectContaining({
          type: "stale_open_decision",
          severity: "critical",
          recordId: "open:stale",
        }),
      ],
      actions: [
        expect.objectContaining({
          title: "Inspect resolution writer before adding more lifecycle UI",
          executable: false,
        }),
      ],
    });
  });

  it("flags records whose resolution fields disagree", () => {
    const report = buildDecisionOpsLifecycleDiagnostics({
      records: [
        record({
          id: "bad:outcome-only",
          resolvedOutcome: "hit_sl",
          resolvedAt: null,
        }),
        record({
          id: "bad:at-only",
          resolvedOutcome: null,
          resolvedAt: "2026-05-19T00:10:00.000Z",
        }),
      ],
      now,
    });

    expect(report.status).toBe("critical");
    expect(report.primaryIssue).toBe("resolution_field_mismatch");
    expect(report.counts.inconsistentResolution).toBe(2);
    expect(report.issues.map((issue) => issue.recordId)).toEqual([
      "bad:at-only",
      "bad:outcome-only",
    ]);
  });
});
