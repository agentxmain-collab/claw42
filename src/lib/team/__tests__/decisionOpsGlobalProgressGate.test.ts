import { describe, expect, it } from "vitest";
import { buildDecisionOpsGlobalProgressGate } from "@/lib/team/decisionOpsGlobalProgressGate";
import type { DecisionOpsMemoryLearningReport } from "@/lib/team/decisionOpsMemoryLearning";
import type { DecisionOpsQueuePriorityPolicyReport } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import type { DecisionOpsResidentPublicVisibilityReport } from "@/lib/team/decisionOpsResidentPublicVisibility";
import type { DecisionOpsResidentPrewarmCoverageReport } from "@/lib/team/decisionOpsResidentPrewarmCoverage";
import type { DecisionOpsRuntimeQualityGateReport } from "@/lib/team/decisionOpsRuntimeQualityGate";

const now = Date.parse("2026-05-20T00:00:00.000Z");
const generatedAt = "2026-05-20T00:00:00.000Z";

describe("buildDecisionOpsGlobalProgressGate", () => {
  it("is ready only when resident coverage, queue drain, model quality, and memory learning are all clean", () => {
    const report = buildDecisionOpsGlobalProgressGate({
      residentCoverage: residentCoverage(),
      residentVisibility: residentVisibility(),
      queuePriority: queuePriority(),
      runtimeQualityGate: runtimeQualityGate(),
      memoryLearning: memoryLearning(),
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_memory_learning_observe",
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      sourceStatuses: {
        residentCoverage: "ready",
        residentVisibility: "ready",
        queuePriority: "ready",
        runtimeQualityGate: "ready_for_sparse_telemetry_observe",
        memoryLearning: "ready",
      },
      readiness: {
        globalResidentLanesReady: true,
        queueDrainReady: true,
        runtimeQualityReady: true,
        memoryLearningReady: true,
      },
      blockingReasons: [],
    });
  });

  it("keeps global runtime observe available while memory learning is still warming", () => {
    const report = buildDecisionOpsGlobalProgressGate({
      residentCoverage: residentCoverage(),
      residentVisibility: residentVisibility(),
      queuePriority: queuePriority(),
      runtimeQualityGate: runtimeQualityGate(),
      memoryLearning: memoryLearning({
        status: "warming",
        memoryLoopLearningReady: false,
        blockingReasons: ["memory_loop_sample_size_caution"],
      }),
      now,
    });

    expect(report).toMatchObject({
      status: "ready_for_global_runtime_observe",
      readiness: {
        globalResidentLanesReady: true,
        queueDrainReady: true,
        runtimeQualityReady: true,
        memoryLearningReady: false,
      },
      blockingReasons: ["memory_loop_sample_size_caution", "memory_learning_not_ready"],
    });
    expect(report.nextActions[0].title).toContain("memory loop");
  });

  it("holds when resident lanes are missing, queue is still draining, or runtime quality is blocked", () => {
    const report = buildDecisionOpsGlobalProgressGate({
      residentCoverage: residentCoverage({
        status: "critical",
        allGlobalLanesCovered: false,
        blockingReasons: ["resident_market_overview_missing"],
      }),
      residentVisibility: residentVisibility({
        status: "critical",
        allResidentCardsVisible: false,
        blockingReasons: ["resident_hotspot_not_visible"],
      }),
      queuePriority: queuePriority({
        status: "prioritizing_resident",
        residentPriorityActive: true,
        blockedLowerPriorityJobs: [
          {
            jobId: "symbol",
            blockingJobIds: ["market"],
            retryAfterSeconds: 30,
            reason: "higher_priority_resident_due",
          },
        ],
      }),
      runtimeQualityGate: runtimeQualityGate({
        status: "hold",
        longRunningPreviewAllowed: false,
        blockingReasons: ["stage_progress_gap"],
      }),
      memoryLearning: memoryLearning({
        status: "critical",
        memoryLoopLearningReady: false,
        blockingReasons: ["memory_loop_no_resolved_non_legacy_records"],
      }),
      now,
    });

    expect(report).toMatchObject({
      status: "hold",
      readiness: {
        globalResidentLanesReady: false,
        queueDrainReady: false,
        runtimeQualityReady: false,
        memoryLearningReady: false,
      },
      blockingReasons: [
        "resident_market_overview_missing",
        "resident_prewarm_not_ready",
        "resident_hotspot_not_visible",
        "resident_public_visibility_not_ready",
        "resident_queue_draining",
        "stage_progress_gap",
        "runtime_quality_gate_not_ready",
        "memory_loop_no_resolved_non_legacy_records",
        "memory_learning_not_ready",
      ],
    });
  });
});

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
      marketOverview: residentLane("market_overview"),
      hotspot: residentLane("hotspot"),
    },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function residentVisibility(
  overrides: Partial<DecisionOpsResidentPublicVisibilityReport> = {},
): DecisionOpsResidentPublicVisibilityReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    allResidentCardsVisible: true,
    counts: { marketOverview: 1, hotspot: 1, symbol: 1 },
    missingResidentTypes: [],
    visibleResidentEventIds: { marketOverview: ["market"], hotspot: ["hotspot"] },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function queuePriority(
  overrides: Partial<DecisionOpsQueuePriorityPolicyReport> = {},
): DecisionOpsQueuePriorityPolicyReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    residentPriorityActive: false,
    pendingOrder: [],
    blockedLowerPriorityJobs: [],
    priorityBands: {
      residentMarketOverview: 0,
      residentHotspot: 0,
      symbolOnce: 0,
      batch: 0,
    },
    nextActions: [],
    ...overrides,
  };
}

function runtimeQualityGate(
  overrides: Partial<DecisionOpsRuntimeQualityGateReport> = {},
): DecisionOpsRuntimeQualityGateReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready_for_sparse_telemetry_observe",
    longRunningPreviewAllowed: true,
    sparseTelemetryAllowed: true,
    liveSparseReleaseAllowed: false,
    productionReleaseAllowed: false,
    sourceStatuses: {
      runtimeStability: "ready_for_runtime_observe",
      modelQualityEvidence: "ready",
      sparseReleaseGate: "ready_for_telemetry_only_release",
    },
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}

function memoryLearning(
  overrides: Partial<DecisionOpsMemoryLearningReport> = {},
): DecisionOpsMemoryLearningReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    memoryLoopLearningReady: true,
    thresholds: {
      minimumResolvedRecords: 5,
      minimumMemoryLoopNoteCoverage: 0.2,
    },
    counts: {
      totalRecords: 5,
      resolvedNonLegacyRecords: 5,
      resolvedRecordsWithMemoryLoopNote: 2,
      distinctResolvedSymbols: 5,
      sampleSizeCautionRecords: 0,
    },
    ratios: {
      memoryNoteCoverage: 0.4,
    },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function residentLane(kind: "market_overview" | "hotspot") {
  return {
    kind,
    required: true,
    ready: true,
    state: "ready",
    slaState: "healthy",
    ageMs: 60_000,
    expectedIntervalMs: 10_800_000,
    staleAfterMs: 21_600_000,
    lastSucceededAt: generatedAt,
    candidateKey:
      kind === "market_overview"
        ? "market_overview:utc:zh_CN:2026-05-20T00"
        : "hotspot:utc:zh_CN:2026-05-20T00:market",
    issue: null,
  } satisfies DecisionOpsResidentPrewarmCoverageReport["lanes"]["marketOverview"];
}
