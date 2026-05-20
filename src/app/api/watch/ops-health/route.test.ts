import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const readDecisionRunsMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const projectDecisionRecordToPublicEventMock = vi.hoisted(() => vi.fn());
const summarizeProviderTelemetryMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsCronAuditMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsChainRunbookMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsQueueRecoveryPolicyMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsModelQualityMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsQualityBaselineMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsPublicOutputStabilityMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsLifecycleDiagnosticsMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSummaryMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseExecutionMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseShadowMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseShadowHistoryMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseConfigGateMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseReadinessMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseShadowTelemetryMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseOperatorReportMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseCandidatePolicyMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseRuntimePlanMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsSparseReleaseGateMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsStabilityMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsCausalRunbookMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsAlertSnapshotMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsResidentPrewarmCoverageMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsRuntimeStabilityGateMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsModelQualityEvidenceMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsRuntimeQualityGateMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsQueuePriorityPolicyMock = vi.hoisted(() => vi.fn());
const buildDecisionOpsGlobalProgressGateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  readPmDecisionJobs: readPmDecisionJobsMock,
}));

vi.mock("@/lib/team/decisionRunLedger", () => ({
  readDecisionRuns: readDecisionRunsMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watch/publicTimelineProjection", () => ({
  projectDecisionRecordToPublicEvent: projectDecisionRecordToPublicEventMock,
}));

vi.mock("@/lib/team/providerTelemetry", () => ({
  summarizeProviderTelemetry: summarizeProviderTelemetryMock,
}));

vi.mock("@/lib/team/decisionOpsCronAudit", () => ({
  buildDecisionOpsCronAudit: buildDecisionOpsCronAuditMock,
}));

vi.mock("@/lib/team/decisionOpsChainRunbook", () => ({
  buildDecisionOpsChainRunbook: buildDecisionOpsChainRunbookMock,
}));

vi.mock("@/lib/team/decisionOpsQueueRecoveryPolicy", () => ({
  buildDecisionOpsQueueRecoveryPolicy: buildDecisionOpsQueueRecoveryPolicyMock,
}));

vi.mock("@/lib/team/decisionOpsModelQuality", () => ({
  buildDecisionOpsModelQuality: buildDecisionOpsModelQualityMock,
}));

vi.mock("@/lib/team/decisionOpsQualityBaseline", () => ({
  buildDecisionOpsQualityBaseline: buildDecisionOpsQualityBaselineMock,
}));

vi.mock("@/lib/team/decisionOpsPublicOutputStability", () => ({
  buildDecisionOpsPublicOutputStability: buildDecisionOpsPublicOutputStabilityMock,
}));

vi.mock("@/lib/team/decisionOpsLifecycleDiagnostics", () => ({
  buildDecisionOpsLifecycleDiagnostics: buildDecisionOpsLifecycleDiagnosticsMock,
}));

vi.mock("@/lib/team/decisionOpsSummary", () => ({
  buildDecisionOpsSummary: buildDecisionOpsSummaryMock,
}));

vi.mock("@/lib/team/decisionOpsSparseExecution", () => ({
  buildDecisionOpsSparseExecution: buildDecisionOpsSparseExecutionMock,
}));

vi.mock("@/lib/team/decisionOpsSparseShadow", () => ({
  buildDecisionOpsSparseShadow: buildDecisionOpsSparseShadowMock,
}));

vi.mock("@/lib/team/decisionOpsSparseShadowHistory", () => ({
  buildDecisionOpsSparseShadowHistory: buildDecisionOpsSparseShadowHistoryMock,
}));

vi.mock("@/lib/team/decisionOpsSparseConfigGate", () => ({
  buildDecisionOpsSparseConfigGate: buildDecisionOpsSparseConfigGateMock,
}));

vi.mock("@/lib/team/decisionOpsSparseReadiness", () => ({
  buildDecisionOpsSparseReadiness: buildDecisionOpsSparseReadinessMock,
}));

vi.mock("@/lib/team/decisionOpsSparseShadowTelemetry", () => ({
  buildDecisionOpsSparseShadowTelemetry: buildDecisionOpsSparseShadowTelemetryMock,
}));

vi.mock("@/lib/team/decisionOpsSparseOperatorReport", () => ({
  buildDecisionOpsSparseOperatorReport: buildDecisionOpsSparseOperatorReportMock,
}));

vi.mock("@/lib/team/decisionOpsSparseCandidatePolicy", () => ({
  buildDecisionOpsSparseCandidatePolicy: buildDecisionOpsSparseCandidatePolicyMock,
}));

vi.mock("@/lib/team/decisionOpsSparseRuntimePlan", () => ({
  buildDecisionOpsSparseRuntimePlan: buildDecisionOpsSparseRuntimePlanMock,
}));

vi.mock("@/lib/team/decisionOpsSparseReleaseGate", () => ({
  buildDecisionOpsSparseReleaseGate: buildDecisionOpsSparseReleaseGateMock,
}));

vi.mock("@/lib/team/decisionOpsStability", () => ({
  buildDecisionOpsStability: buildDecisionOpsStabilityMock,
}));

vi.mock("@/lib/team/decisionOpsCausalRunbook", () => ({
  buildDecisionOpsCausalRunbook: buildDecisionOpsCausalRunbookMock,
}));

vi.mock("@/lib/team/decisionOpsAlertSnapshot", () => ({
  buildDecisionOpsAlertSnapshot: buildDecisionOpsAlertSnapshotMock,
}));

vi.mock("@/lib/team/decisionOpsResidentPrewarmCoverage", () => ({
  buildDecisionOpsResidentPrewarmCoverage: buildDecisionOpsResidentPrewarmCoverageMock,
}));

vi.mock("@/lib/team/decisionOpsRuntimeStabilityGate", () => ({
  buildDecisionOpsRuntimeStabilityGate: buildDecisionOpsRuntimeStabilityGateMock,
}));

