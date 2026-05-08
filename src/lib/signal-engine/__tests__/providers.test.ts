import { describe, expect, test } from "vitest";
import { getStructuringProvider, stubStructuringProvider } from "@/lib/signal-engine/providers";
import { llmStructuringProvider } from "@/lib/signal-engine/providers/llm";
import { structureWithStub } from "@/lib/signal-engine/providers/stub";
import { ingestCandidates } from "@/lib/signal-engine/ingest";

describe("signal providers", () => {
  test("uses the deterministic stub provider by default", () => {
    const provider = getStructuringProvider({});

    expect(provider).toBe(stubStructuringProvider);
    expect(provider.name).toBe("stub");
  });

  test("uses the LLM provider when SIGNAL_PROVIDER=llm", () => {
    expect(getStructuringProvider({ SIGNAL_PROVIDER: "llm" })).toBe(llmStructuringProvider);
  });

  test("LLM provider is no longer a T2 placeholder", () => {
    expect(llmStructuringProvider.name).toBe("llm");
  });

  test("stub provider preserves candidate direction only above low-confidence threshold", () => {
    const candidate = ingestCandidates()[0];

    expect(structureWithStub(candidate, 35, "low").direction).toBeNull();
    expect(structureWithStub(candidate, 70, "high").direction).toBe(candidate.direction);
  });
});
