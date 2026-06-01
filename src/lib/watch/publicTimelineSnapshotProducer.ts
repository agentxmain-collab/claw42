import { waitUntil } from "@vercel/functions";
import type { Locale } from "@/i18n/types";
import { withLock, LockBusyError } from "@/lib/storage/kv-lock";
import { getSharedFollowStats } from "@/lib/watch/followStatsStore";
import {
  buildWatchTimelinePagePairPayloads,
  buildWatchTimelinePageRangePayloads,
  buildWatchTimelinePayload,
  type PublicWatchTimelinePayload,
} from "@/lib/watch/publicTimelinePayload";
import {
  PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS,
  createEmptyPublicTimelineSnapshot,
  publicTimelineSnapshotLockKey,
  publishPublicTimelineSnapshot,
  type PublicTimelineSnapshotPayload,
} from "@/lib/watch/publicTimelineSnapshotStore";

export { publishPublicTimelineSnapshot } from "@/lib/watch/publicTimelineSnapshotStore";

export const PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_WINDOW_MINUTES = 60;
export const PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE = 1;
export const PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE = 15;
export const PUBLIC_TIMELINE_SNAPSHOT_MAX_REBUILDS_PER_DAY = 24;
export const PUBLIC_TIMELINE_SNAPSHOT_MIN_REBUILD_INTERVAL_MS = 60 * 60_000;
export const PUBLIC_TIMELINE_SNAPSHOT_CANONICAL_PAGES = [1, 2] as const;
export const PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES = [3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const PUBLIC_TIMELINE_SNAPSHOT_COLD_REBUILD_INTERVAL_MS = 24 * 60 * 60_000;
export const PUBLIC_TIMELINE_SNAPSHOT_COLD_ESTIMATED_COMMANDS_PER_PAGE = 138.5;

const pendingRefreshes = new Map<string, Promise<unknown>>();
const rebuildStartedAt: number[] = [];
const coldRebuildStartedAt: number[] = [];

export function buildPublicTimelineSnapshotFromPayload(
  payload: PublicWatchTimelinePayload,
  {
    now = Date.now(),
    status = payload.events.length > 0 ? "fresh" : "empty",
    sourceHealth = { state: "ok", generatedFrom: "public-timeline-source" },
  }: {
    now?: number;
    status?: PublicTimelineSnapshotPayload["snapshotStatus"];
    sourceHealth?: PublicTimelineSnapshotPayload["sourceHealth"];
  } = {},
): PublicTimelineSnapshotPayload {
  return {
    ...createEmptyPublicTimelineSnapshot({
      locale: payload.locale,
      windowMinutes: payload.windowMinutes,
      page: payload.page ?? PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE,
      pageSize:
        payload.pageSize ??
        (payload.events.length > 0
          ? payload.events.length
          : PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE),
      now,
      status,
      sourceHealth,
      events: payload.events,
      evidenceMap: payload.evidenceMap,
      oldestTs: payload.oldestTs,
      hasMore: payload.hasMore,
      totalCount: payload.totalCount ?? payload.events.length,
      nextPollMs: payload.nextPollMs,
      residentStatus: payload.residentStatus,
      followStats: payload.followStats,
    }),
  };
}

export async function rebuildPublicTimelineSnapshot({
  locale,
  windowMinutes = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_WINDOW_MINUTES,
  page = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE,
  pageSize = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE,
  now = Date.now(),
}: {
  locale: Locale;
  windowMinutes?: number;
  page?: number;
  pageSize?: number;
  now?: number;
}) {
  try {
    return await withLock(
      publicTimelineSnapshotLockKey(locale, windowMinutes, page),
      async () => {
        const payload = (await buildWatchTimelinePayload({
          mode: "public",
          locale,
          before: now,
          limit: pageSize,
          page,
          pageSize,
          windowMinutes,
          servedAt: now,
        })) as PublicWatchTimelinePayload;
        const withCounts = await attachSharedFollowStats(payload);
        const snapshot = buildPublicTimelineSnapshotFromPayload(withCounts, {
          now,
          status: withCounts.events.length > 0 ? "fresh" : "empty",
          sourceHealth: {
            state: "ok",
            generatedFrom: "producer",
            estimatedKvCommands: 45,
          },
        });
        const publish = await publishPublicTimelineSnapshot(snapshot);
        return { ok: publish.ok, publish, snapshot };
      },
      { ttlMs: 45_000, waitMs: 0 },
    );
  } catch (error) {
    if (error instanceof LockBusyError) {
      return { ok: true, skipped: true, reason: "snapshot_refresh_already_running" };
    }
    throw error;
  }
}

export async function rebuildPublicTimelineSnapshotPagePair({
  locale,
  windowMinutes = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_WINDOW_MINUTES,
  pageSize = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE,
  now = Date.now(),
}: {
  locale: Locale;
  windowMinutes?: number;
  pageSize?: number;
  now?: number;
}) {
  try {
    return await withLock(
      publicTimelineSnapshotLockKey(locale, windowMinutes, PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE),
      async () => {
        const payloads = await buildWatchTimelinePagePairPayloads({
          locale,
          before: now,
          limit: pageSize * PUBLIC_TIMELINE_SNAPSHOT_CANONICAL_PAGES.length,
          pageSize,
          windowMinutes,
          servedAt: now,
          pages: PUBLIC_TIMELINE_SNAPSHOT_CANONICAL_PAGES,
        });
        const withCounts = await attachSharedFollowStatsToPayloads(payloads);
        const snapshots = withCounts.map((payload) =>
          buildPublicTimelineSnapshotFromPayload(payload, {
            now,
            status: payload.events.length > 0 ? "fresh" : "empty",
            sourceHealth: {
              state: "ok",
              generatedFrom: "producer-page-pair",
              estimatedKvCommands: 277,
            },
          }),
        );
        const publishes = await Promise.all(
          snapshots.map((snapshot) => publishPublicTimelineSnapshot(snapshot)),
        );
        return {
          ok: publishes.every((publish) => publish.ok),
          publish: publishes[0] ?? { ok: false, error: "snapshot_publish_missing" },
          publishes,
          snapshots,
        };
      },
      { ttlMs: 45_000, waitMs: 0 },
    );
  } catch (error) {
    if (error instanceof LockBusyError) {
      return { ok: true, skipped: true, reason: "snapshot_refresh_already_running" };
    }
    throw error;
  }
}

export async function rebuildPublicTimelineColdSnapshots(
  locale: Locale,
  {
    reason,
    windowMinutes = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_WINDOW_MINUTES,
    pageSize = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE,
    now = Date.now(),
  }: {
    reason: string;
    windowMinutes?: number;
    pageSize?: number;
    now?: number;
  },
) {
  try {
    return await withLock(
      publicTimelineSnapshotLockKey(locale, windowMinutes, PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES[0]),
      async () => {
        void reason;
        const payloads = await buildWatchTimelinePageRangePayloads({
          locale,
          before: now,
          limit: pageSize * PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES.length,
          pageSize,
          windowMinutes,
          servedAt: now,
          pages: PUBLIC_TIMELINE_SNAPSHOT_COLD_PAGES,
        });
        const withCounts = await attachSharedFollowStatsToPayloads(payloads);
        const snapshots = withCounts.map((payload) =>
          buildPublicTimelineSnapshotFromPayload(payload, {
            now,
            status: payload.events.length > 0 ? "fresh" : "empty",
            sourceHealth: {
              state: "ok",
              generatedFrom: "producer-cold-page-range",
              estimatedKvCommands: PUBLIC_TIMELINE_SNAPSHOT_COLD_ESTIMATED_COMMANDS_PER_PAGE,
            },
          }),
        );
        const publishes = await Promise.all(
          snapshots.map((snapshot) =>
            publishPublicTimelineSnapshot(snapshot, {
              currentTtlSeconds: PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS,
            }),
          ),
        );
        return {
          ok: publishes.every((publish) => publish.ok),
          publish: publishes[0] ?? { ok: false, error: "snapshot_publish_missing" },
          publishes,
          snapshots,
        };
      },
      { ttlMs: 45_000, waitMs: 0 },
    );
  } catch (error) {
    if (error instanceof LockBusyError) {
      return { ok: true, skipped: true, reason: "snapshot_refresh_already_running" };
    }
    throw error;
  }
}

export function schedulePublicTimelineSnapshotRefresh(
  locale: Locale,
  {
    reason,
    windowMinutes = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_WINDOW_MINUTES,
    pageSize = PUBLIC_TIMELINE_SNAPSHOT_DEFAULT_PAGE_SIZE,
  }: {
    reason: string;
    windowMinutes?: number;
    pageSize?: number;
  },
) {
  const key = `${locale}:${windowMinutes}:canonical-page-pair:${pageSize}`;
  const existing = pendingRefreshes.get(key);
  if (existing) return existing;

  const now = Date.now();
  const gate = claimGlobalSnapshotRebuildSlot(now);
  if (!gate.allowed) {
    return Promise.resolve({ ok: true, skipped: true, reason: gate.reason });
  }
  const coldGate = claimColdSnapshotRebuildSlot(now);

  const task = rebuildPublicTimelineSnapshotPagePair({
    locale,
    windowMinutes,
    pageSize,
  })
    .then(async (result) => {
      if (coldGate.allowed) {
        await rebuildPublicTimelineColdSnapshots(locale, {
          reason,
          windowMinutes,
          pageSize,
          now,
        });
      }
      return result;
    })
    .catch((error) => {
      console.warn("[claw42] public timeline snapshot refresh failed", {
        locale,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    })
    .finally(() => {
      pendingRefreshes.delete(key);
    });
  pendingRefreshes.set(key, task);

  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    try {
      waitUntil(task);
    } catch {
      // Local/test runtimes can reject waitUntil registration; the task is already running.
    }
  }
  return task;
}

function claimGlobalSnapshotRebuildSlot(now: number) {
  const windowStart = now - 24 * 60 * 60_000;
  for (let index = rebuildStartedAt.length - 1; index >= 0; index -= 1) {
    if (rebuildStartedAt[index] < windowStart) rebuildStartedAt.splice(index, 1);
  }
  const latest = rebuildStartedAt.at(-1);
  if (latest !== undefined && now - latest < PUBLIC_TIMELINE_SNAPSHOT_MIN_REBUILD_INTERVAL_MS) {
    return { allowed: false as const, reason: "snapshot_refresh_deferred" };
  }
  if (rebuildStartedAt.length >= PUBLIC_TIMELINE_SNAPSHOT_MAX_REBUILDS_PER_DAY) {
    return { allowed: false as const, reason: "snapshot_refresh_daily_cap" };
  }
  rebuildStartedAt.push(now);
  return { allowed: true as const };
}

function claimColdSnapshotRebuildSlot(now: number) {
  const windowStart = now - PUBLIC_TIMELINE_SNAPSHOT_COLD_REBUILD_INTERVAL_MS;
  for (let index = coldRebuildStartedAt.length - 1; index >= 0; index -= 1) {
    if (coldRebuildStartedAt[index] < windowStart) coldRebuildStartedAt.splice(index, 1);
  }
  const latest = coldRebuildStartedAt.at(-1);
  if (latest !== undefined && now - latest < PUBLIC_TIMELINE_SNAPSHOT_COLD_REBUILD_INTERVAL_MS) {
    return { allowed: false as const, reason: "snapshot_cold_refresh_deferred" };
  }
  coldRebuildStartedAt.push(now);
  return { allowed: true as const };
}

async function attachSharedFollowStats(payload: PublicWatchTimelinePayload) {
  const recordIds = Array.from(
    new Set(
      payload.events.flatMap((event) =>
        event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
      ),
    ),
  );
  if (recordIds.length === 0) return payload;
  const followStats = await getSharedFollowStats(recordIds).catch(() => ({}));
  return {
    ...payload,
    followStats,
  };
}

async function attachSharedFollowStatsToPayloads(payloads: PublicWatchTimelinePayload[]) {
  const recordIds = Array.from(
    new Set(
      payloads.flatMap((payload) =>
        payload.events.flatMap((event) =>
          event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
        ),
      ),
    ),
  );
  if (recordIds.length === 0) return payloads;
  const followStats: NonNullable<PublicWatchTimelinePayload["followStats"]> =
    await getSharedFollowStats(recordIds).catch(() => ({}));
  return payloads.map((payload) => ({
    ...payload,
    followStats: Object.fromEntries(
      payload.events.flatMap((event) =>
        event.payload.kind === "pm_decision" && followStats[event.payload.recordId]
          ? [[event.payload.recordId, followStats[event.payload.recordId]]]
          : [],
      ),
    ),
  }));
}

export const __publicTimelineSnapshotProducerTestUtils = {
  reset() {
    pendingRefreshes.clear();
    rebuildStartedAt.length = 0;
    coldRebuildStartedAt.length = 0;
  },
  rebuildStartedAt() {
    return [...rebuildStartedAt];
  },
  coldRebuildStartedAt() {
    return [...coldRebuildStartedAt];
  },
};
