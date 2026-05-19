import { describe, expect, it } from "vitest";
import { buildDecisionOpsSparseShadowTelemetry } from "@/lib/team/decisionOpsSparseShadowTelemetry";
import type { DecisionOpsSparseShadowReport } from "@/lib/team/decisionOpsSparseShadow";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const generatedAt = "2026-05-19T12:00:00.000Z";

function record({
  id,
  candidateType,
  createdAt = generatedAt,
}: {
  id: string;
  candidateType: "symbol" | "market_overview" | "hotspot";
  createdAt?: string;
}): StrategyDecisionRecord {
  return {
    id,
    schemaVersion: 2,
    recordSource: "live",
    symbol: candidateType === "symbol" ? "BTC" : candidateType === "hotspot" ? "HOTSPOT" : "MARKET",
    candidate: {
      candidateType,
      candidateKey: `${candidateType}:${id}`,
      displayTitle: id,
      executable: candidateType === "symbol",
      cadence: candidateType === "market_overview" ? "daily" : "intraday",
      score: 80,
      reasons: [],
      symbol: candidateType === "symbol" ? "BTC" : undefined,
    },
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: [],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "deepseek",
  };
}

function sparseShadow(
  overrides: Partial<DecisionOpsSparseShadowReport> = {},
): DecisionOpsSparseShadowReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_shadow_trial",
    safeToTrial: true,
    sourceSparseStatus: "ready_for_sparse_trial",
    callModel: {
      fullTeamCalls: 42,
      shadowCalls: 21,
      avoidedCalls: 21,
      avoidedCallRate: 0.5,
    },
    riskCounts: {
      missedContributions: 0,
      missedWarnings: 0,
      traceGaps: 0,
    },
    roleOutcomes: [],
    recordOutcomes: [
      {
        recordId: "market-1",
        safe: true,
        fullTeamCalls: 14,
        shadowCalls: 14,
        avoidedCalls: 0,
        risks: [],
      },
      {
        recordId: "hotspot-1",
        safe: true,
        fullTeamCalls: 14,
        shadowCalls: 7,
        avoidedCalls: 7,
        risks: [],
      },
      {
        recordId: "btc-1",
        safe: true,
        fullTeamCalls: 14,
        shadowCalls: 5,
        avoidedCalls: 9,
        risks: [],
      },
    ],
    recommendations: [],
    ...overrides,
  };
}

describe("buildDecisionOpsSparseShadowTelemetry", () => {
  it("groups shadow telemetry by candidate type without allowing live fan-out changes", () => {
    const report = buildDecisionOpsSparseShadowTelemetry({
      records: [
        record({ id: "market-1", candidateType: "market_overview" }),
        record({ id: "hotspot-1", candidateType: "hotspot" }),
        record({ id: "btc-1", candidateType: "symbol" }),
      ],
      sparseShadow: sparseShadow(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "telemetry_ready",
      telemetryMode: "shadow_only",
      canRecordShadowTelemetry: true,
      liveFanoutChanged: false,
      publicBehaviorChanged: false,
      summary: {
        recordsEvaluated: 3,
        safeRecords: 3,
        riskyRecords: 0,
        avoidedCallRate: 0.5,
      },
    });
    expect(report.candidateTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateType: "market_overview",
          recordsEvaluated: 1,
          avoidedCallRate: 0,
          recommendation: "keep_full_team",
        }),
        expect.objectContaining({
          candidateType: "hotspot",
          recordsEvaluated: 1,
          avoidedCallRate: 0.5,
          recommendation: "candidate_ready_for_shadow",
        }),
        expect.objectContaining({
          candidateType: "symbol",
          recordsEvaluated: 1,
          avoidedCallRate: 0.643,
          recommendation: "candidate_ready_for_shadow",
        }),
      ]),
    );
  });

  it("blocks telemetry readiness when any shadow record is risky", () => {
    const report = buildDecisionOpsSparseShadowTelemetry({
      records: [record({ id: "btc-1", candidateType: "symbol" })],
      sparseShadow: sparseShadow({
        status: "shadow_risk_detected",
        safeToTrial: false,
        riskCounts: {
          missedContributions: 1,
          missedWarnings: 0,
          traceGaps: 0,
        },
        recordOutcomes: [
          {
            recordId: "btc-1",
            safe: false,
            fullTeamCalls: 14,
            shadowCalls: 4,
            avoidedCalls: 10,
            risks: [
              {
                recordId: "btc-1",
                memberId: "risk_lead",
                riskType: "would_skip_warning",
                recommendedPolicy: "silent_until_signal",
                reason: "risk lead warned",
              },
            ],
          },
        ],
      }),
    });

    expect(report).toMatchObject({
      status: "risk_detected",
      canRecordShadowTelemetry: false,
      summary: {
        riskyRecords: 1,
        missedContributions: 1,
      },
    });
  });
});
