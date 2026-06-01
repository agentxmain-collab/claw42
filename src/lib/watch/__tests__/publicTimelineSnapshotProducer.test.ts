import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __publicTimelineSnapshotProducerTestUtils,
  PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES,
  PUBLIC_TIMELINE_SNAPSHOT_COLD_REBUILD_INTERVAL_MS,
  PUBLIC_TIMELINE_SNAPSHOT_MAX_REBUILDS_PER_DAY,
  rebuildPublicTimelineColdSnapshots,
  rebuildPublicTimelineSnapshotPagePair,
  schedulePublicTimelineSnapshotRefresh,
} from "@/lib/watch/publicTimelineSnapshotProducer";

const waitUntilMock = vi.hoisted(() => vi.fn());
const withLockMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePayloadMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePagePairPayloadsMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePageRangePayloadsMock = vi.hoisted(() => vi.fn());
const publishPublicTimelineSnapshotMock = vi.hoisted(() => vi.fn());
const getSharedFollowStatsMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/functions", () => ({
  waitUntil: waitUntilMock,
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  LockBusyError: class LockBusyError extends Error {},
  withLock: withLockMock,
}));

vi.mock("@/lib/watch/publicTimelinePayload", () => ({
  buildWatchTimelinePagePairPayloads: buildWatchTimelinePagePairPayloadsMock,
  buildWatchTimelinePageRangePayloads: buildWatchTimelinePageRangePayloadsMock,
  buildWatchTimelinePayload: buildWatchTimelinePayloadMock,
}));

vi.mock("@/lib/watch/publicTimelineSnapshotStore", () => ({
  PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS: 30 * 60 * 60,
  createEmptyPublicTimelineSnapshot: vi.fn(
    ({
      locale,
      windowMinutes,
      page,
      pageSize,
      now,
      status,
      sourceHealth,
      events = [],
      totalCount = events.length,
      hasMore = false,
    }) => ({
      version: "snapshot-1",
      generatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 75 * 60_000).toISOString(),
      locale,
      windowMinutes,
      page,
      pageSize,
      totalCount,
      oldestTs: null,
      hasMore,
      nextPollMs: 90_000,
      events,
      evidenceMap: {},
      sourceHealth,
      snapshotStatus: status,
      servedAt: now,
    }),
  ),
  publicTimelineSnapshotLockKey: vi.fn(
    (locale: string, windowMinutes: number, page: number) =>
      `public-timeline-snapshot:${locale}:${windowMinutes}:${page}`,
  ),
  publishPublicTimelineSnapshot: publishPublicTimelineSnapshotMock,
}));

vi.mock("@/lib/watch/followStatsStore", () => ({
  getSharedFollowStats: getSharedFollowStatsMock,
}));

