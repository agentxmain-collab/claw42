import { describe, expect, it } from "vitest";
import { filterPublicTimelineEvents, projectStreamEntryToPublic } from "@/lib/watch/publicTimelineProjection";
import type { StreamEntry } from "@/modules/agent-watch/types";

const now = Date.now();

function focusEntry(overrides: Partial<StreamEntry> = {}): StreamEntry {
  return {
    kind: "focus_event",
    id: "focus-1",
    ts: now,
    symbol: "BTC",
    signalType: "breakout",
    severity: "alert",
    description: "BTC breakout",
    primaryResponse: { agentId: "alpha", content: "legacy", symbol: "BTC" },
    ...overrides,
  } as StreamEntry;
}

describe("publicTimelineProjection", () => {
  it("projects public high market signals", () => {
    const event = projectStreamEntryToPublic(focusEntry());
    expect(event?.payload.kind).toBe("market_signal");
    expect(event?.visibility).toBe("public");
    expect(event?.importance).toBe("high");
  });

  it("filters debug entries from public mode", () => {
    const event = projectStreamEntryToPublic(
      focusEntry({ meta: { visibility: "debug", importance: "critical", sourceTrigger: "market_signal", evidenceIds: [] } }),
    );
    expect(event).toBeNull();
  });

  it("filters low and medium entries from public mode", () => {
    const low = focusEntry({
      id: "low",
      meta: { visibility: "public", importance: "low", sourceTrigger: "market_signal", evidenceIds: [] },
    });
    const medium = focusEntry({
      id: "medium",
      meta: { visibility: "public", importance: "medium", sourceTrigger: "market_signal", evidenceIds: [] },
    });
    expect(filterPublicTimelineEvents([low, medium], { mode: "public" })).toHaveLength(0);
  });

  it("does not project ambient chat-like entries", () => {
    const entry: StreamEntry = {
      kind: "watch_update",
      id: "watch-1",
      ts: now,
      updateType: "quiet_observation",
      title: "Quiet",
      content: "wait",
      dedupeKey: "quiet",
      severity: "neutral",
      meta: { visibility: "public", importance: "critical", sourceTrigger: "fallback", evidenceIds: [] },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("does not project chat_thread without pm decision provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-1",
      ts: now,
      thread: {
        id: "thread-1",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: { visibility: "public", importance: "critical", sourceTrigger: "pm_decision", evidenceIds: [] },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("projects pm decision threads with record provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-2",
      ts: now,
      thread: {
        id: "thread-2",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        recordId: "record-1",
      },
    };
    const event = projectStreamEntryToPublic(entry);
    expect(event?.payload.kind).toBe("pm_decision");
    expect(event?.evidenceIds).toEqual(["ev_1"]);
  });
});
