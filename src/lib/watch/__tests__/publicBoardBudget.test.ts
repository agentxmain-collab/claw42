import { describe, expect, it } from "vitest";
import {
  estimatePublicBoardHardStopMonthlyBudget,
  estimatePublicBoardTrafficBudget,
} from "@/lib/watch/publicBoardBudget";

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

  it("proves the locked hard-stop monthly ceiling stays under the 500k Upstash plan", () => {
    const budget = estimatePublicBoardHardStopMonthlyBudget();

    expect(budget.pieces).toEqual({
      timelineCanonicalReads: 115_200,
      timelineSnapshotRebuilds: 199_440,
      publicCardWrites: 12_000,
      lowFrequencyPrune: 30_000,
      miscPublicEndpoints: 60_000,
    });
    expect(budget.total).toBe(416_640);
    expect(budget.total).toBeLessThan(500_000);
  });
});
