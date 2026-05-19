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
const buildDecisionOpsStabilityMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/team/decisionOpsStability", () => ({
  buildDecisionOpsStability: buildDecisionOpsStabilityMock,
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
    buildDecisionOpsStabilityMock.mockReset().mockReturnValue({
      schemaVersion: 1,
      status: "healthy",
      primaryIssue: null,
      windows: [],
      issues: [],
      actions: [],
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
});