vi.mock("@/lib/team/decisionOpsModelQualityEvidence", () => ({
  buildDecisionOpsModelQualityEvidence: buildDecisionOpsModelQualityEvidenceMock,
}));

vi.mock("@/lib/team/decisionOpsRuntimeQualityGate", () => ({
  buildDecisionOpsRuntimeQualityGate: buildDecisionOpsRuntimeQualityGateMock,
}));

vi.mock("@/lib/team/decisionOpsQueuePriorityPolicy", () => ({
  buildDecisionOpsQueuePriorityPolicy: buildDecisionOpsQueuePriorityPolicyMock,
}));

vi.mock("@/lib/team/decisionOpsGlobalProgressGate", () => ({
  buildDecisionOpsGlobalProgressGate: buildDecisionOpsGlobalProgressGateMock,
}));

function job() {
  return {
    id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
    schemaVersion: 1,
    kind: "once",
    status: "queued",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    idempotencyKey: "once:user_visit_trigger:zh_CN:BTC:5934384",
    candidate: null,
    symbol: "BTC",
    createdAt: "2026-05-18T11:40:00.000Z",
    updatedAt: "2026-05-18T11:40:00.000Z",
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRunAt: "2026-05-18T11:40:00.000Z",
    lastError: null,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
  };
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run:pm:BTC:1779102000000",
    schemaVersion: 1,
    status: "succeeded",
    triggerSource: "cron",
    locale: "zh_CN",
    candidate: {
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      symbol: "BTC",
    },
    symbol: "BTC",
    startedAt: "2026-05-18T11:00:00.000Z",
    completedAt: "2026-05-18T11:03:00.000Z",
    stageStatus: {},
    analystRoundCount: 22,
    activeMemberIds: ["chart_analyst"],
    abstainedMemberIds: [],
    decisionRecordId: "pm:BTC:1779102000000",
    publicTimelineEventId: "public:pm:BTC:1779102000000",
    error: null,
    skipReason: null,
    ...overrides,
  };
}

