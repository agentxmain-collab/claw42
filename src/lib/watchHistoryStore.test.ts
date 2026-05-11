import { describe, expect, test, beforeEach, vi } from "vitest";
import type { StreamEntry } from "@/modules/agent-watch/types";
import {
  __resetWatchHistoryForTests,
  appendWatchHistoryEntry,
  appendWatchEntry,
  getWatchHistory,
} from "./watchHistoryStore";

function entry(id: string, ts: number): StreamEntry {
  return {
    kind: "agent_message",
    id,
    ts,
    agentId: "alpha",
    content: id,
    triggerSignalId: id,
  };
}

describe("watchHistoryStore", () => {
  beforeEach(() => {
    __resetWatchHistoryForTests();
    vi.useRealTimers();
  });

  test("returns newest entries before a cursor", async () => {
    const now = Date.now();
    await appendWatchEntry(entry("old", now - 3_000));
    await appendWatchEntry(entry("middle", now - 2_000));
    await appendWatchEntry(entry("new", now - 1_000));

    const result = await getWatchHistory({ before: now, limit: 2 });

    expect(result.entries.map((item) => item.id)).toEqual(["new", "middle"]);
    expect(result.hasMore).toBe(true);
    expect(result.oldestTs).toBe(now - 2_000);
  });

  test("prunes entries older than 12 hours", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    await appendWatchEntry(entry("stale", now - 13 * 60 * 60 * 1000));
    await appendWatchEntry(entry("fresh", now - 60_000));

    const result = await getWatchHistory({ before: now, limit: 30 });

    expect(result.entries.map((item) => item.id)).toEqual(["fresh"]);
  });

  test("keeps at most 500 entries", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    for (let index = 0; index < 505; index++) {
      await appendWatchEntry(entry(`entry-${index}`, now - (505 - index) * 1000));
    }

    const result = await getWatchHistory({ before: now, limit: 100 });

    expect(result.entries).toHaveLength(100);
    expect(result.entries[0]?.id).toBe("entry-504");
  });

  test("windowMinutes limits the public history window", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    await appendWatchEntry(entry("outside", now - 90 * 60_000));
    await appendWatchEntry(entry("inside", now - 10 * 60_000));

    const result = await getWatchHistory({ before: now, limit: 30, windowMinutes: 60 });

    expect(result.entries.map((item) => item.id)).toEqual(["inside"]);
  });

  test("public append helper requires complete metadata", async () => {
    const now = Date.now();
    await expect(appendWatchHistoryEntry(entry("no-meta", now) as never)).rejects.toThrow(
      "watch history entry meta is required",
    );
    await appendWatchHistoryEntry({
      ...entry("with-meta", now),
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
      },
    });

    const result = await getWatchHistory({ before: now + 1, limit: 10 });
    expect(result.entries.map((item) => item.id)).toEqual(["with-meta"]);
  });

  test("keeps locale histories isolated with zh_CN as legacy default", async () => {
    const now = Date.now();
    await appendWatchHistoryEntry({
      ...entry("zh", now - 2),
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    await appendWatchHistoryEntry({
      ...entry("en", now - 1),
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "en_US",
      },
    });

    await expect(
      appendWatchHistoryEntry({
        ...entry("missing-locale", now),
        meta: {
          visibility: "public",
          importance: "high",
          sourceTrigger: "pm_decision",
          evidenceIds: [],
        } as never,
      }),
    ).rejects.toThrow("watch history entry meta is required");

    expect((await getWatchHistory({ before: now + 1, locale: "zh_CN" })).entries).toHaveLength(1);
    expect((await getWatchHistory({ before: now + 1, locale: "en_US" })).entries).toHaveLength(1);
    expect((await getWatchHistory({ before: now + 1 })).entries.map((item) => item.id)).toEqual([
      "zh",
    ]);
  });
});
