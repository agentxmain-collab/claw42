import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { GET } from "./route";

const readDecisionRecordsMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readDecisionRecords: readDecisionRecordsMock,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: rateLimitMock,
}));

function record(
  index: number,
  overrides: Partial<StrategyDecisionRecord> = {},
): StrategyDecisionRecord {
  const createdAt = new Date(Date.UTC(2026, 4, 15, 0, 0, index)).toISOString();
  return {
    id: `record-${index}`,
    schemaVersion: 2,
    recordVersion: 1,
    recordSource: "paper",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [
      {
        memberId: "chart_analyst",
        direction: index % 2 === 0 ? "long" : "short",
        confidence: 0.5 + (index % 5) * 0.08,
        rationale: `rationale ${index}`,
        evidenceIds: [`ev_${index}`],
      },
    ],
    sourceThreadId: null,
    tradeDecision: {
      id: `trade-${index}`,
      schemaVersion: 1,
      symbol: "BTC",
      generatedBy: "pm",
      generatedAt: createdAt,
      direction: index % 2 === 0 ? "long" : "short",
      entryType: "market",
      entryPrice: 100 + index,
      entryRange: { low: 99 + index, high: 101 + index },
      stopLoss: 95 + index,
      takeProfit: [105 + index, 110 + index],
      positionSizing: 0.1,
      timeHorizon: "intraday",
      rating: 4,
      confidence: 0.6 + (index % 4) * 0.07,
      evidenceIds: [`ev_${index}`],
      riskNote: "risk",
      invalidatesIf: "invalid",
      promptVersion: "test",
      modelProvider: "test",
      severity: "medium",
    },
    stageTrace: [],
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: index % 3 === 0 ? new Date(Date.UTC(2026, 4, 15, 1, 0, index)).toISOString() : null,
    resolvedOutcome: index % 3 === 0 ? "hit_tp" : null,
    promptVersion: "test",
    modelProvider: "test",
    ...overrides,
  };
}

describe("/api/watch/decision-history", () => {
  beforeEach(() => {
    readDecisionRecordsMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires a valid symbol", async () => {
    const response = await GET(new Request("https://claw42.ai/api/watch/decision-history"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_symbol" });
    expect(readDecisionRecordsMock).not.toHaveBeenCalled();
  });

  it("returns symbol-keyed decision history with pagination capped at 100", async () => {
    const records = Array.from({ length: 105 }, (_, index) => record(104 - index));
    readDecisionRecordsMock.mockResolvedValue(records);

    const response = await GET(
      new Request(
        "https://claw42.ai/api/watch/decision-history?symbol=BTCUSDT&limit=100&locale=zh_CN",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readDecisionRecordsMock).toHaveBeenCalledWith("BTC", 500, "zh_CN");
    expect(payload.symbol).toBe("BTC");
    expect(payload.items).toHaveLength(100);
    expect(payload.hasMore).toBe(true);
    expect(payload.nextBefore).toBe(payload.items[99].createdAt);
    expect(payload.items[0]).toMatchObject({
      recordId: "record-104",
      outcome: null,
      direction: "long",
    });
  });

  it("filters records before a cursor", async () => {
    const records = [record(3), record(2), record(1)];
    readDecisionRecordsMock.mockResolvedValue(records);

    const response = await GET(
      new Request(
        `https://claw42.ai/api/watch/decision-history?symbol=BTC&before=${encodeURIComponent(
          records[1]!.createdAt,
        )}`,
      ),
    );
    const payload = await response.json();

    expect(payload.items.map((item: { recordId: string }) => item.recordId)).toEqual(["record-1"]);
    expect(payload.hasMore).toBe(false);
  });
});
