import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateTradeDecision, type TradeDecision } from "@/lib/team/tradeDecision";
import {
  generateTradeDecision,
  resolvePMProviderSelection,
} from "@/lib/team/tradeDecisionPromptBuilder";

const callWithChainMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/providers", () => ({
  callWithChain: callWithChainMock,
}));

const CURRENT_PRICE = 100;

describe("validateTradeDecision", () => {
  it("accepts a complete long decision", () => {
    const result = validateTradeDecision(makeDecision(), CURRENT_PRICE);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.decision.symbol).toBe("BTC");
      expect(result.decision.takeProfit).toEqual([106, 112]);
    }
  });

  it("rejects long stopLoss above entry", () => {
    expectInvalid(makeDecision({ stopLoss: 101 }), "long stopLoss must be below entryPrice");
  });

  it("rejects long takeProfit below entry", () => {
    expectInvalid(makeDecision({ takeProfit: [98] }), "profitable side");
  });

  it("rejects non-monotonic long takeProfit", () => {
    expectInvalid(makeDecision({ takeProfit: [112, 106] }), "strictly increasing");
  });

  it("accepts a complete short decision", () => {
    const result = validateTradeDecision(
      makeDecision({
        direction: "short",
        entryType: "pullback",
        stopLoss: 105,
        takeProfit: [94, 88],
        rating: 2,
      }),
      CURRENT_PRICE,
    );

    expect(result.valid).toBe(true);
  });

  it("rejects short stopLoss below entry", () => {
    expectInvalid(
      makeDecision({ direction: "short", stopLoss: 95, takeProfit: [94, 88] }),
      "short stopLoss must be above entryPrice",
    );
  });

  it("rejects short takeProfit above entry", () => {
    expectInvalid(
      makeDecision({ direction: "short", stopLoss: 105, takeProfit: [102] }),
      "profitable side",
    );
  });

  it("rejects entryPrice more than 15 percent away from current price", () => {
    expectInvalid(makeDecision({ entryPrice: 120, entryRange: null }), "+/-15%");
  });

  it("accepts a wait decision with no trade levels", () => {
    const result = validateTradeDecision(
      makeDecision({
        direction: "wait",
        entryType: "wait",
        entryPrice: null,
        entryRange: null,
        stopLoss: null,
        takeProfit: [],
        positionSizing: 0,
        rating: 3,
      }),
      CURRENT_PRICE,
    );

    expect(result.valid).toBe(true);
  });

  it("rejects wait decision that includes entryPrice", () => {
    expectInvalid(
      makeDecision({
        direction: "wait",
        entryType: "wait",
        entryPrice: 100,
        entryRange: null,
        stopLoss: null,
        takeProfit: [],
      }),
      "entryPrice=null",
    );
  });

  it("rejects positionSizing above 0.5", () => {
    expectInvalid(makeDecision({ positionSizing: 0.6 }), "between 0 and 0.5");
  });

  it("rejects rating outside the 1-5 range", () => {
    expectInvalid(makeDecision({ rating: 6 as TradeDecision["rating"] }), "rating");
  });

  it("rejects confidence outside the 0-1 range", () => {
    expectInvalid(makeDecision({ confidence: 1.2 }), "confidence");
  });

  it("rejects missing invalidatesIf", () => {
    expectInvalid(makeDecision({ invalidatesIf: "" }), "invalidatesIf");
  });

  it("rejects entryRange when entryPrice is outside the range", () => {
    expectInvalid(makeDecision({ entryRange: { low: 101, high: 102 } }), "entryRange");
  });
});

describe("generateTradeDecision", () => {
  beforeEach(() => {
    callWithChainMock.mockReset();
  });

  it("falls back from requested Opus tier to exposed haiku provider", () => {
    expect(resolvePMProviderSelection("high")).toEqual({
      requestedProvider: "claude-opus",
      providerOverride: "claude-haiku",
      fallbackReason: "claude-opus tier is not exposed by the current provider registry",
    });
  });

  it("retries invalid JSON once and returns the second valid decision", async () => {
    callWithChainMock
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision({ stopLoss: 101 }))))
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision({ id: "retry-valid" }))));

    const result = await generateTradeDecision(makePromptContext({ locale: "en_US" }));

    expect(result?.id).toBe("retry-valid");
    expect(callWithChainMock).toHaveBeenCalledTimes(2);
    expect(callWithChainMock.mock.calls[0][0].providerOverride).toBe("claude-haiku");
  });

  it("returns null after two invalid responses", async () => {
    callWithChainMock
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision({ stopLoss: 101 }))))
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision({ takeProfit: [95] }))));

    await expect(generateTradeDecision(makePromptContext({ locale: "en_US" }))).resolves.toBeNull();
    expect(callWithChainMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when retry output still mismatches the requested locale", async () => {
    callWithChainMock
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision())))
      .mockResolvedValueOnce(llmOutput(JSON.stringify(makeDecision({ id: "retry-english" }))));

    await expect(generateTradeDecision(makePromptContext({ locale: "zh_CN" }))).resolves.toBeNull();
    expect(callWithChainMock).toHaveBeenCalledTimes(2);
  });
});

function expectInvalid(raw: unknown, expectedError: string) {
  const result = validateTradeDecision(raw, CURRENT_PRICE);
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.errors.join("\n")).toContain(expectedError);
  }
}

function makeDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    id: "trade-1",
    schemaVersion: 1,
    symbol: "BTC",
    generatedBy: "pm",
    generatedAt: "2026-05-10T00:00:00.000Z",
    direction: "long",
    entryType: "breakout",
    entryPrice: 100,
    entryRange: { low: 99, high: 101 },
    stopLoss: 96,
    takeProfit: [106, 112],
    positionSizing: 0.15,
    timeHorizon: "intraday",
    rating: 4,
    confidence: 0.72,
    evidenceIds: [],
    riskNote: "Invalid if the reclaim loses volume.",
    invalidatesIf: "BTC closes below 96 on the 15m candle.",
    promptVersion: "trade-decision-v1",
    modelProvider: "stub",
    severity: "medium",
    ...overrides,
  };
}

function makePromptContext(overrides: Partial<Parameters<typeof generateTradeDecision>[0]> = {}) {
  return {
    ...makePromptContextBase(),
    ...overrides,
  };
}

function makePromptContextBase() {
  return {
    symbol: "BTC",
    currentPrice: CURRENT_PRICE,
    severity: "high" as const,
    analystInputs: [
      {
        memberId: "chart_analyst" as const,
        direction: "long" as const,
        confidence: 0.72,
        rationale: "BTC reclaimed 100 with rising volume.",
      },
    ],
    riskNotes: ["Invalid if 96 is lost."],
    newsContext: ["BTC liquidity improved."],
  };
}

function llmOutput(text: string) {
  return {
    text,
    provider: "stub",
    inputTokens: 10,
    outputTokens: 10,
    latencyMs: 1,
    cached: false,
  };
}
