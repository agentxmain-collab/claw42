import { beforeEach, describe, expect, test, vi } from "vitest";

const callWithChainMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/providers", () => ({
  callWithChain: callWithChainMock,
}));

import { ingestCandidates } from "@/lib/signal-engine/ingest";
import {
  __llmStructuringTestUtils,
  generateStructuredSignal,
  llmStructuringProvider,
} from "@/lib/signal-engine/providers/llm";

describe("LLM structuring provider", () => {
  beforeEach(() => {
    callWithChainMock.mockReset();
  });

  test("parses and validates required JSON fields", async () => {
    callWithChainMock.mockResolvedValueOnce({
      text: JSON.stringify({
        whyItMatters: { zh: "影响资金定价", en: "Impacts market pricing" },
        marketContext: { zh: "成交量放大", en: "Volume expanded" },
        watchPoints: [{ zh: "观察延续", en: "Watch continuation" }],
        direction: "bullish",
        confidence: 72,
        impactLevel: "high",
        riskNotes: [{ zh: "防止假突破", en: "Avoid fake breakouts" }],
      }),
      provider: "stub",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      cached: false,
    });

    await expect(generateStructuredSignal("prompt")).resolves.toMatchObject({
      direction: "bullish",
      confidence: 72,
    });
  });

  test("normalizes LLM structured output for SignalEngine", async () => {
    const candidate = ingestCandidates()[0];
    callWithChainMock.mockResolvedValueOnce({
      text: JSON.stringify({
        whyItMatters: {
          zh: "事件会改变短线资金注意力",
          en: "The event changes short-term attention.",
        },
        marketContext: { zh: "市场等待确认", en: "The market waits for confirmation." },
        watchPoints: [{ zh: "观察成交量", en: "Watch volume." }],
        direction: "bullish",
        confidence: 76,
        impactLevel: "high",
        riskNotes: [{ zh: "数据可能滞后", en: "Data may lag." }],
      }),
      provider: "stub",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      cached: false,
    });

    const structured = await llmStructuringProvider.structure({
      candidate,
      rules: [{ name: "test", score: 10, triggered: true }],
      score: 80,
      impactLevel: "high",
    });

    expect(structured.confidence).toBe(76);
    expect(structured.whyItMatters.zh).toContain("事件");
  });

  test("throws when required fields are missing", () => {
    expect(() =>
      __llmStructuringTestUtils.parseAndValidate("{}", {
        required: ["whyItMatters"],
      }),
    ).toThrow(/missing required fields/);
  });
});
