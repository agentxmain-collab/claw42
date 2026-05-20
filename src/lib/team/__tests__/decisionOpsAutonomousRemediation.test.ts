import { describe, expect, it } from "vitest";
import { buildDecisionOpsAutonomousRemediation } from "@/lib/team/decisionOpsAutonomousRemediation";
import type { DecisionOpsGlobalPrewarmPlanReport } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import type { DecisionOpsGlobalProgressGateReport } from "@/lib/team/decisionOpsGlobalProgressGate";
import type { DecisionOpsPublicOutputStabilityReport } from "@/lib/team/decisionOpsPublicOutputStability";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";

const generatedAt = "2026-05-20T09:00:00.000Z";
const now = Date.parse(generatedAt);

describe("buildDecisionOpsAutonomousRemediation", () => {
  it("allows resident prewarm remediation when the only blockers are missing global resident lanes", () => {
    const report = buildDecisionOpsAutonomousRemediation({
      globalProgress: globalProgress({
        status: "hold",
        blockingReasons: ["resident_market_overview_missing", "resident_hotspot_not_visible"],
      }),
      globalPrewarmPlan: globalPrewarmPlan(),
      queueRecoveryPolicy: queueRecoveryPolicy(),
      outputStability: outputStability({
        status: "degraded",
        primaryIssue: "minimum_visible_cards_gap",
      }),
      residentPrewarmExecutor: {
        executorEnabled: true,
        queuePublishEnabled: true,
        queueReady: true,
      },
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt,
      status: "resident_prewarm_ready",
      safeAutomationLevel: "resident_prewarm_only",
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      residentPrewarmExecutor: {
        ledgerEnqueueReady: true,
        queuePublishReady: true,
        queuePublishEndpoint: "/api/watch/ops-resident-prewarm?mode=execute&publishQueue=true",
      },
    });
    expect(report.remediations.map((item) => item.kind)).toEqual([
      "enqueue_resident_market_overview",
      "enqueue_resident_hotspot",
    ]);
    expect(report.remediations.every((item) => item.executable === false)).toBe(true);
    expect(report.remediations[0]).toMatchObject({
      operatorEndpoint: {
        method: "POST",
        path: "/api/watch/ops-resident-prewarm?mode=execute&publishQueue=true",
        confirmationHeader: "x-claw42-resident-prewarm-confirm",
        confirmationValue: "enqueue-resident-prewarm",
      },
      evidence: expect.arrayContaining(["resident_queue_publish_ready"]),
    });
  });

  it("surfaces missing resident prewarm execution gates without marking the action executable", () => {
    const report = buildDecisionOpsAutonomousRemediation({
      globalProgress: globalProgress({
        status: "hold",
        blockingReasons: ["resident_market_overview_missing"],
      }),
      globalPrewarmPlan: globalPrewarmPlan(),
      queueRecoveryPolicy: queueRecoveryPolicy(),
      outputStability: outputStability({
        status: "degraded",
        primaryIssue: "minimum_visible_cards_gap",
      }),
      residentPrewarmExecutor: {
        executorEnabled: true,
        queuePublishEnabled: false,
        queueReady: false,
      },
      now,
    });

    expect(report).toMatchObject({
      status: "resident_prewarm_ready",
      safeAutomationLevel: "resident_prewarm_only",
      residentPrewarmExecutor: {
        ledgerEnqueueReady: true,
        queuePublishReady: false,
        requiredEnv: {
          executorEnabled: true,
          queuePublishEnabled: false,
          pmDecisionQueueEnabled: false,
        },
      },
    });
    expect(report.remediations[0]).toMatchObject({
      executable: false,
      evidence: expect.arrayContaining([
        "resident_queue_publish_not_ready",
        "OPS_RESIDENT_PREWARM_QUEUE_PUBLISH_ENABLED=false",
        "PM_DECISION_QUEUE_ENABLED=false",
      ]),
    });
  });

  it("pauses automation when queue recovery says new triggers should stop", () => {
    const report = buildDecisionOpsAutonomousRemediation({
      globalProgress: globalProgress({ status: "hold" }),
      globalPrewarmPlan: globalPrewarmPlan(),
      queueRecoveryPolicy: queueRecoveryPolicy({
        status: "critical",
        mode: "pause_new_triggers",
        shouldPauseNewTriggers: true,
      }),
      outputStability: outputStability(),
      now,
    });

    expect(report).toMatchObject({
      status: "paused",
      safeAutomationLevel: "none",
      blockingReasons: ["queue_recovery_requires_trigger_pause"],
    });
    expect(report.remediations[0].kind).toBe("pause_new_triggers");
  });

  it("requires operator diagnosis for public output duplication or stage gaps", () => {
    const report = buildDecisionOpsAutonomousRemediation({
      globalProgress: globalProgress({ status: "hold", blockingReasons: ["stage_progress_gap"] }),
      globalPrewarmPlan: globalPrewarmPlan({
        status: "ready",
        safeToEnqueueResidentPrewarm: false,
        targets: [],
      }),
      queueRecoveryPolicy: queueRecoveryPolicy(),
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
      now,
    });

    expect(report).toMatchObject({
      status: "operator_required",
      safeAutomationLevel: "none",
      blockingReasons: ["public_output_requires_operator_diagnosis"],
    });
  });
});

