import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";
import { resolveInputTokens } from "@/lib/llm/providers/types";

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

export const stubProvider: LLMProvider = {
  id: "stub",
  displayName: "Stub (deterministic mock)",

  async generate(input: LLMInput): Promise<LLMOutput> {
    const startedAt = Date.now();
    const hash = simpleHash(`${input.taskTag}:${input.systemPrompt ?? ""}:${input.prompt}`);
    const text = `[STUB:${input.taskTag}:${hash}] mocked response for testing`;

    return {
      text,
      provider: "stub",
      inputTokens: resolveInputTokens(input),
      outputTokens: 20,
      latencyMs: Math.max(1, Date.now() - startedAt),
      cached: false,
    };
  },

  async isHealthy() {
    return true;
  },

  estimateCost() {
    return { inputUsd: 0, outputUsd: 0 };
  },
};
