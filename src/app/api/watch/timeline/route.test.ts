import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const rateLimitMock = vi.hoisted(() => vi.fn());
const readSnapshotMock = vi.hoisted(() => vi.fn());
const publishSnapshotMock = vi.hoisted(() => vi.fn());
const createEmptySnapshotMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePayloadMock = vi.hoisted(() => vi.fn());
const getDiagnosticsMock = vi.hoisted(() => vi.fn());
const checkPublicBoardKvBudgetMock = vi.hoisted(() => vi.fn());
const rememberPublicBoardLastGoodMock = vi.hoisted(() => vi.fn());
const readPublicBoardLastGoodMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: rateLimitMock,
}));

vi.mock("@/lib/watch/publicTimelineSnapshotStore", () => ({
  createEmptyPublicTimelineSnapshot: createEmptySnapshotMock,
  readPublicTimelineSnapshot: readSnapshotMock,
}));

vi.mock("@/lib/watch/publicTimelineSnapshotProducer", () => ({
  buildPublicTimelineSnapshotFromPayload: vi.fn((payload) => ({
    ...payload,
    version: "snapshot-fallback",
    generatedAt: new Date(payload.servedAt).toISOString(),
    snapshotStatus: "fresh",
    sourceHealth: { state: "fallback-build" },
  })),
  publishPublicTimelineSnapshot: publishSnapshotMock,
}));

vi.mock("@/lib/watch/publicTimelinePayload", () => ({
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES: 1440,
  buildWatchTimelinePayload: buildWatchTimelinePayloadMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  getDecisionRecordStoreDiagnostics: getDiagnosticsMock,
}));

vi.mock("@/lib/watch/publicBoardKvBudgetGuard", () => ({
  checkPublicBoardKvBudget: checkPublicBoardKvBudgetMock,
  rememberPublicBoardLastGood: rememberPublicBoardLastGoodMock,
  readPublicBoardLastGood: readPublicBoardLastGoodMock,
}));

