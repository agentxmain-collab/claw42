import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const enqueuePmDecisionJobMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const projectDecisionRecordToPublicEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  readPmDecisionJobs: readPmDecisionJobsMock,
  enqueuePmDecisionJob: enqueuePmDecisionJobMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watch/publicTimelineProjection", () => ({
  projectDecisionRecordToPublicEvent: projectDecisionRecordToPublicEventMock,
}));

const now = Date.parse("2026-05-20T12:00:00.000Z");
const url = `https://claw42.ai/api/watch/ops-resident-prewarm?locale=zh_CN&now=${encodeURIComponent(
  new Date(now).toISOString(),
)}`;

describe("/api/watch/ops-resident-prewarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("OPS_HEALTH_SECRET", "ops-secret");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED", "");
    readPmDecisionJobsMock.mockReset().mockResolvedValue([]);
    readAllDecisionRecordsMock.mockReset().mockResolvedValue([]);
    projectDecisionRecordToPublicEventMock.mockReset().mockReturnValue(null);
    enqueuePmDecisionJobMock.mockReset().mockImplementation(async (input) => ({
      id: `job:${input.candidate?.candidateKey}`,
      schemaVersion: 1,
      kind: input.kind,
      status: "queued",
      triggerSource: input.triggerSource,
      locale: input.locale,
      idempotencyKey: `once:${input.candidate?.candidateKey}`,
      candidate: input.candidate,
      symbol: input.candidate?.symbol ?? null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      startedAt: null,
      completedAt: null,
      attemptCount: 0,
      maxAttempts: 3,
      nextRunAt: new Date(now).toISOString(),
      lastError: null,
      outputCount: 0,
      decisionRecordIds: [],
      auditEventCount: 0,
    }));
  });

  it("rejects unauthenticated resident prewarm access", async () => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(401);
    expect(readPmDecisionJobsMock).not.toHaveBeenCalled();
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalled();
  });

  it("returns a dry-run resident prewarm plan without enqueueing jobs", async () => {
    const response = await GET(
      new Request(url, {
        headers: { authorization: "Bearer ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 500 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(500, "zh_CN");
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalled();
    expect(payload.plan).toMatchObject({
      schemaVersion: 1,
      mode: "dry_run",
      status: "dry_run_ready",
      executionAllowed: false,
      willRunPmPipeline: false,
      willPublishQueue: false,
      summary: {
        targetCount: 2,
      },
    });
  });

  it("does not execute without both env enablement and explicit confirmation", async () => {
    const response = await POST(
      new Request(`${url}&mode=execute`, {
        method: "POST",
        headers: {
          authorization: "Bearer ops-secret",
          "x-claw42-resident-prewarm-confirm": "enqueue-resident-prewarm",
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.plan).toMatchObject({
      mode: "execute",
      status: "execution_disabled",
      executionAllowed: false,
    });
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalled();
  });

  it("explicitly enqueues resident prewarm jobs without running the PM pipeline", async () => {
    vi.stubEnv("OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED", "true");

    const response = await POST(
      new Request(`${url}&mode=execute`, {
        method: "POST",
        headers: {
          authorization: "Bearer ops-secret",
          "x-claw42-resident-prewarm-confirm": "enqueue-resident-prewarm",
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledTimes(2);
    expect(enqueuePmDecisionJobMock).toHaveBeenNthCalledWith(1, {
      kind: "once",
      triggerSource: "cron",
      locale: "zh_CN",
      candidate: expect.objectContaining({ candidateType: "market_overview" }),
      now,
    });
    expect(enqueuePmDecisionJobMock).toHaveBeenNthCalledWith(2, {
      kind: "once",
      triggerSource: "cron",
      locale: "zh_CN",
      candidate: expect.objectContaining({ candidateType: "hotspot" }),
      now,
    });
    expect(payload.plan).toMatchObject({
      mode: "execute",
      status: "executed",
      executionAllowed: false,
      willRunPmPipeline: false,
      willPublishQueue: false,
      enqueuedJobs: [
        { candidateKey: "market_overview:utc:zh_CN:2026-05-20T12" },
        { candidateKey: "hotspot:utc:zh_CN:2026-05-20T12:market" },
      ],
    });
  });
});
