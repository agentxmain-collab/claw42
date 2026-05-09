import { describe, expect, test } from "vitest";
import type { FactionId, StrategyReplay } from "@/lib/types";
import { replayToDecisionRecord } from "@/lib/strategyHistory";

describe("replayToDecisionRecord", () => {
  test.each<FactionId>(["alpha", "beta", "gamma"])(
    "keeps legacy faction %s tagged without converting it into a new team member",
    (legacyFactionId) => {
      const record = replayToDecisionRecord(makeReplay(legacyFactionId));

      expect(record.recordSource).toBe("legacy");
      expect(record.decisionOwnerId).toBe("legacy");
      expect(record.legacyFactionId).toBe(legacyFactionId);
      expect(record.contributorIds).toEqual([]);
      expect(record.analystInputs).toEqual([]);
      expect(record.schemaVersion).toBe(1);
    },
  );
});

function makeReplay(legacyFactionId: FactionId): StrategyReplay {
  return {
    strategyId: `strategy-${legacyFactionId}`,
    debateId: "debate-1",
    symbol: "btc",
    direction: "long",
    openedAt: Date.UTC(2026, 4, 10, 0, 0, 0),
    evaluatedAt: Date.UTC(2026, 4, 10, 1, 0, 0),
    entryPrice: 100,
    exitPrice: 110,
    pnlPct: 10,
    isWin: true,
    legacyFactionId,
  };
}
