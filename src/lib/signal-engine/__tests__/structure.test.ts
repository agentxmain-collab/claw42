import { describe, expect, test, vi } from "vitest";
import { normalizeStructuredFields } from "@/lib/signal-engine/schema-guard";
import { structureCandidate, structureCandidateAsync } from "@/lib/signal-engine/structure";
import { ingestCandidates } from "@/lib/signal-engine/ingest";
import type { StructuredFields, StructuringProvider } from "@/lib/signal-engine/providers/types";

const fallback: StructuredFields = {
  whyItMatters: { zh: "默认重要性", en: "Fallback importance" },
  marketContext: { zh: "默认市场背景", en: "Fallback context" },
  watchPoints: [{ zh: "默认观察点", en: "Fallback watch point" }],
  direction: "bullish",
  confidence: 66,
  impactLevel: "medium",
  riskNotes: [{ zh: "默认风险提示", en: "Fallback risk note" }]
};

describe("signal structure", () => {
  test("validates provider schema and clamps confidence", () => {
    const normalized = normalizeStructuredFields(
      {
        why_it_matters: { zh: "资金重新定价", en: "Capital reprices" },
        market_context: { zh: "放量上涨", en: "Rising with volume" },
        watch_points: [{ zh: "看 ETF", en: "Watch ETF" }],
        direction: "neutral",
        confidence: 108,
        impact_level: "high",
        risk_notes: [{ zh: "高位波动", en: "High volatility" }]
      },
      fallback
    );

    expect(normalized.confidence).toBe(100);
    expect(normalized.direction).toBe("neutral");
    expect(normalized.impactLevel).toBe("high");
  });

  test("structures a candidate with deterministic fallback fields", () => {
    const signal = structureCandidate(ingestCandidates()[0]);

    expect(signal.version).toBe(1);
    expect(signal.explanation.whyItMatters.zh).toContain(signal.impact.primaryAsset);
    expect(signal.engine.dedupKey).toContain(signal.facts.eventType);
  });

  test("falls back when async provider throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider: StructuringProvider = {
      name: "broken-provider",
      async structure() {
        throw new Error("provider unavailable");
      }
    };

    try {
      const signal = await structureCandidateAsync(ingestCandidates()[0], provider);
      expect(signal.explanation.whyItMatters.zh).toContain("会影响");
      expect(signal.judgment.riskNotes[0].zh).toContain("mock 数据");
    } finally {
      warn.mockRestore();
    }
  });
});
