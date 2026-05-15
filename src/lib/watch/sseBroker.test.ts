import { describe, expect, it, vi } from "vitest";
import type { PublicWatchTimelinePayload } from "@/lib/watch/publicTimelinePayload";
import { createWatchTimelineSseStream, encodeSseEvent } from "./sseBroker";

function timelinePayload(id: string, servedAt = 1000): PublicWatchTimelinePayload {
  return {
    events: [
      {
        id,
        ts: servedAt,
        locale: "zh_CN",
        importance: "high",
        sourceTrigger: "pm_decision",
        visibility: "public",
        evidenceIds: [],
        payload: {
          kind: "pm_decision",
          recordId: id,
          symbol: "BTC",
          rationaleByMember: {
            pm: "test rationale",
          },
        },
      },
    ],
    evidenceMap: {},
    oldestTs: servedAt,
    hasMore: false,
    windowMinutes: 60,
    locale: "zh_CN",
    servedAt,
    nextPollMs: 90_000,
  };
}

describe("sseBroker", () => {
  it("encodes timeline SSE messages with event id, retry, and JSON data", () => {
    const encoded = encodeSseEvent({
      event: "timeline",
      id: "1000",
      retryMs: 3000,
      data: timelinePayload("record-1"),
    });

    expect(encoded).toContain("id: 1000\n");
    expect(encoded).toContain("event: timeline\n");
    expect(encoded).toContain("retry: 3000\n");
    expect(encoded).toContain('"recordId":"record-1"');
    expect(encoded.endsWith("\n\n")).toBe(true);
  });

  it("sends an initial timeline payload when a stream is opened", async () => {
    const loadPayload = vi.fn(async () => timelinePayload("record-initial", 2000));
    const readVersion = vi.fn(async () => 2000);
    const stream = createWatchTimelineSseStream({
      loadPayload,
      readVersion,
      locale: "zh_CN",
      pollIntervalMs: 500,
      heartbeatMs: 10_000,
      maxDurationMs: 60_000,
    });
    const reader = stream.getReader();

    const chunk = await reader.read();
    await reader.cancel();

    expect(chunk.done).toBe(false);
    expect(new TextDecoder().decode(chunk.value)).toContain('"recordId":"record-initial"');
    expect(loadPayload).toHaveBeenCalledTimes(1);
    expect(readVersion).toHaveBeenCalledTimes(1);
  });
});
