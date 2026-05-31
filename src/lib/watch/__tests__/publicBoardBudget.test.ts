import { describe, expect, it } from "vitest";
import { estimatePublicBoardTrafficBudget } from "@/lib/watch/publicBoardBudget";

describe("publicBoardBudget", () => {
  it("keeps shared snapshot KV reads flat as viewer count grows", () => {
    const oneViewer = estimatePublicBoardTrafficBudget({
      viewerCount: 1,
      cacheMissesPerMinute: 1,
      snapshotWritesPerMinute: 1,
    });
    const fiveHundredViewers = estimatePublicBoardTrafficBudget({
      viewerCount: 500,
      cacheMissesPerMinute: 1,
      snapshotWritesPerMinute: 1,
    });

    expect(fiveHundredViewers.snapshot.kvCommandsPerMinute).toBe(
      oneViewer.snapshot.kvCommandsPerMinute,
    );
    expect(fiveHundredViewers.legacy.kvCommandsPerMinute).toBeGreaterThan(
      oneViewer.legacy.kvCommandsPerMinute,
    );
  });
});
