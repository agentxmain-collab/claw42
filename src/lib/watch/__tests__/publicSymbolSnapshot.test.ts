import { describe, expect, it } from "vitest";
import {
  getPublicSymbolSnapshot,
  normalizeSnapshotSymbol,
  type PublicSymbolSnapshotOptions,
} from "../publicSymbolSnapshot";
import type { PublicWatchTimelinePayload } from "../publicTimelinePayload";

const payload: PublicWatchTimelinePayload = {
  events: [
    {
      id: "pm:btc:1",
      ts: Date.parse("2026-05-21T12:00:00.000Z"),
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      payload: {
        kind: "pm_decision",
        recordId: "record-1",
        symbol: "BTC",
        candidateType: "symbol",
        candidateKey: "symbol:BTC",
        executable: true,
        analysisSummary: "BTC public summary",
        rounds: [
          {
            round: 1,
            agentId: "pa_01",
            confidence: 0.72,
            rationale: "public rationale",
          },
        ],
      },
    },
  ],
  evidenceMap: {},
  oldestTs: null,
  hasMore: false,
  windowMinutes: 1440,
  locale: "zh_CN",
  servedAt: Date.parse("2026-05-21T12:00:00.000Z"),
  nextPollMs: 90_000,
};

function withPayload(): PublicSymbolSnapshotOptions {
  return { payload };
}

describe("public symbol snapshot", () => {
  it("derives a whitelisted snapshot from public timeline payload", async () => {
    await expect(getPublicSymbolSnapshot("$btc", "zh_CN", withPayload())).resolves.toEqual({
      symbol: "BTC",
      summary: "BTC public summary",
      signal_strength: "high",
      updated_at: "2026-05-21T12:00:00.000Z",
      lang: "zh_CN",
    });
  });

  it("returns null for invalid or unavailable symbols", async () => {
    expect(normalizeSnapshotSymbol("bad symbol")).toBeNull();
    await expect(getPublicSymbolSnapshot("ETH", "zh_CN", withPayload())).resolves.toBeNull();
  });
});
