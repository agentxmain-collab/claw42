import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const readDecisionRunsMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const projectDecisionRecordToPublicEventMock = vi.hoisted(() => vi.fn());
const summarizeProviderTelemetryMock = vi.hoisted(() => vi.fn());

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

function run() {
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
});
