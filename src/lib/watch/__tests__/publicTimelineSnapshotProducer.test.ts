import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __publicTimelineSnapshotProducerTestUtils,
  schedulePublicTimelineSnapshotRefresh,
} from "@/lib/watch/publicTimelineSnapshotProducer";

const waitUntilMock = vi.hoisted(() => vi.fn());
const withLockMock = vi.hoisted(() => vi.fn());
const buildWatchTimelinePayloadMock = vi.hoisted(() => vi.fn());
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
  buildWatchTimelinePayload: buildWatchTimelinePayloadMock,
}));

vi.mock("@/lib/watch/publicTimelineSnapshotStore", () => ({
  createEmptyPublicTimelineSnapshot: vi.fn(
    ({ locale, windowMinutes, page, pageSize, now, status, sourceHealth, events = [] }) => ({
      version: "snapshot-1",
      generatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 75 * 60_000).toISOString(),
      locale,
      windowMinutes,
      page,
      pageSize,
      totalCount: events.length,
      oldestTs: null,
      hasMore: false,
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
    publishPublicTimelineSnapshotMock.mockReset().mockResolvedValue({ ok: true });
    getSharedFollowStatsMock.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces burst writes and caps global snapshot rebuilds to 24 per day", async () => {
    await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });
    const burst = await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });

    expect(burst).toMatchObject({ ok: true, skipped: true, reason: "snapshot_refresh_deferred" });
    expect(withLockMock).toHaveBeenCalledTimes(1);

    for (let hour = 1; hour < 24; hour += 1) {
      vi.setSystemTime(now + hour * 60 * 60_000);
      await schedulePublicTimelineSnapshotRefresh("zh_CN", { reason: "record-write" });
    }

    expect(withLockMock).toHaveBeenCalledTimes(24);

    vi.setSystemTime(now + 24 * 60 * 60_000);
    const capped = await schedulePublicTimelineSnapshotRefresh("zh_CN", {
      reason: "record-write",
    });

    expect(capped).toMatchObject({ ok: true, skipped: true, reason: "snapshot_refresh_daily_cap" });
    expect(withLockMock).toHaveBeenCalledTimes(24);
  });
});
