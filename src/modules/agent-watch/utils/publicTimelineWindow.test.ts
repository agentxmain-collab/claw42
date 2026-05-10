import { describe, expect, it } from "vitest";
import { fallbackBeforeForPublicTimeline } from "./publicTimelineWindow";

describe("fallbackBeforeForPublicTimeline", () => {
  it("uses now when primary public events are empty even if raw history has oldestTs", () => {
    expect(
      fallbackBeforeForPublicTimeline(
        {
          events: [],
        },
        1_700_000_000_000,
      ),
    ).toBe(1_700_000_000_000);
  });

  it("uses the oldest public event timestamp when public events exist", () => {
    expect(
      fallbackBeforeForPublicTimeline({
        events: [{ ts: 1_700_000_030_000 }, { ts: 1_700_000_010_000 }],
      }),
    ).toBe(1_700_000_010_000);
  });
});