function globalPrewarmPlan(
  overrides: Partial<DecisionOpsGlobalPrewarmPlanReport> = {},
): DecisionOpsGlobalPrewarmPlanReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "needs_global_prewarm",
    clock: "UTC",
    safeToEnqueueResidentPrewarm: true,
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    utcPolicy: {
      marketOverviewIntervalHours: 3,
      hotspotIntervalHours: 3,
    },
    summary: {
      plannedTargets: 2,
      missingVisibleResidentCards: 2,
      blockedByQueue: false,
    },
    targets: [
      {
        kind: "market_overview",
        priority: 10,
        reason: "resident_market_overview_missing",
        shouldEnqueue: true,
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-20T09",
          displayTitle: "今日大盘综述",
          executable: false,
          cadence: "daily",
          score: 100,
          reasons: [],
        },
        existingJobId: null,
        lastSucceededAt: null,
      },
      {
        kind: "hotspot",
        priority: 20,
        reason: "resident_hotspot_not_visible",
        shouldEnqueue: true,
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
          displayTitle: "热点叙事追踪",
          executable: false,
          cadence: "intraday",
          score: 80,
          reasons: [],
        },
        existingJobId: null,
        lastSucceededAt: null,
      },
    ],
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function queueRecoveryPolicy(
  overrides: Partial<DecisionOpsQueueRecoveryPolicy> = {},
): DecisionOpsQueueRecoveryPolicy {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "healthy",
    mode: "observe",
    shouldPauseNewTriggers: false,
    autoRecoveryAllowed: false,
    primaryAction: null,
    evidence: {
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
      queueMode: "inline",
      cronIssueCodes: [],
      healthAlerts: [],
      exhaustedCronJobs: 0,
      staleRunningCronJobs: 0,
      overdueCronRetries: 0,
      zeroOutputCronJobs: 0,
    },
    recoverySteps: [],
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
    byCandidateType: { symbol: 1, market_overview: 1, hotspot: 1 },
    byPublicStatus: { done: 3, active: 0, pending: 0 },
    order: { stable: true, eventIds: [], expectedEventIds: [] },
    duplicateCandidateKeys: [],
    issues: [],
    actions: [],
    ...overrides,
  };
}

function globalProgress(
  overrides: Partial<DecisionOpsGlobalProgressGateReport> = {},
): DecisionOpsGlobalProgressGateReport {
  return {
    schemaVersion: 1,
    generatedAt,
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
    summary: {
      utcClock: "UTC",
      allGlobalLanesCovered: true,
      allResidentCardsVisible: true,
      residentPriorityActive: false,
      blockedLowerPriorityJobs: 0,
      longRunningPreviewAllowed: true,
      memoryLoopLearningReady: true,
    },
    blockingReasons: [],
    nextActions: [],
    ...overrides,
  };
}
