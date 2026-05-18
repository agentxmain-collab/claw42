import { describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  resolvePublicTimelineRecordCutoff,
} from "@/lib/watch/publicTimelinePayload";

describe("publicTimelinePayload", () => {
  it("keeps the public record backfill window at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 24 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });

  it("caps oversized public record backfill windows at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 48 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });
});
