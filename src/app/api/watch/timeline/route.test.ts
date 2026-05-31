import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const rateLimitMock = vi.hoisted(() => vi.fn());
const readSnapshotMock = vi.hoisted(() => vi.fn());
const publishSnapshotMock = vi.hoisted(() => vi.fn());
const createEmptySnapshotMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePayloadMock = vi.hoisted(() => vi.fn());
const getDiagnosticsMock = vi.hoisted(() => vi.fn());

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
  });

  it("serves public timeline snapshots with CDN cache headers and no no-store", async () => {
    readSnapshotMock.mockResolvedValueOnce({ source: "current", payload: snapshot() });

    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/watch/timeline?locale=zh_CN&windowMinutes=60&page=1&pageSize=15&before=999999",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
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

  it("allows one controlled source fallback on snapshot miss and publishes that result", async () => {
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
    expect(body.events).toHaveLength(1);
    expect(buildWatchTimelinePayloadMock).toHaveBeenCalledTimes(1);
    expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
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
