import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const readDecisionRunsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  readPmDecisionJobs: readPmDecisionJobsMock,
}));

vi.mock("@/lib/team/decisionRunLedger", () => ({
  readDecisionRuns: readDecisionRunsMock,
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
});
