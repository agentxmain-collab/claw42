import { describe, expect, test } from "vitest";
import { impactFromScore, isHeadliner, scoreCandidate } from "@/lib/signal-engine/score";

describe("signal score", () => {
  test("computes weighted confidence from triggered rule scores", () => {
    const score = scoreCandidate([
      { name: "multi_source_confirm", score: 100, triggered: true },
      { name: "market_anomaly", score: 80, triggered: true },
      { name: "high_credibility_news", score: 50, triggered: true },
    ]);

    expect(score).toBe(70);
  });

  test("maps low confidence scores to low impact instead of automatic action", () => {
    expect(impactFromScore(35)).toBe("low");
    expect(impactFromScore(55)).toBe("medium");
    expect(impactFromScore(72)).toBe("high");
    expect(impactFromScore(90)).toBe("critical");
  });

  test("requires both score and strong rule before headlining", () => {
    expect(isHeadliner(72, [{ name: "high_credibility_news", score: 90, triggered: true }])).toBe(
      false,
    );
    expect(isHeadliner(69, [{ name: "multi_source_confirm", score: 100, triggered: true }])).toBe(
      false,
    );
    expect(isHeadliner(75, [{ name: "market_anomaly", score: 100, triggered: true }])).toBe(true);
  });
});
