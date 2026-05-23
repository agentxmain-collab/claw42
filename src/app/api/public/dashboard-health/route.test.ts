import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  readPmDecisionJobs: readPmDecisionJobsMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

describe("/api/public/dashboard-health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-05-22T09:00:00.000Z"));
    readPmDecisionJobsMock.mockReset().mockResolvedValue([]);
    readAllDecisionRecordsMock.mockReset().mockResolvedValue([]);
  });

  it("returns a public-safe dashboard health summary without ops authorization", async () => {
    const response = await GET(
      new Request("https://claw42.ai/api/public/dashboard-health?locale=zh_CN"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readPmDecisionJobsMock).toHaveBeenCalledWith({ locale: "zh_CN", limit: 100 });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(100, "zh_CN");
    expect(payload).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-05-22T09:00:00.000Z",
      status: "critical",
      visibleCards: {
        marketOverview: 0,
        hotspot: 0,
        symbol: 0,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("jobId");
  });
});
