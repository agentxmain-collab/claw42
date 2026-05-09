import { describe, expect, test, beforeEach, vi } from "vitest";
import type { StreamEntry } from "@/modules/agent-watch/types";
import {
  __resetWatchHistoryForTests,
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
});
