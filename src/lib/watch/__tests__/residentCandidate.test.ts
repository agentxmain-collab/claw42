import { describe, expect, it } from "vitest";
import {
  hotspotDecisionCandidate,
  marketOverviewCandidate,
  utcDayKey,
  utcHourWindowKey,
} from "@/lib/watch/residentCandidate";

describe("resident candidate UTC cadence keys", () => {
  it("uses UTC day keys without shifting to UTC+8", () => {
    const lateUtc = Date.parse("2026-05-15T23:30:00.000Z");

    expect(utcDayKey(lateUtc)).toBe("2026-05-15");
    expect(marketOverviewCandidate({ locale: "zh_CN", now: lateUtc }).candidateKey).toBe(
      "market_overview:utc:zh_CN:2026-05-15T18",
    );
  });

  it("uses UTC 3-hour hotspot windows", () => {
    const lateUtc = Date.parse("2026-05-15T23:30:00.000Z");

    expect(utcHourWindowKey(lateUtc, 3)).toBe("2026-05-15T21");
    expect(hotspotDecisionCandidate({ locale: "zh_CN", now: lateUtc }).candidateKey).toBe(
      "hotspot:utc:zh_CN:2026-05-15T21:market",
    );
  });
});