describe("publicTimelineSnapshotProducer", () => {
  const now = Date.UTC(2026, 4, 31, 8, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    __publicTimelineSnapshotProducerTestUtils.reset();
    waitUntilMock.mockReset();
    withLockMock.mockReset().mockImplementation(async (_key, fn) => fn());
    buildWatchTimelinePayloadMock.mockReset().mockResolvedValue({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      servedAt: now,
      totalCount: 0,
      oldestTs: null,
      hasMore: false,
      nextPollMs: 90_000,
      events: [],
      evidenceMap: {},
    });
    buildWatchTimelinePagePairPayloadsMock.mockReset().mockResolvedValue([
      timelinePayload({
        page: 1,
        totalCount: 18,
        hasMore: true,
        events: [pmEvent("record-1", 1000)],
      }),
      timelinePayload({
        page: 2,
        totalCount: 18,
        hasMore: false,
        events: [pmEvent("record-16", 900)],
      }),
    ]);
    buildWatchTimelinePageRangePayloadsMock.mockReset().mockResolvedValue(
      Array.from({ length: 9 }, (_, index) =>
        timelinePayload({
          page: index + 3,
          totalCount: 165,
          hasMore: index + 3 < 11,
          events: [pmEvent(`record-${31 + index * 15}`, 800 - index)],
        }),
      ),
    );
    publishPublicTimelineSnapshotMock.mockReset().mockResolvedValue({ ok: true });
    getSharedFollowStatsMock.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses one rebuild slot to publish canonical page one and page two snapshots", async () => {
    const result = await rebuildPublicTimelineSnapshotPagePair({
      locale: "zh_CN",
    });

    expect(result).toMatchObject({ ok: true });
    expect(withLockMock).toHaveBeenCalledTimes(1);
    expect(buildWatchTimelinePagePairPayloadsMock).toHaveBeenCalledTimes(1);
    expect(buildWatchTimelinePayloadMock).not.toHaveBeenCalled();
    expect(getSharedFollowStatsMock).toHaveBeenCalledTimes(1);
    expect(getSharedFollowStatsMock).toHaveBeenCalledWith(["record-1", "record-16"]);
    expect(publishPublicTimelineSnapshotMock).toHaveBeenCalledTimes(2);
    expect(publishPublicTimelineSnapshotMock.mock.calls.map(([snapshot]) => snapshot.page)).toEqual(
      [1, 2],
    );
    expect(
      publishPublicTimelineSnapshotMock.mock.calls.map(([snapshot]) => snapshot.events),
    ).toEqual([
      [expect.objectContaining({ id: "event-record-1" })],
      [expect.objectContaining({ id: "event-record-16" })],
    ]);
  });

  it("coalesces burst writes and caps global snapshot rebuilds to 24 per day", async () => {
    await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });
    const burst = await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });

    expect(burst).toMatchObject({ ok: true, skipped: true, reason: "snapshot_refresh_deferred" });
    expect(withLockMock).toHaveBeenCalledTimes(2);
    expect(publishPublicTimelineSnapshotMock).toHaveBeenCalledTimes(11);

    for (let hour = 1; hour < 24; hour += 1) {
      vi.setSystemTime(now + hour * 60 * 60_000);
      await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });
    }

    expect(__publicTimelineSnapshotProducerTestUtils.rebuildStartedAt()).toHaveLength(24);
    expect(__publicTimelineSnapshotProducerTestUtils.coldRebuildStartedAt()).toHaveLength(1);
    expect(withLockMock).toHaveBeenCalledTimes(25);
    expect(publishPublicTimelineSnapshotMock).toHaveBeenCalledTimes(57);

    vi.setSystemTime(now + 24 * 60 * 60_000);
    const capped = await schedulePublicTimelineSnapshotRefresh("zh_CN", {
      reason: "record-write",
    });

    expect(capped).toMatchObject({ ok: true, skipped: true, reason: "snapshot_refresh_daily_cap" });
    expect(withLockMock).toHaveBeenCalledTimes(25);
  });

  it("publishes cold pages three through eleven in one daily batch without raising the hot cap", async () => {
    const result = await rebuildPublicTimelineColdSnapshots("zh_CN", {
      reason: "daily-cold-rebuild",
    });

    expect(result).toMatchObject({ ok: true });
    expect(PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(PUBLIC_TIMELINE_SNAPSHOT_MAX_REBUILDS_PER_DAY).toBe(24);
    expect(PUBLIC_TIMELINE_SNAPSHOT_COLD_REBUILD_INTERVAL_MS).toBe(24 * 60 * 60_000);
    expect(withLockMock).toHaveBeenCalledTimes(1);
    expect(buildWatchTimelinePageRangePayloadsMock).toHaveBeenCalledTimes(1);
    expect(buildWatchTimelinePageRangePayloadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "zh_CN",
        limit: 135,
        pageSize: 15,
        pages: [3, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    );
    expect(buildWatchTimelinePagePairPayloadsMock).not.toHaveBeenCalled();
    expect(getSharedFollowStatsMock).toHaveBeenCalledTimes(1);
    expect(getSharedFollowStatsMock).toHaveBeenCalledWith([
      "record-31",
      "record-46",
      "record-61",
      "record-76",
      "record-91",
      "record-106",
      "record-121",
      "record-136",
      "record-151",
    ]);
    expect(publishPublicTimelineSnapshotMock).toHaveBeenCalledTimes(9);
    expect(publishPublicTimelineSnapshotMock.mock.calls.map(([snapshot]) => snapshot.page)).toEqual(
      [3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
    expect(
      publishPublicTimelineSnapshotMock.mock.calls.map(([, options]) => options?.currentTtlSeconds),
    ).toEqual(Array(9).fill(30 * 60 * 60));
    expect(
      publishPublicTimelineSnapshotMock.mock.calls.map(
        ([snapshot]) => snapshot.sourceHealth.estimatedKvCommands,
      ),
    ).toEqual(Array(9).fill(138.5));
  });
});

function timelinePayload({
  page,
  totalCount,
  hasMore,
  events,
}: {
  page: number;
  totalCount: number;
  hasMore: boolean;
  events: ReturnType<typeof pmEvent>[];
}) {
  return {
    locale: "zh_CN",
    windowMinutes: 60,
    page,
    pageSize: 15,
    servedAt: Date.UTC(2026, 4, 31, 8, 0, 0),
    totalCount,
    oldestTs: events.at(-1)?.ts ?? null,
    hasMore,
    nextPollMs: 90_000,
    events,
    evidenceMap: {},
  };
}

function pmEvent(recordId: string, ts: number) {
  return {
    id: `event-${recordId}`,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    locale: "zh_CN",
    evidenceIds: [],
    payload: {
      kind: "pm_decision",
      recordId,
      symbol: recordId.toUpperCase(),
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}
