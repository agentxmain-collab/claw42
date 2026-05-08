import { describe, expect, test } from "vitest";
import { derateSignal } from "@/lib/signal-engine/derate";
import { makeSignal } from "@/lib/signal-engine/__tests__/test-helpers";

describe("signal derate", () => {
  test("clears low-confidence direction and adds default risk notes", () => {
    const derated = derateSignal(makeSignal({ judgment: { confidence: 35, riskNotes: [] } }));

    expect(derated.judgment.direction).toBeNull();
    expect(derated.judgment.riskNotes[0].zh).toContain("证据仍需后续确认");
    expect(derated.engine.rules).toContain("low_confidence_derated");
  });

  test("removes weak-evidence headliner status", () => {
    const derated = derateSignal(
      makeSignal({
        engine: { isHeadliner: true },
        evidence: { pieces: [], multiSourceConfirm: false },
      }),
    );

    expect(derated.engine.isHeadliner).toBe(false);
    expect(derated.engine.rules).toContain("weak_evidence_derated");
  });

  test("marks direction conflicts as watching", () => {
    const derated = derateSignal(makeSignal({ engine: { rules: ["direction_conflict"] } }));

    expect(derated.facts.eventStatus).toBe("watching");
  });
});