describe("/api/watch/timeline", () => {
  beforeEach(() => {
    rateLimitMock.mockReset().mockReturnValue(true);
    readSnapshotMock.mockReset();
    publishSnapshotMock.mockReset().mockResolvedValue({ ok: true });
    createEmptySnapshotMock
      .mockReset()
      .mockImplementation(({ locale, windowMinutes, page, pageSize }) =>
        snapshot({ locale, windowMinutes, page, pageSize, snapshotStatus: "degraded" }),
      );
    buildWatchTimelinePayloadMock.mockReset().mockResolvedValue(
      snapshot({
        version: undefined,
        generatedAt: undefined,
        snapshotStatus: undefined,
        sourceHealth: undefined,
      }),
    );
    getDiagnosticsMock.mockReset().mockResolvedValue({ ok: true });
    checkPublicBoardKvBudgetMock.mockReset().mockReturnValue({ allowed: true });
    rememberPublicBoardLastGoodMock.mockReset();
    readPublicBoardLastGoodMock.mockReset().mockReturnValue(null);
  });

  it("serves public timeline snapshots with CDN cache headers and no no-store", async () => {
    readSnapshotMock.mockResolvedValueOnce({ source: "current", payload: snapshot() });

    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/timeline?locale=zh_CN&page=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=900, stale-while-revalidate=3600",
    );
    expect(response.headers.get("Cache-Control")).not.toContain("no-store");
    expect(body.snapshotStatus).toBe("fresh");
    expect(readSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "zh_CN",
        windowMinutes: 60,
        page: 1,
        pageSize: 15,
      }),
    );
    expect(buildWatchTimelinePayloadMock).not.toHaveBeenCalled();
    expect(rememberPublicBoardLastGoodMock).toHaveBeenCalledWith(
      "timeline:zh_CN:60:1:15",
      expect.objectContaining({ snapshotStatus: "fresh" }),
    );
  });

  it("serves cold timeline snapshots with six-hour CDN cache headers", async () => {
    readSnapshotMock.mockResolvedValueOnce({ source: "current", payload: snapshot({ page: 11 }) });

    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/watch/timeline?locale=zh_CN&windowMinutes=60&page=11&pageSize=15",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=21600, stale-while-revalidate=86400",
    );
    expect(body.page).toBe(11);
    expect(readSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "zh_CN",
        windowMinutes: 60,
        page: 11,
        pageSize: 15,
      }),
    );
  });

  it("accepts only finite canonical snapshot queries before touching KV", async () => {
    readSnapshotMock.mockResolvedValueOnce({ source: "current", payload: snapshot({ page: 11 }) });
    const valid = await GET(
      new NextRequest(
        "https://claw42.ai/api/watch/timeline?locale=zh_CN&windowMinutes=60&page=11&pageSize=15",
      ),
    );
    expect(valid.status).toBe(200);
    expect(readSnapshotMock).toHaveBeenCalledTimes(1);

    readSnapshotMock.mockClear();
    checkPublicBoardKvBudgetMock.mockClear();

    for (const query of [
      "locale=zh_CN&page=12",
      "locale=zh_CN&page=1&before=999999",
      "locale=zh_CN&page=1&limit=15",
      "locale=zh_CN&page=1&pageSize=30",
      "locale=zh_CN&page=1&windowMinutes=120",
      "locale=zh_CN&page=1&unknown=1",
    ]) {
      const response = await GET(new NextRequest(`https://claw42.ai/api/watch/timeline?${query}`));
      expect(response.status).toBe(400);
    }

    expect(readSnapshotMock).not.toHaveBeenCalled();
    expect(buildWatchTimelinePayloadMock).not.toHaveBeenCalled();
    expect(checkPublicBoardKvBudgetMock).not.toHaveBeenCalled();
  });

  it("returns in-memory last-good payloads without KV when the hard fuse is tripped", async () => {
    checkPublicBoardKvBudgetMock.mockReturnValueOnce({
      allowed: false,
      reason: "public_board_kv_budget_exhausted",
    });
    readPublicBoardLastGoodMock.mockReturnValueOnce(
      snapshot({
        snapshotStatus: "stale",
        events: [{ id: "event-last-good" }],
        sourceHealth: { state: "degraded", reason: "last_good" },
      }),
    );

    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/timeline?locale=zh_CN&page=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toEqual([{ id: "event-last-good" }]);
    expect(readSnapshotMock).not.toHaveBeenCalled();
    expect(buildWatchTimelinePayloadMock).not.toHaveBeenCalled();
  });

  it("returns degraded last-good/empty payloads instead of 500 when snapshot storage fails", async () => {
    readSnapshotMock.mockRejectedValueOnce(new Error("upstash quota exceeded"));

    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/timeline?locale=zh_CN"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshotStatus).toBe("degraded");
    expect(body.events).toEqual([]);
  });

  it("does not rebuild the public timeline on a per-request snapshot miss", async () => {
    readSnapshotMock.mockResolvedValueOnce({
      source: "empty",
      storageError: false,
      payload: snapshot({ snapshotStatus: "empty", events: [] }),
    });
    buildWatchTimelinePayloadMock.mockResolvedValueOnce(snapshot({ events: [{ id: "event-1" }] }));

    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/timeline?locale=zh_CN"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toEqual([]);
    expect(buildWatchTimelinePayloadMock).not.toHaveBeenCalled();
    expect(publishSnapshotMock).not.toHaveBeenCalled();
  });

  it("keeps storage diagnostics private and no-store", async () => {
    readSnapshotMock.mockResolvedValueOnce({ source: "current", payload: snapshot() });

    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/timeline?diagnostics=storage", {
        headers: { "x-claw42-debug": "1" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: "snapshot-1",
    generatedAt: "2026-05-31T05:00:00.000Z",
    locale: "zh_CN",
    windowMinutes: 60,
    page: 1,
    pageSize: 15,
    totalCount: 0,
    oldestTs: null,
    hasMore: false,
    nextPollMs: 90_000,
    events: [],
    evidenceMap: {},
    residentStatus: undefined,
    sourceHealth: { state: "ok" },
    snapshotStatus: "fresh",
    servedAt: Date.parse("2026-05-31T05:00:00.000Z"),
    ...overrides,
  };
}
