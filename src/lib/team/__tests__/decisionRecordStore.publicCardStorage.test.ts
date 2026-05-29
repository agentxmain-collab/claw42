import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const kvMock = vi.hoisted(() => ({
  lpush: vi.fn(),
  ltrim: vi.fn(),
  sadd: vi.fn(),
  lrange: vi.fn(),
  lrem: vi.fn(),
}));
const persistDecisionRecordDirectMock = vi.hoisted(() => vi.fn());
const writePublicCardIndexEntryMock = vi.hoisted(() => vi.fn());
const writePublicCardIndexFailureMarkerMock = vi.hoisted(() => vi.fn());
const cleanupPublicCardIndexMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv-shim", () => ({
  kv: kvMock,
}));

vi.mock("@/lib/team/decisionRecordDirectStore", () => ({
  decisionRecordDirectKey: (locale: string, id: string) =>
    `claw42:strategy:record-by-id:v1:${locale}:${id}`,
  persistDecisionRecordDirect: persistDecisionRecordDirectMock,
}));

vi.mock("@/lib/watch/publicCardIndex", () => ({
  cleanupPublicCardIndex: cleanupPublicCardIndexMock,
  writePublicCardIndexEntry: writePublicCardIndexEntryMock,
  writePublicCardIndexFailureMarker: writePublicCardIndexFailureMarkerMock,
}));

describe("decisionRecordStore public card storage failures", () => {
  beforeEach(() => {
    vi.stubEnv("USE_PERSISTENT_KV", "true");
    vi.stubEnv("KV_REST_API_URL", "https://example.test");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    kvMock.lpush.mockReset().mockResolvedValue(1);
    kvMock.ltrim.mockReset().mockResolvedValue("OK");
    kvMock.sadd.mockReset().mockResolvedValue(1);
    kvMock.lrange.mockReset().mockResolvedValue([]);
    kvMock.lrem.mockReset().mockResolvedValue(0);
    persistDecisionRecordDirectMock.mockReset().mockResolvedValue(null);
    writePublicCardIndexEntryMock.mockReset().mockRejectedValue(new Error("zadd down"));
    writePublicCardIndexFailureMarkerMock.mockReset().mockResolvedValue(null);
    cleanupPublicCardIndexMock.mockReset().mockResolvedValue({
      removedByAge: 0,
      removedByCap: 0,
      removedByNonStrategy: 0,
      count: 0,
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the raw record write and marks public index write failures", async () => {
    const { appendDecisionRecord, getLastDecisionRecordWriteDiagnostics } =
      await import("@/lib/team/decisionRecordStore");

    await appendDecisionRecord(record());

    expect(kvMock.lpush).toHaveBeenCalledWith(
      "claw42:strategy:records:v1:zh_CN:BTC",
      expect.stringContaining('"id":"record-1"'),
    );
    expect(writePublicCardIndexFailureMarkerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "record-1",
        locale: "zh_CN",
        symbol: "BTC",
        stage: "public-card-index",
        error: "Error: zadd down",
      }),
    );
    expect(getLastDecisionRecordWriteDiagnostics()).toMatchObject({
      storageMode: "persistent",
      publicCardStorageFailures: [{ stage: "public-card-index", error: "Error: zadd down" }],
    });
  });
});

function record(): StrategyDecisionRecord {
  return {
    id: "record-1",
    schemaVersion: 1,
    recordSource: "paper",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: "2026-05-28T07:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "test",
  };
}
