import { describe, expect, it } from "vitest";
import {
  calculateDecisionFreshnessStatus,
  isDecisionFreshEnoughForTrade,
} from "../freshnessStatus";

const now = Date.parse("2026-05-22T12:00:00.000Z");

describe("decision freshness status", () => {
  it("classifies fresh, aging, stale, and expired records by age", () => {
    expect(calculateDecisionFreshnessStatus(now - 30 * 60_000, now)?.level).toBe("fresh");
    expect(calculateDecisionFreshnessStatus(now - 2 * 60 * 60_000, now)?.level).toBe("aging");
    expect(calculateDecisionFreshnessStatus(now - 7 * 60 * 60_000, now)?.level).toBe("stale");
    expect(calculateDecisionFreshnessStatus(now - 25 * 60 * 60_000, now)?.level).toBe(
      "expired",
    );
  });

  it("blocks trade entry once the public decision is stale", () => {
    expect(isDecisionFreshEnoughForTrade({ level: "fresh" } as never)).toBe(true);
    expect(isDecisionFreshEnoughForTrade({ level: "aging" } as never)).toBe(true);
    expect(isDecisionFreshEnoughForTrade({ level: "stale" } as never)).toBe(false);
    expect(isDecisionFreshEnoughForTrade({ level: "expired" } as never)).toBe(false);
  });

  it("returns null for invalid timestamps instead of inventing freshness", () => {
    expect(calculateDecisionFreshnessStatus("not-a-date", now)).toBeNull();
  });
});