describe("/api/watch/ops-health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-05-18T12:00:00.000Z"));
    vi.stubEnv("OPS_HEALTH_SECRET", "ops-secret");
    vi.stubEnv("CRON_SECRET", "");
    readPmDecisionJobsMock.mockReset().mockResolvedValue([job()]);
    readDecisionRunsMock.mockReset().mockResolvedValue([run()]);
    readAllDecisionRecordsMock.mockReset().mockResolvedValue([]);
    projectDecisionRecordToPublicEventMock.mockReset();
    summarizeProviderTelemetryMock.mockReset().mockReturnValue({
      totalCalls: 0,
      providerCounts: {},
      fallbackCalls: 0,
      failureCalls: 0,
      singleProviderConcentration: {
        provider: null,
        count: 0,
        ratio: 0,
        threshold: 0.9,
        alert: false,
      },
    });
    buildDecisionOpsCronAuditMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      schedule: {
        path: "/api/cron/strategy-replay",
        expression: "0 */3 * * *",
        expectedIntervalMs: 10_800_000,
      },
      queue: {
        mode: "inline",
        enabled: false,
        topic: "pm-decision-jobs",
        cronJobs: {
          total: 1,
          queued: 1,
          running: 0,
          succeeded: 0,
          failed: 0,
          retryBacklog: 0,
          overdueRetry: 0,
          exhaustedFailed: 0,
          staleRunning: 0,
          zeroOutputSuccess: 0,
        },
      },
      latest: {
        cronJob: null,
        cronRun: null,
      },
      issues: [],
    });
    buildDecisionOpsChainRunbookMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
      summary: "Cron, PM run, and public timeline output are fresh.",
      chain: [],
      runbookActions: [],
    });
    buildDecisionOpsQueueRecoveryPolicyMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      mode: "observe",
      shouldPauseNewTriggers: false,
      autoRecoveryAllowed: false,
      primaryAction: null,
      recoverySteps: [],
    });
    buildDecisionOpsQueuePriorityPolicyMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      generatedAt: "2026-05-18T12:00:00.000Z",
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
    });
    buildDecisionOpsModelQualityMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      riskLevel: "low",
      primaryRisk: null,
      dimensions: {},
      recommendations: [],
    });
    buildDecisionOpsQualityBaselineMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      baseline: {
        ready: true,
        scoredRuns: 6,
        candidateTypesCovered: 3,
      },
      issues: [],
      actions: [],
    });
    buildDecisionOpsPublicOutputStabilityMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      counts: {
        publicPmEvents: 1,
        uniqueCandidateCards: 1,
      },
      issues: [],
      actions: [],
    });
    buildDecisionOpsLifecycleDiagnosticsMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      counts: {
        total: 1,
        open: 1,
        resolved: 0,
        staleOpen: 0,
        inconsistentResolution: 0,
      },
      outcomeCounts: {},
      issues: [],
      actions: [],
    });
    buildDecisionOpsSummaryMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryArea: null,
      publicBoardState: "has_recent_public_output",
      headline: "Ops chain, model quality, and decision lifecycle are healthy.",
      areas: [],
      nextActions: [],
    });
    buildDecisionOpsSparseExecutionMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_sparse_trial",
      traceCoverage: {
        totalRecords: 1,
        recordsWithTrace: 1,
        missingTraceRecords: 0,
        coverageRate: 1,
        minimumTracedRecordsForPolicy: 3,
      },
      callModel: {
        fullTeamCalls: 14,
        observedSparseCalls: 5,
        avoidedCalls: 9,
        avoidedCallRate: 0.643,
        fullTeamSize: 14,
      },
      roles: [],
      recommendations: [],
    });
    buildDecisionOpsSparseShadowMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_shadow_trial",
      safeToTrial: true,
      sourceSparseStatus: "ready_for_sparse_trial",
      callModel: {
        fullTeamCalls: 14,
        shadowCalls: 5,
        avoidedCalls: 9,
        avoidedCallRate: 0.643,
      },
      riskCounts: {
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: 0,
      },
      roleOutcomes: [],
      recordOutcomes: [],
      recommendations: [],
    });
    buildDecisionOpsSparseShadowHistoryMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_config_gate",
      safeToPrepareConfigGate: true,
      parameters: {
        batchSize: 3,
        minimumSafeBatches: 2,
      },
      stability: {
        totalBatches: 2,
        evaluatedBatches: 2,
        safeBatches: 2,
        riskyBatches: 0,
        insufficientBatches: 0,
        consecutiveSafeBatches: 2,
      },
      batchOutcomes: [],
      recommendations: [],
    });
    buildDecisionOpsSparseConfigGateMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "disabled",
      configuredMode: "off",
      safeToEnableShadow: true,
      configGateOpen: false,
      runtimeEffect: {
        executionMode: "diagnostics_only",
        liveFanoutChangeAllowed: false,
        publicBehaviorChangeAllowed: false,
      },
      blockingReasons: [],
      configIssues: [],
      recommendations: [],
    });
    buildDecisionOpsSparseReadinessMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_shadow_config",
      readinessLevel: "waiting",
      canProceedToShadowTelemetry: false,
      canChangeLiveFanout: false,
      canChangePublicBehavior: false,
      sourceStatuses: {
        sparseExecution: "ready_for_sparse_trial",
        sparseShadow: "ready_for_shadow_trial",
        sparseShadowHistory: "ready_for_config_gate",
        sparseConfigGate: "disabled",
      },
      summary: {
        tracedRecords: 6,
        consecutiveSafeBatches: 2,
        avoidedCallRate: 0.643,
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: 0,
      },
      blockingReasons: ["sparse_config_gate_not_shadow_ready"],
      nextActions: [],
    });
    buildDecisionOpsSparseShadowTelemetryMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "telemetry_ready",
      telemetryMode: "shadow_only",
      canRecordShadowTelemetry: true,
      liveFanoutChanged: false,
      publicBehaviorChanged: false,
      summary: {
        recordsEvaluated: 1,
        safeRecords: 1,
        riskyRecords: 0,
        avoidedCallRate: 0.643,
        missedContributions: 0,
        missedWarnings: 0,
        traceGaps: 0,
      },
      candidateTypes: [],
      roleRiskHighlights: [],
      recommendations: [],
    });
    buildDecisionOpsSparseOperatorReportMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "shadow_telemetry_ready",
      headline: "Sparse diagnostics are ready for telemetry-only shadow work.",
      canProceedToShadowTelemetry: true,
      canChangeLiveFanout: false,
      canChangePublicBehavior: false,
      decisions: [],
      blockingReasons: [],
      nextActions: [],
    });
    buildDecisionOpsSparseCandidatePolicyMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "policy_ready",
      canChangeLiveFanout: false,
      publicBehaviorChanged: false,
      policies: [],
      blockingReasons: [],
      recommendations: [],
    });
    buildDecisionOpsSparseRuntimePlanMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "shadow_plan_ready",
      configuredMode: "shadow",
      executionMode: "diagnostics_only",
      willExecuteSparseRoles: false,
      willCallAdditionalModels: false,
      willChangePublicPayload: false,
      canChangeLiveFanout: false,
      candidatePlans: [],
      blockingReasons: [],
      nextActions: [],
    });
    buildDecisionOpsSparseReleaseGateMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_telemetry_only_release",
      telemetryOnlyReleaseAllowed: true,
      liveSparseReleaseAllowed: false,
      productionReleaseAllowed: false,
      nextStep: "ship_shadow_telemetry_only",
      blockingReasons: [],
    });
    buildDecisionOpsStabilityMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      windows: [],
      issues: [],
      actions: [],
    });
    buildDecisionOpsCausalRunbookMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryLayer: null,
      primaryIssue: null,
      alert: {
        shouldNotify: false,
        dedupeKey: null,
      },
      diagnosis: [],
      actions: [],
    });
    buildDecisionOpsAlertSnapshotMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      shouldNotify: false,
      activeAlert: null,
      repeatGuard: {
        dedupeKey: null,
        cooldownMs: null,
        nextEligibleAt: null,
      },
      operatorSummary: "No ops alert is active.",
      recommendedActions: [],
    });
    buildDecisionOpsResidentPrewarmCoverageMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready",
      allGlobalLanesCovered: true,
      utcPolicy: {
        clock: "UTC",
        marketOverviewIntervalHours: 3,
        hotspotIntervalHours: 3,
        hotspotBurstWindowHours: 1,
        hotspotBurstScoreThreshold: 130,
      },
      lanes: {},
      blockingReasons: [],
      actions: [],
    });
    buildDecisionOpsRuntimeStabilityGateMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready_for_runtime_observe",
      readyForLongRunningPreview: true,
      canChangeRefreshBehavior: false,
      publicBehaviorChanged: false,
      sourceStatuses: {
        residentCoverage: "ready",
        outputStability: "healthy",
      },
      summary: {
        allGlobalLanesCovered: true,
        publicPmEvents: 3,
        uniqueCandidateCards: 3,
        duplicateCandidateCards: 0,
        stageProgressGaps: 0,
        unstableOrderEvents: 0,
      },
      blockingReasons: [],
      nextActions: [],
    });
    buildDecisionOpsModelQualityEvidenceMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "ready",
      evidenceReady: true,
      canIncreaseModelCost: false,
      canReduceModelFanout: false,
      sourceStatuses: {
        qualityBaseline: "healthy",
        modelQuality: "healthy",
      },
      summary: {
        scoredRuns: 9,
        candidateTypesCovered: 3,
        publishableRate: 1,
        averageScore: 86,
        primaryRisk: null,
      },
      blockingReasons: [],
      nextActions: [],
    });
    buildDecisionOpsRuntimeQualityGateMock.mockReset().mockReturnValue({
      schemaVersion: 1,
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
    });
    buildDecisionOpsGlobalProgressGateMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      generatedAt: "2026-05-18T12:00:00.000Z",
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
      nextActions: [],
    });
  });

  it("rejects unauthenticated diagnostics access", async () => {
    const response = await GET(new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN"));

    expect(response.status).toBe(401);
    expect(readPmDecisionJobsMock).not.toHaveBeenCalled();
    expect(readDecisionRunsMock).not.toHaveBeenCalled();
  });

  it("returns a no-store queue and run health summary for authorized callers", async () => {
    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&limit=50&details=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 50 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 50 });
    expect(payload).toMatchObject({
      ok: true,
      locale: "zh_CN",
      health: {
        schemaVersion: 1,
        queue: { total: 1, queued: 1 },
        runs: { total: 1, succeeded: 1 },
      },
      queueReadiness: {
        schemaVersion: 1,
        enabled: false,
        mode: "inline",
      },
      details: {
        schemaVersion: 1,
        recentJobs: [expect.objectContaining({ id: job().id })],
        recentRuns: [expect.objectContaining({ id: run().id })],
      },
    });
  });

  it("returns optional reconciliation diagnostics for authorized callers", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "public:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&reconcile=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(projectDecisionRecordToPublicEventMock).toHaveBeenCalledWith({
      id: "pm:BTC:1779102000000",
    });
    expect(payload.reconciliation).toMatchObject({
      schemaVersion: 1,
      counts: {
        jobs: 1,
        runs: 1,
        publicPmEvents: 1,
      },
      canary: {
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "public_timeline", status: "ready" }),
        ]),
      },
    });
  });

  it("returns optional deep quality diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779102000000",
        modelProvider: "deepseek-chat",
        stageTrace: [],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&deep=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(payload.deepDiagnostics).toMatchObject({
      schemaVersion: 1,
      quality: {
        scoredRuns: 0,
      },
      provider: {
        recordModelProviderCounts: {
          "deepseek-chat": 1,
        },
      },
      replayDryRun: {
        proposals: [],
      },
    });
  });

  it("returns optional freshness watchdog diagnostics for authorized callers", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&freshness=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(payload.freshness).toMatchObject({
      schemaVersion: 1,
      signals: {
        latestSucceededRunAt: "2026-05-18T11:03:00.000Z",
        latestPublicPmEventAt: "2026-05-18T11:03:00.000Z",
      },
    });
  });

  it("includes resident market and hotspot SLA health with freshness diagnostics", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:MARKET:2026-05-17T23:00:00.000Z",
        locale: "zh_CN",
        symbol: "MARKET",
        createdAt: "2026-05-17T23:00:00.000Z",
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-17T18",
          displayTitle: "今日大盘综述",
          executable: false,
          cadence: "daily",
          score: 100,
          reasons: [],
        },
      },
      {
        id: "pm:HOTSPOT:2026-05-18T10:30:00.000Z",
        locale: "zh_CN",
        symbol: "HOTSPOT",
        createdAt: "2026-05-18T10:30:00.000Z",
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-18T09:market",
          displayTitle: "热点叙事追踪",
          executable: false,
          cadence: "intraday",
          score: 80,
          reasons: [],
        },
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&freshness=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarm).toMatchObject({
      schemaVersion: 1,
      slaState: "critical",
      marketOverview: {
        kind: "market_overview",
        slaState: "critical",
        expectedIntervalMs: 3 * 60 * 60_000,
        staleAfterMs: 6 * 60 * 60_000,
      },
      hotspot: {
        kind: "hotspot",
        slaState: "healthy",
        expectedIntervalMs: 3 * 60 * 60_000,
        staleAfterMs: 6 * 60 * 60_000,
      },
    });
  });

  it("returns an optional rollup summary without exposing nested diagnostics by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&rollup=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(payload.rollup).toMatchObject({
      schemaVersion: 1,
      status: "critical",
      counts: {
        runbookActions: expect.any(Number),
      },
    });
    expect(payload.reconciliation).toBeUndefined();
    expect(payload.deepDiagnostics).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional SLO diagnostics for authorized callers", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&slo=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(payload.slo).toMatchObject({
      schemaVersion: 1,
      status: expect.any(String),
      thresholds: {
        staleRunningJobAfterMs: expect.any(Number),
        staleRunningRunAfterMs: expect.any(Number),
      },
      windows: [
        expect.objectContaining({ windowHours: 24 }),
        expect.objectContaining({ windowHours: 168 }),
      ],
    });
  });

  it("returns optional quality gate diagnostics for authorized callers", async () => {
    readDecisionRunsMock.mockResolvedValue([
      run({
        quality: {
          schemaVersion: 1,
          score: 83,
          publishable: true,
          warningCount: 0,
          warnings: [],
          blockingWarnings: [],
          leakCount: 0,
          duplicateRationaleCount: 0,
          roleCoverage: { active: 12, contributorCount: 12, analystInputCount: 12 },
          directionDistribution: { long: 7, short: 2, neutral: 2, wait: 1 },
          evidence: { citedEvidenceCount: 6, analystCitationCount: 9 },
          trade: {
            hasTradeCard: true,
            direction: "long",
            confidence: 0.73,
            actionable: true,
          },
        },
      }),
    ]);
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779102000000",
        modelProvider: "deepseek-chat",
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&qualityGate=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(payload.qualityGate).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      publicRisk: {
        scoredRuns: 1,
        publishableRuns: 1,
      },
      byCandidateType: {
        symbol: expect.objectContaining({
          totalRuns: 1,
          averageScore: 83,
        }),
      },
      byProvider: {
        "deepseek-chat": expect.objectContaining({
          totalRuns: 1,
          publishableRuns: 1,
        }),
      },
    });
  });

  it("returns optional cron audit diagnostics for authorized callers", async () => {
    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&cronAudit=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildDecisionOpsCronAuditMock).toHaveBeenCalledWith({
      jobs: [job()],
      runs: [run()],
      queueReadiness: expect.objectContaining({
        schemaVersion: 1,
        mode: "inline",
        topic: "pm-decision-jobs",
      }),
    });
    expect(payload.cronAudit).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      schedule: {
        path: "/api/cron/strategy-replay",
        expression: "0 */3 * * *",
      },
      queue: {
        mode: "inline",
      },
    });
  });

  it("returns optional chain runbook diagnostics for authorized callers", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&runbook=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsCronAuditMock).toHaveBeenCalled();
    expect(buildDecisionOpsChainRunbookMock).toHaveBeenCalledWith({
      cronAudit: expect.objectContaining({ schemaVersion: 1 }),
      freshness: expect.objectContaining({ schemaVersion: 1 }),
      health: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(payload.runbook).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
    });
    expect(payload.cronAudit).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional read-only recovery policy diagnostics for authorized callers", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&recovery=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsChainRunbookMock).toHaveBeenCalled();
    expect(buildDecisionOpsQueueRecoveryPolicyMock).toHaveBeenCalledWith({
      runbook: expect.objectContaining({ schemaVersion: 1 }),
      cronAudit: expect.objectContaining({ schemaVersion: 1 }),
      health: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(payload.recoveryPolicy).toMatchObject({
      schemaVersion: 1,
      mode: "observe",
      autoRecoveryAllowed: false,
    });
    expect(payload.runbook).toBeUndefined();
    expect(payload.cronAudit).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional model quality diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779102000000",
        modelProvider: "deepseek-chat",
        stageTrace: [],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&modelQuality=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(buildDecisionOpsModelQualityMock).toHaveBeenCalledWith({
      qualityGate: expect.objectContaining({ schemaVersion: 1 }),
      deepDiagnostics: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(payload.modelQuality).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      riskLevel: "low",
    });
    expect(payload.qualityGate).toBeUndefined();
    expect(payload.deepDiagnostics).toBeUndefined();
  });

  it("returns optional quality baseline diagnostics and reads the full ledger window", async () => {
    readDecisionRunsMock.mockResolvedValue([
      run({
        quality: {
          schemaVersion: 1,
          score: 84,
          publishable: true,
          warningCount: 0,
          warnings: [],
          blockingWarnings: [],
          leakCount: 0,
          duplicateRationaleCount: 0,
          roleCoverage: { active: 12, contributorCount: 12, analystInputCount: 12 },
          directionDistribution: { long: 6, short: 3, neutral: 2, wait: 1 },
          evidence: { citedEvidenceCount: 7, analystCitationCount: 11 },
          trade: {
            hasTradeCard: true,
            direction: "long",
            confidence: 0.74,
            actionable: true,
          },
        },
      }),
    ]);
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779102000000",
        modelProvider: "deepseek-chat",
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&qualityBaseline=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(buildDecisionOpsQualityBaselineMock).toHaveBeenCalledWith({
      runs: [expect.objectContaining({ id: "run:pm:BTC:1779102000000" })],
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779102000000",
        }),
      ],
      providerTelemetry: expect.objectContaining({
        totalCalls: 0,
      }),
    });
    expect(payload.qualityBaseline).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
    });
    expect(payload.qualityGate).toBeUndefined();
    expect(payload.deepDiagnostics).toBeUndefined();
  });

  it("returns optional public output stability diagnostics from projected records", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
        candidateType: "symbol",
        candidateKey: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&outputStability=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(projectDecisionRecordToPublicEventMock).toHaveBeenCalledWith({
      id: "pm:BTC:1779102000000",
    });
    expect(buildDecisionOpsPublicOutputStabilityMock).toHaveBeenCalledWith({
      publicEvents: [
        expect.objectContaining({
          id: "pm-decision:pm:BTC:1779102000000",
        }),
      ],
    });
    expect(payload.outputStability).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
    });
    expect(payload.reconciliation).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional resident public visibility diagnostics from projected cards", async () => {
    projectDecisionRecordToPublicEventMock.mockImplementation((record: { id: string }) => ({
      id: `pm-decision:${record.id}`,
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: record.id,
        symbol: record.id.includes("HOTSPOT") ? "HOTSPOT" : "MARKET",
        candidateType: record.id.includes("HOTSPOT") ? "hotspot" : "market_overview",
        candidateKey: record.id.includes("HOTSPOT")
          ? "hotspot:utc:zh_CN:2026-05-18T09:market"
          : "market_overview:utc:zh_CN:2026-05-18T09",
      },
    }));
    readAllDecisionRecordsMock.mockResolvedValue([
      { id: "pm:MARKET:1779102000000" },
      { id: "pm:HOTSPOT:1779102000000" },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&residentVisibility=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(payload.residentVisibility).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      allResidentCardsVisible: true,
      counts: {
        marketOverview: 1,
        hotspot: 1,
      },
      blockingReasons: [],
    });
    expect(payload.outputStability).toBeUndefined();
    expect(payload.residentCoverage).toBeUndefined();
  });

  it("returns optional memory learning diagnostics from decision records", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779102000000",
        recordSource: "live",
        symbol: "BTC",
        resolvedAt: "2026-05-18T11:30:00.000Z",
        resolvedOutcome: "hit_tp",
        analystInputs: [
          {
            memberId: "memory_loop",
            direction: "neutral",
            confidence: 0.5,
            rationale: "Historical setup lesson.",
            evidenceIds: [],
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&memoryLearning=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(payload.memoryLearning).toMatchObject({
      schemaVersion: 1,
      status: "warming",
      memoryLoopLearningReady: false,
      counts: {
        resolvedNonLegacyRecords: 1,
        resolvedRecordsWithMemoryLoopNote: 1,
      },
      blockingReasons: ["memory_loop_sample_size_caution"],
    });
    expect(payload.outputStability).toBeUndefined();
    expect(payload.lifecycle).toBeUndefined();
  });

  it("returns optional decision lifecycle diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779120000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&lifecycle=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsLifecycleDiagnosticsMock).toHaveBeenCalledWith({
      records: [{ id: "pm:BTC:1779120000000" }],
    });
    expect(payload.lifecycle).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
    });
    expect(payload.reconciliation).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional unified ops summary without exposing nested diagnostics by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&opsSummary=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(buildDecisionOpsCronAuditMock).toHaveBeenCalled();
    expect(buildDecisionOpsChainRunbookMock).toHaveBeenCalled();
    expect(buildDecisionOpsQueueRecoveryPolicyMock).toHaveBeenCalled();
    expect(buildDecisionOpsModelQualityMock).toHaveBeenCalled();
    expect(buildDecisionOpsLifecycleDiagnosticsMock).toHaveBeenCalledWith({
      records: [{ id: "pm:BTC:1779102000000" }],
    });
    expect(buildDecisionOpsSummaryMock).toHaveBeenCalledWith({
      runbook: expect.objectContaining({ schemaVersion: 1 }),
      recoveryPolicy: expect.objectContaining({ schemaVersion: 1 }),
      modelQuality: expect.objectContaining({ schemaVersion: 1 }),
      lifecycle: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(payload.opsSummary).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryArea: null,
    });
    expect(payload.runbook).toBeUndefined();
    expect(payload.recoveryPolicy).toBeUndefined();
    expect(payload.modelQuality).toBeUndefined();
    expect(payload.lifecycle).toBeUndefined();
    expect(payload.cronAudit).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional sparse execution diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseExecution=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseExecutionMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(payload.sparseExecution).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_sparse_trial",
      callModel: {
        fullTeamCalls: 14,
        observedSparseCalls: 5,
      },
    });
    expect(payload.qualityGate).toBeUndefined();
    expect(payload.deepDiagnostics).toBeUndefined();
  });

  it("returns optional sparse shadow diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseShadow=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseShadowMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(payload.sparseShadow).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_shadow_trial",
      safeToTrial: true,
      riskCounts: {
        missedContributions: 0,
      },
    });
    expect(payload.sparseExecution).toBeUndefined();
    expect(payload.qualityGate).toBeUndefined();
  });

  it("returns optional sparse shadow history diagnostics for authorized callers", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseShadowHistory=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseShadowHistoryMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(payload.sparseShadowHistory).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_config_gate",
      safeToPrepareConfigGate: true,
      stability: {
        consecutiveSafeBatches: 2,
      },
    });
    expect(payload.sparseShadow).toBeUndefined();
    expect(payload.sparseExecution).toBeUndefined();
  });

  it("returns optional sparse config gate diagnostics without exposing nested history by default", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseConfigGate=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseShadowHistoryMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(buildDecisionOpsSparseConfigGateMock).toHaveBeenCalledWith({
      sparseShadowHistory: expect.objectContaining({
        status: "ready_for_config_gate",
      }),
      env: expect.any(Object),
    });
    expect(payload.sparseConfigGate).toMatchObject({
      schemaVersion: 1,
      status: "disabled",
      configuredMode: "off",
      runtimeEffect: {
        liveFanoutChangeAllowed: false,
      },
    });
    expect(payload.sparseShadowHistory).toBeUndefined();
    expect(payload.sparseShadow).toBeUndefined();
  });

  it("returns optional sparse readiness rollup without exposing nested sparse diagnostics by default", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseReadiness=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseExecutionMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(buildDecisionOpsSparseShadowMock).toHaveBeenCalledWith({
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779120000000",
        }),
      ],
    });
    expect(buildDecisionOpsSparseReadinessMock).toHaveBeenCalledWith({
      sparseExecution: expect.objectContaining({ status: "ready_for_sparse_trial" }),
      sparseShadow: expect.objectContaining({ status: "ready_for_shadow_trial" }),
      sparseShadowHistory: expect.objectContaining({ status: "ready_for_config_gate" }),
      sparseConfigGate: expect.objectContaining({ status: "disabled" }),
    });
    expect(payload.sparseReadiness).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_shadow_config",
      canChangeLiveFanout: false,
    });
    expect(payload.sparseExecution).toBeUndefined();
    expect(payload.sparseShadow).toBeUndefined();
    expect(payload.sparseShadowHistory).toBeUndefined();
    expect(payload.sparseConfigGate).toBeUndefined();
  });

  it("returns optional sparse release gate without exposing intermediate sparse reports by default", async () => {
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:1779120000000",
        roleExecutionTrace: [
          {
            memberId: "pm",
            executionMode: "core_active",
            activationReason: "Always active as final decision owner.",
            evidenceIdsUsed: ["evidence:pm"],
            contributedToPmDecision: true,
            vetoOrWarning: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&sparseReleaseGate=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsSparseShadowTelemetryMock).toHaveBeenCalledWith({
      records: [expect.objectContaining({ id: "pm:BTC:1779120000000" })],
      sparseShadow: expect.objectContaining({ status: "ready_for_shadow_trial" }),
    });
    expect(buildDecisionOpsSparseOperatorReportMock).toHaveBeenCalledWith({
      sparseReadiness: expect.objectContaining({ status: "ready_for_shadow_config" }),
      sparseTelemetry: expect.objectContaining({ status: "telemetry_ready" }),
    });
    expect(buildDecisionOpsSparseCandidatePolicyMock).toHaveBeenCalledWith({
      sparseTelemetry: expect.objectContaining({ status: "telemetry_ready" }),
    });
    expect(buildDecisionOpsSparseRuntimePlanMock).toHaveBeenCalledWith({
      sparseReadiness: expect.objectContaining({ status: "ready_for_shadow_config" }),
      sparseConfigGate: expect.objectContaining({ status: "disabled" }),
      sparseCandidatePolicy: expect.objectContaining({ status: "policy_ready" }),
    });
    expect(buildDecisionOpsSparseReleaseGateMock).toHaveBeenCalledWith({
      sparseOperatorReport: expect.objectContaining({ status: "shadow_telemetry_ready" }),
      sparseTelemetry: expect.objectContaining({ status: "telemetry_ready" }),
      sparseCandidatePolicy: expect.objectContaining({ status: "policy_ready" }),
      sparseRuntimePlan: expect.objectContaining({ status: "shadow_plan_ready" }),
    });
    expect(payload.sparseReleaseGate).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_telemetry_only_release",
      liveSparseReleaseAllowed: false,
      productionReleaseAllowed: false,
    });
    expect(payload.sparseReadiness).toBeUndefined();
    expect(payload.sparseTelemetry).toBeUndefined();
    expect(payload.sparseOperatorReport).toBeUndefined();
    expect(payload.sparseCandidatePolicy).toBeUndefined();
    expect(payload.sparseRuntimePlan).toBeUndefined();
  });

  it("returns optional long-window stability diagnostics and reads the full ledger window", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&stability=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(projectDecisionRecordToPublicEventMock).toHaveBeenCalledWith({
      id: "pm:BTC:1779102000000",
    });
    expect(buildDecisionOpsStabilityMock).toHaveBeenCalledWith({
      jobs: [job()],
      runs: [run()],
      publicEvents: [
        expect.objectContaining({
          id: "pm-decision:pm:BTC:1779102000000",
        }),
      ],
    });
    expect(payload.stability).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
    });
    expect(payload.slo).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional causal runbook diagnostics without exposing nested inputs by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
        candidateType: "symbol",
        candidateKey: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&causalRunbook=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(summarizeProviderTelemetryMock).toHaveBeenCalled();
    expect(buildDecisionOpsCronAuditMock).toHaveBeenCalled();
    expect(buildDecisionOpsChainRunbookMock).toHaveBeenCalled();
    expect(buildDecisionOpsQueueRecoveryPolicyMock).toHaveBeenCalled();
    expect(buildDecisionOpsStabilityMock).toHaveBeenCalledWith({
      jobs: [job()],
      runs: [run()],
      publicEvents: [
        expect.objectContaining({
          id: "pm-decision:pm:BTC:1779102000000",
        }),
      ],
    });
    expect(buildDecisionOpsPublicOutputStabilityMock).toHaveBeenCalledWith({
      publicEvents: [
        expect.objectContaining({
          id: "pm-decision:pm:BTC:1779102000000",
        }),
      ],
    });
    expect(buildDecisionOpsQualityBaselineMock).toHaveBeenCalledWith({
      runs: [expect.objectContaining({ id: "run:pm:BTC:1779102000000" })],
      records: [
        expect.objectContaining({
          id: "pm:BTC:1779102000000",
        }),
      ],
      providerTelemetry: expect.objectContaining({
        totalCalls: 0,
      }),
    });
    expect(buildDecisionOpsCausalRunbookMock).toHaveBeenCalledWith({
      runbook: expect.objectContaining({ schemaVersion: 1 }),
      recoveryPolicy: expect.objectContaining({ schemaVersion: 1 }),
      stability: expect.objectContaining({ schemaVersion: 1 }),
      outputStability: expect.objectContaining({ schemaVersion: 1 }),
      qualityBaseline: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(payload.causalRunbook).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryLayer: null,
    });
    expect(payload.runbook).toBeUndefined();
    expect(payload.recoveryPolicy).toBeUndefined();
    expect(payload.stability).toBeUndefined();
    expect(payload.outputStability).toBeUndefined();
    expect(payload.qualityBaseline).toBeUndefined();
    expect(payload.cronAudit).toBeUndefined();
    expect(payload.freshness).toBeUndefined();
  });

  it("returns optional alert snapshot diagnostics without exposing nested causal inputs by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
        candidateType: "symbol",
        candidateKey: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);
    buildDecisionOpsCausalRunbookMock.mockReturnValue({
      schemaVersion: 1,
      status: "critical",
      primaryLayer: "public_output_surface",
      primaryIssue: "duplicate_candidate_card",
      alert: {
        shouldNotify: true,
        dedupeKey: "ops-causal:public_output_surface:duplicate_candidate_card",
      },
      diagnosis: [],
      actions: [],
    });
    buildDecisionOpsAlertSnapshotMock.mockReturnValue({
      schemaVersion: 1,
      status: "critical",
      shouldNotify: true,
      activeAlert: {
        severity: "critical",
        layer: "public_output_surface",
        issue: "duplicate_candidate_card",
      },
      repeatGuard: {
        dedupeKey: "ops-causal:public_output_surface:duplicate_candidate_card",
        cooldownMs: 900000,
        nextEligibleAt: "2026-05-18T12:15:00.000Z",
      },
      operatorSummary: "Active ops alert: duplicate_candidate_card in public_output_surface.",
      recommendedActions: [],
    });

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&alertSnapshot=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsCausalRunbookMock).toHaveBeenCalledWith({
      runbook: expect.objectContaining({ schemaVersion: 1 }),
      recoveryPolicy: expect.objectContaining({ schemaVersion: 1 }),
      stability: expect.objectContaining({ schemaVersion: 1 }),
      outputStability: expect.objectContaining({ schemaVersion: 1 }),
      qualityBaseline: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(buildDecisionOpsAlertSnapshotMock).toHaveBeenCalledWith({
      causalRunbook: expect.objectContaining({
        primaryIssue: "duplicate_candidate_card",
      }),
    });
    expect(payload.alertSnapshot).toMatchObject({
      schemaVersion: 1,
      status: "critical",
      shouldNotify: true,
      repeatGuard: {
        dedupeKey: "ops-causal:public_output_surface:duplicate_candidate_card",
      },
    });
    expect(payload.causalRunbook).toBeUndefined();
    expect(payload.runbook).toBeUndefined();
    expect(payload.recoveryPolicy).toBeUndefined();
    expect(payload.stability).toBeUndefined();
    expect(payload.outputStability).toBeUndefined();
    expect(payload.qualityBaseline).toBeUndefined();
  });

  it("returns optional runtime quality gate without exposing nested B106-B120 inputs by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:BTC:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:BTC:1779102000000",
        symbol: "BTC",
        candidateType: "symbol",
        candidateKey: "BTC",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:BTC:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&runtimeQualityGate=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsResidentPrewarmCoverageMock).toHaveBeenCalledWith({
      residentStatus: expect.objectContaining({ schemaVersion: 1 }),
    });
    expect(buildDecisionOpsRuntimeStabilityGateMock).toHaveBeenCalledWith({
      residentCoverage: expect.objectContaining({ status: "ready" }),
      residentPublicVisibility: expect.objectContaining({ status: "critical" }),
      outputStability: expect.objectContaining({ status: "healthy" }),
    });
    expect(buildDecisionOpsModelQualityEvidenceMock).toHaveBeenCalledWith({
      qualityBaseline: expect.objectContaining({ status: "healthy" }),
      modelQuality: expect.objectContaining({ status: "healthy" }),
    });
    expect(buildDecisionOpsRuntimeQualityGateMock).toHaveBeenCalledWith({
      runtimeStability: expect.objectContaining({ status: "ready_for_runtime_observe" }),
      modelQualityEvidence: expect.objectContaining({ status: "ready" }),
      sparseReleaseGate: expect.objectContaining({ status: "ready_for_telemetry_only_release" }),
    });
    expect(payload.runtimeQualityGate).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_sparse_telemetry_observe",
      productionReleaseAllowed: false,
      liveSparseReleaseAllowed: false,
    });
    expect(payload.residentCoverage).toBeUndefined();
    expect(payload.runtimeStabilityGate).toBeUndefined();
    expect(payload.modelQualityEvidence).toBeUndefined();
    expect(payload.sparseReleaseGate).toBeUndefined();
    expect(payload.outputStability).toBeUndefined();
    expect(payload.qualityBaseline).toBeUndefined();
    expect(payload.modelQuality).toBeUndefined();
  });

  it("returns optional queue priority policy for authorized callers", async () => {
    buildDecisionOpsQueuePriorityPolicyMock.mockReturnValueOnce({
      schemaVersion: 1,
      generatedAt: "2026-05-18T12:00:00.000Z",
      status: "prioritizing_resident",
      residentPriorityActive: true,
      pendingOrder: [
        {
          jobId: "pm-job:market",
          priority: {
            rank: 10,
            band: "resident_market_overview",
            resident: true,
          },
          status: "queued",
          due: true,
        },
      ],
      blockedLowerPriorityJobs: [
        {
          jobId: "pm-job:batch",
          blockingJobIds: ["pm-job:market"],
          retryAfterSeconds: 30,
        },
      ],
      priorityBands: {
        residentMarketOverview: 1,
        residentHotspot: 0,
        symbolOnce: 0,
        batch: 1,
      },
      nextActions: [],
    });

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&queuePriority=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildDecisionOpsQueuePriorityPolicyMock).toHaveBeenCalledWith({
      jobs: [expect.objectContaining({ id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384" })],
      now: Date.parse("2026-05-18T12:00:00.000Z"),
    });
    expect(payload.queuePriority).toMatchObject({
      schemaVersion: 1,
      status: "prioritizing_resident",
      residentPriorityActive: true,
    });
  });

  it("returns optional global progress gate without exposing nested inputs by default", async () => {
    projectDecisionRecordToPublicEventMock.mockReturnValue({
      id: "pm-decision:pm:MARKET:1779102000000",
      ts: Date.parse("2026-05-18T11:03:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "pm:MARKET:1779102000000",
        symbol: "MARKET",
        candidateType: "market_overview",
        candidateKey: "market_overview:utc:zh_CN:2026-05-18T09",
      },
    });
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "pm:MARKET:1779102000000" }]);

    const response = await GET(
      new Request("https://claw42.ai/api/watch/ops-health?locale=zh_CN&globalProgress=1", {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readDecisionRunsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(buildDecisionOpsQueuePriorityPolicyMock).toHaveBeenCalled();
    expect(buildDecisionOpsRuntimeQualityGateMock).toHaveBeenCalled();
    expect(buildDecisionOpsGlobalProgressGateMock).toHaveBeenCalledWith({
      residentCoverage: expect.objectContaining({ status: "ready" }),
      residentVisibility: expect.objectContaining({ status: "critical" }),
      queuePriority: expect.objectContaining({ status: "ready" }),
      runtimeQualityGate: expect.objectContaining({ status: "ready_for_sparse_telemetry_observe" }),
      memoryLearning: expect.objectContaining({ status: "critical" }),
    });
    expect(payload.globalProgress).toMatchObject({
      schemaVersion: 1,
      status: "ready_for_memory_learning_observe",
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
    });
    expect(payload.queuePriority).toBeUndefined();
    expect(payload.runtimeQualityGate).toBeUndefined();
    expect(payload.memoryLearning).toBeUndefined();
    expect(payload.residentCoverage).toBeUndefined();
    expect(payload.residentVisibility).toBeUndefined();
  });
});
