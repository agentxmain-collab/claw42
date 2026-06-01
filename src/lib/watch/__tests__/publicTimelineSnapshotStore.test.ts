import { describe, expect, it, vi } from "vitest";
import type { PublicWatchTimelinePayload } from "@/lib/watch/publicTimelinePayload";
import {
  createEmptyPublicTimelineSnapshot,
  PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS,
  PUBLIC_TIMELINE_SNAPSHOT_TTL_SECONDS,
  publicTimelineSnapshotBlobKey,
  publicTimelineSnapshotCurrentKey,
  publicTimelineSnapshotLastGoodKey,
  publishPublicTimelineSnapshot,
  readPublicTimelineSnapshot,
} from "@/lib/watch/publicTimelineSnapshotStore";

class MemorySnapshotClient {
  values = new Map<string, string>();
  getCalls: string[] = [];
  setCalls: Array<{ key: string; value: string; options?: { ex?: number; px?: number } }> = [];
  failGet = false;
  failKeys = new Set<string>();

  async get<T = unknown>(key: string): Promise<T | null> {
    this.getCalls.push(key);
    if (this.failGet || this.failKeys.has(key)) throw new Error("kv quota exhausted");
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: string, options?: { ex?: number; px?: number }) {
    this.setCalls.push({ key, value, options });
    this.values.set(key, value);
    return "OK";
  }

  async del(key: string) {
    this.values.delete(key);
    return 1;
  }
}

