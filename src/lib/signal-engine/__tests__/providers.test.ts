import { describe, expect, test, vi } from "vitest";
import { getStructuringProvider, stubStructuringProvider } from "@/lib/signal-engine/providers";
import { PLACEHOLDER_FOR_T2 } from "@/lib/signal-engine/providers/llm";
import { structureWithStub } from "@/lib/signal-engine/providers/stub";
import { ingestCandidates } from "@/lib/signal-engine/ingest";

describe("signal providers", () => {
  test("uses the deterministic stub provider by default", () => {
    const provider = getStructuringProvider({});

    expect(provider).toBe(stubStructuringProvider);
    expect(provider.name).toBe("stub");
  });

  test("falls back to stub for LLM mode outside production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(getStructuringProvider({ SIGNAL_PROVIDER: "llm" })).toBe(stubStructuringProvider);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("exposes explicit T2 placeholder for LLM provider files", () => {
    expect(PLACEHOLDER_FOR_T2).toBe(true);
  });

  test("stub provider preserves candidate direction only above low-confidence threshold", () => {
    const candidate = ingestCandidates()[0];

    expect(structureWithStub(candidate, 35, "low").direction).toBeNull();
    expect(structureWithStub(candidate, 70, "high").direction).toBe(candidate.direction);
  });
});
