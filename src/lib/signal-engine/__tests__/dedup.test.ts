import { describe, expect, test } from "vitest";
import { dedupSignals } from "@/lib/signal-engine/dedup";
import { makeSignal } from "@/lib/signal-engine/__tests__/test-helpers";

describe("signal dedup", () => {
  test("merges duplicate keys and keeps the higher scoring signal", () => {
    const merged = dedupSignals([
      makeSignal({ id: "low", engine: { candidateScore: 50 } }),
      makeSignal({ id: "high", engine: { candidateScore: 90 } })
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("high");
    expect(merged[0].evidence.confirmCount).toBe(2);
  });

  test("preserves separate signals when dedup keys differ", () => {
    const merged = dedupSignals([
      makeSignal({ id: "btc", engine: { dedupKey: "etf:BTC:2026-04-19" } }),
      makeSignal({ id: "eth", engine: { dedupKey: "project:ETH:2026-04-19" } })
    ]);

    expect(merged.map((signal) => signal.id).sort()).toEqual(["btc", "eth"]);
  });

  test("marks multi-source resonance after duplicate evidence is merged", () => {
    const merged = dedupSignals([
      makeSignal({ id: "a", evidence: { pieces: [{ kind: "news", source: "A", excerpt: { zh: "A", en: "A" }, capturedAt: "2026-04-19T08:30:00.000Z" }] } }),
      makeSignal({ id: "b", evidence: { pieces: [{ kind: "market", source: "B", excerpt: { zh: "B", en: "B" }, capturedAt: "2026-04-19T08:31:00.000Z" }] } })
    ]);

    expect(merged[0].evidence.multiSourceConfirm).toBe(true);
    expect(merged[0].engine.rules).toContain("dedup_merge");
  });
});
