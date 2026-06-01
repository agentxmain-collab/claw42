import { describe, expect, it } from "vitest";
import {
  estimatePublicBoardHardStopMonthlyBudget,
  estimatePublicBoardTrafficBudget,
} from "@/lib/watch/publicBoardBudget";
import { PUBLIC_BOARD_HARDSTOP_MONTHLY_COMMAND_LIMIT } from "@/lib/watch/publicBoardKvBudgetGuard";

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
      hotTimelineReadsRebuildsAndFixed: 416_640,
      coldTimelineReadsAndRebuilds: 58_995,
    });
    expect(budget.total).toBe(475_635);
    expect(PUBLIC_BOARD_HARDSTOP_MONTHLY_COMMAND_LIMIT).toBe(475_635);
    expect(budget.total).toBeLessThan(500_000);
    expect(500_000 - budget.total).toBe(24_365);
  });
});
