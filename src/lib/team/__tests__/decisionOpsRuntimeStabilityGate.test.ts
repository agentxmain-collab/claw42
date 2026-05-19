import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsRuntimeStabilityGate,
  type DecisionOpsRuntimeStabilityGateReport,
} from "@/lib/team/decisionOpsRuntimeStabilityGate";
import type { DecisionOpsPublicOutputStabilityReport } from "@/lib/team/decisionOpsPublicOutputStability";
import type { DecisionOpsResidentPrewarmCoverageReport } from "@/lib/team/decisionOpsResidentPrewarmCoverage";

const generatedAt = "2026-05-19T12:00:00.000Z";

function residentCoverage(
  overrides: Partial<DecisionOpsResidentPrewarmCoverageReport> = {},
): DecisionOpsResidentPrewarmCoverageReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    allGlobalLanesCovered: true,
    utcPolicy: {
      clock: "UTC",
      marketOverviewIntervalHours: 3,
      hotspotIntervalHours: 3,
      hotspotBurstWindowHours: 1,
      hotspotBurstScoreThreshold: 130,
    },
    lanes: {
      marketOverview: {
        kind: "market_overview",
        required: true,
        ready: true,
        state: "ready",
        slaState: "healthy",
        ageMs: 60_000,
        expectedIntervalMs: 10_800_000,
        staleAfterMs: 21_600_000,
        lastSucceededAt: "2026-05-19T11:59:00.000Z",
        candidateKey: "market_overview:utc:zh_CN:2026-05-19T09",
        issue: null,
      },
      hotspot: {
        kind: "hotspot",
        required: true,
        ready: true,
        state: "ready",
        slaState: "healthy",
        ageMs: 60_000,
        expectedIntervalMs: 10_800_000,
        staleAfterMs: 21_600_000,
        lastSucceededAt: "2026-05-19T11:59:00.000Z",
        candidateKey: "hotspot:utc:zh_CN:2026-05-19T09:market",
        issue: null,
      },
    },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function outputStability(
  overrides: Partial<DecisionOpsPublicOutputStabilityReport> = {},
): DecisionOpsPublicOutputStabilityReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "healthy",
    primaryIssue: null,
    thresholds: {
      minimumVisibleCards: 2,
      maximumDuplicateCandidateCards: 0,
      maximumStageProgressGaps: 0,
    },
    counts: {
      publicPmEvents: 3,
      uniqueCandidateCards: 3,
      duplicateCandidateCards: 0,
      unstableOrderEvents: 0,
      stageProgressGaps: 0,
      missingStageTraceEvents: 0,
    },
    byCandidateType: {
      market_overview: 1,
      hotspot: 1,
      symbol: 1,
    },
    byPublicStatus: {
      done: 2,
      active: 1,
      pending: 0,
    },
    order: {
      stable: true,
      eventIds: ["market", "hotspot", "symbol"],
      expectedEventIds: ["market", "hotspot", "symbol"],
    },
    duplicateCandidateKeys: [],
    issues: [],
    actions: [],
    ...overrides,
  };
}

describe("buildDecisionOpsRuntimeStabilityGate", () => {
  it("passes only when global prewarm and public output stability are both healthy", () => {
    const report = buildDecisionOpsRuntimeStabilityGate({
      residentCoverage: residentCoverage(),
      outputStability: outputStability(),
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_runtime_observe",
      readyForLongRunningPreview: true,
      canChangeRefreshBehavior: false,
      publicBehaviorChanged: false,
      blockingReasons: [],
    } satisfies Partial<DecisionOpsRuntimeStabilityGateReport>);
  });

  it("blocks when market or hotspot global lanes are not covered", () => {
    const report = buildDecisionOpsRuntimeStabilityGate({
      residentCoverage: residentCoverage({
        status: "critical",
        allGlobalLanesCovered: false,
        blockingReasons: ["resident_market_overview_missing"],
      }),
      outputStability: outputStability(),
    });

    expect(report).toMatchObject({
      status: "hold",
      readyForLongRunningPreview: false,
      blockingReasons: ["resident_market_overview_missing", "resident_prewarm_not_ready"],
    });
  });

  it("blocks when duplicate cards or stage gaps are visible", () => {
    const report = buildDecisionOpsRuntimeStabilityGate({
      residentCoverage: residentCoverage(),
      outputStability: outputStability({
        status: "critical",
        primaryIssue: "duplicate_candidate_card",
        counts: {
          publicPmEvents: 3,
          uniqueCandidateCards: 2,
          duplicateCandidateCards: 1,
          unstableOrderEvents: 0,
          stageProgressGaps: 1,
          missingStageTraceEvents: 0,
        },
      }),
    });

    expect(report).toMatchObject({
      status: "hold",
      blockingReasons: [
        "public_output_stability_not_ready",
        "duplicate_candidate_card",
        "stage_progress_gap",
      ],
    });
  });
});
