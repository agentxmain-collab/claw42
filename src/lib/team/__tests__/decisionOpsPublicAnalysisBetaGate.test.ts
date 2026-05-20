import { describe, expect, it } from "vitest";
import { buildDecisionOpsPublicAnalysisBetaGate } from "@/lib/team/decisionOpsPublicAnalysisBetaGate";

describe("buildDecisionOpsPublicAnalysisBetaGate", () => {
  it("allows public analysis beta when global lanes, quality, cost, and feedback are ready", () => {
    const report = buildDecisionOpsPublicAnalysisBetaGate({
      globalProgress: {
        status: "ready_for_global_runtime_observe",
        readiness: {
          globalResidentLanesReady: true,
          queueDrainReady: true,
          runtimeQualityReady: true,
          memoryLearningReady: false,
        },
        blockingReasons: [],
      },
      residentQueueCanary: {
        status: "ready",
        allResidentClosedLoopReady: true,
        blockingReasons: [],
      },
      qualityGate: {
        status: "degraded",
        issues: [{ type: "low_evidence", severity: "degraded" }],
      },
      runtimeQualityGate: {
        status: "ready_for_full_team_observe",
        longRunningPreviewAllowed: true,
        blockingReasons: [],
      },
      memoryLearning: {
        status: "warming",
        memoryLoopLearningReady: false,
        blockingReasons: ["memory_loop_sample_size_caution"],
      },
      feedbackCaptureReady: true,
      costPolicy: {
        queuePublishExplicitOptIn: true,
        maxVisitResidentJobs: 1,
        maxVisitSymbolJobs: 3,
      },
      now: Date.parse("2026-05-20T09:00:00.000Z"),
    });

    expect(report).toMatchObject({
      status: "ready_for_public_analysis_beta",
      publicAnalysisBetaAllowed: true,
      trustedLearningClaimAllowed: false,
      productionReleaseAllowed: false,
      feedbackCaptureReady: true,
      blockingReasons: [],
      watchItems: ["memory_loop_sample_size_caution"],
    });
  });

  it("holds beta when resident output is not closed loop or feedback is missing", () => {
    const report = buildDecisionOpsPublicAnalysisBetaGate({
      globalProgress: {
        status: "hold",
        readiness: {
          globalResidentLanesReady: false,
          queueDrainReady: true,
          runtimeQualityReady: true,
          memoryLearningReady: false,
        },
        blockingReasons: ["resident_prewarm_not_ready"],
      },
      residentQueueCanary: {
        status: "blocked",
        allResidentClosedLoopReady: false,
        blockingReasons: ["resident_market_overview_job_missing"],
      },
      qualityGate: {
        status: "healthy",
        issues: [],
      },
      runtimeQualityGate: {
        status: "ready_for_full_team_observe",
        longRunningPreviewAllowed: true,
        blockingReasons: [],
      },
      memoryLearning: {
        status: "critical",
        memoryLoopLearningReady: false,
        blockingReasons: ["memory_loop_no_resolved_non_legacy_records"],
      },
      feedbackCaptureReady: false,
      costPolicy: {
        queuePublishExplicitOptIn: true,
        maxVisitResidentJobs: 1,
        maxVisitSymbolJobs: 3,
      },
      now: Date.parse("2026-05-20T09:00:00.000Z"),
    });

    expect(report).toMatchObject({
      status: "hold",
      publicAnalysisBetaAllowed: false,
      blockingReasons: [
        "global_resident_lanes_not_ready",
        "resident_market_overview_job_missing",
        "feedback_capture_not_ready",
      ],
    });
  });
});