describe("publicTimelineSnapshotStore", () => {
  it("publishes a versioned blob before moving the current and last-good pointers", async () => {
    const client = new MemorySnapshotClient();
    const snapshot = snapshotPayload({
      generatedAt: "2026-05-31T05:00:00.000Z",
      events: [],
    });

    const result = await publishPublicTimelineSnapshot(snapshot, { client });
    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:00:30.000Z"),
      client,
    });

    expect(result.ok).toBe(true);
    expect(client.setCalls.map((call) => call.key)).toEqual([
      publicTimelineSnapshotBlobKey("zh_CN", 60, 1, snapshot.version),
      publicTimelineSnapshotCurrentKey("zh_CN", 60, 1),
      publicTimelineSnapshotLastGoodKey("zh_CN", 60, 1),
    ]);
    expect(read.payload.snapshotStatus).toBe("fresh");
    expect(read.payload.generatedAt).toBe(snapshot.generatedAt);
    expect(read.source).toBe("current");
  });

  it("keeps the current pointer alive across hourly rebuild cadence for two-command reads", async () => {
    const client = new MemorySnapshotClient();
    const snapshot = snapshotPayload({
      generatedAt: "2026-05-31T05:00:00.000Z",
      events: [],
    });

    await publishPublicTimelineSnapshot(snapshot, { client });

    expect(PUBLIC_TIMELINE_SNAPSHOT_TTL_SECONDS).toBeGreaterThanOrEqual(75 * 60);
    expect(
      client.setCalls.find((call) => call.key === publicTimelineSnapshotCurrentKey("zh_CN", 60, 1))
        ?.options?.ex,
    ).toBeGreaterThanOrEqual(75 * 60);
  });

  it("keeps cold current pointers alive for thirty hours and reads current snapshots in two commands", async () => {
    const client = new MemorySnapshotClient();
    const snapshot = snapshotPayload({
      page: 11,
      generatedAt: "2026-05-31T05:00:00.000Z",
      events: [],
    });

    await publishPublicTimelineSnapshot(snapshot, {
      client,
      currentTtlSeconds: PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS,
    });
    client.getCalls.length = 0;

    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 11,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:00:30.000Z"),
      client,
    });

    expect(PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS).toBe(30 * 60 * 60);
    expect(
      client.setCalls.find((call) => call.key === publicTimelineSnapshotCurrentKey("zh_CN", 60, 11))
        ?.options?.ex,
    ).toBe(PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS);
    expect(read.source).toBe("current");
    expect(client.getCalls).toHaveLength(2);
  });

  it("counts the last-good path as three KV reads when the current pointer is missing", async () => {
    const client = new MemorySnapshotClient();
    const lastGood = snapshotPayload({
      page: 11,
      version: "2026-05-31T04:50:00.000Z:lg",
      generatedAt: "2026-05-31T04:50:00.000Z",
      events: [],
    });
    await publishPublicTimelineSnapshot(lastGood, {
      client,
      currentTtlSeconds: PUBLIC_TIMELINE_COLD_SNAPSHOT_TTL_SECONDS,
    });
    await client.del(publicTimelineSnapshotCurrentKey("zh_CN", 60, 11));
    client.getCalls.length = 0;

    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 11,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:01:00.000Z"),
      client,
    });

    expect(read.source).toBe("last-good");
    expect(client.getCalls).toHaveLength(3);
  });

  it("keeps serving last-good when the current pointer targets a missing blob", async () => {
    const client = new MemorySnapshotClient();
    const lastGood = snapshotPayload({
      version: "2026-05-31T04:50:00.000Z:lg",
      generatedAt: "2026-05-31T04:50:00.000Z",
      events: [],
    });
    await publishPublicTimelineSnapshot(lastGood, { client });
    await client.set(
      publicTimelineSnapshotCurrentKey("zh_CN", 60, 1),
      JSON.stringify({
        version: "2026-05-31T05:00:00.000Z:missing",
        snapshotKey: publicTimelineSnapshotBlobKey("zh_CN", 60, 1, "missing"),
        generatedAt: "2026-05-31T05:00:00.000Z",
        expiresAt: "2026-05-31T05:05:00.000Z",
        sourceHealth: { state: "ok" },
      }),
    );

    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:01:00.000Z"),
      client,
    });

    expect(read.source).toBe("last-good");
    expect(read.payload.generatedAt).toBe(lastGood.generatedAt);
    expect(read.payload.snapshotStatus).toBe("stale");
  });

  it("returns a degraded empty snapshot instead of throwing on storage errors", async () => {
    const client = new MemorySnapshotClient();
    client.failGet = true;

    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:00:00.000Z"),
      client,
    });

    expect(read.source).toBe("empty");
    expect(read.storageError).toBe(true);
    expect(read.payload.snapshotStatus).toBe("degraded");
    expect(read.payload.events).toEqual([]);
  });

  it("serves last-good when the current blob read has a storage error", async () => {
    const client = new MemorySnapshotClient();
    const lastGood = snapshotPayload({
      version: "2026-05-31T04:50:00.000Z:lg",
      generatedAt: "2026-05-31T04:50:00.000Z",
      events: [],
    });
    await publishPublicTimelineSnapshot(lastGood, { client });
    const brokenKey = publicTimelineSnapshotBlobKey("zh_CN", 60, 1, "broken");
    await client.set(
      publicTimelineSnapshotCurrentKey("zh_CN", 60, 1),
      JSON.stringify({
        version: "broken",
        snapshotKey: brokenKey,
        generatedAt: "2026-05-31T05:00:00.000Z",
        expiresAt: "2026-05-31T05:05:00.000Z",
        sourceHealth: { state: "ok" },
      }),
    );
    client.failKeys.add(brokenKey);

    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:01:00.000Z"),
      client,
    });

    expect(read.source).toBe("last-good");
    expect(read.payload.version).toBe(lastGood.version);
    expect(read.payload.snapshotStatus).toBe("stale");
    expect(read.payload.sourceHealth.reason).toBe("current_storage_error");
  });

  it("rejects oversize blobs without advancing the current pointer", async () => {
    const client = new MemorySnapshotClient();
    const existing = snapshotPayload({
      version: "2026-05-31T04:50:00.000Z:ok",
      generatedAt: "2026-05-31T04:50:00.000Z",
      events: [],
    });
    await publishPublicTimelineSnapshot(existing, { client });
    const huge = snapshotPayload({
      version: "2026-05-31T05:00:00.000Z:huge",
      generatedAt: "2026-05-31T05:00:00.000Z",
      events: [],
    });
    huge.evidenceMap = { giant: { id: "giant", url: "x".repeat(2000) } as never };

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await publishPublicTimelineSnapshot(huge, {
      client,
      maxBytes: 500,
    });
    warn.mockRestore();
    const read = await readPublicTimelineSnapshot({
      locale: "zh_CN",
      windowMinutes: 60,
      page: 1,
      pageSize: 15,
      now: Date.parse("2026-05-31T05:00:00.000Z"),
      client,
    });

    expect(result.ok).toBe(false);
    expect(read.payload.version).toBe(existing.version);
  });
});

function snapshotPayload(
  overrides: Partial<PublicWatchTimelinePayload> & {
    version?: string;
    generatedAt: string;
  },
) {
  return createEmptyPublicTimelineSnapshot({
    locale: "zh_CN",
    windowMinutes: 60,
    page: 1,
    pageSize: 15,
    now: Date.parse(overrides.generatedAt),
    version: overrides.version,
    status: "fresh",
    sourceHealth: { state: "ok" },
    ...overrides,
  });
}
