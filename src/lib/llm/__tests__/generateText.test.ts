import { beforeEach, describe, expect, it } from "vitest";
import { __llmCacheTestUtils, getFromCache, hashCacheKey, setCache } from "@/lib/llm/cache";
import { generateText } from "@/lib/llm/generateText";
import { applyGuardrails, hasMechanicalOutput } from "@/lib/llm/guardrails";
import { __llmBudgetTestUtils } from "@/lib/llm/budget-tracker";

describe("generateText adapter", () => {
  beforeEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.LLM_PRIMARY_PROVIDER = "stub";
    process.env.LLM_ENABLE_STUB = "1";
    __llmCacheTestUtils.clearMemoryCache();
    __llmBudgetTestUtils.clearMemoryUsage();
  });

  it("generates text through the shared provider chain", async () => {
    const text = await generateText("hello", {
      taskTag: "test:generate",
      enableCache: false,
    });

    expect(text).toMatch(/^\[STUB:test:generate:/);
  });

  it("hashes and stores cache entries", async () => {
    const key = hashCacheKey("prompt", "test:cache", "system");
    await setCache(key, {
      text: "cached",
      provider: "stub",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      cached: false,
    });

    await expect(getFromCache(key)).resolves.toMatchObject({ text: "cached" });
  });

  it("detects and cleans mechanical output", async () => {
    const mechanical = "首先，作为 Alpha 派：BTC 先观察。";

    expect(hasMechanicalOutput(mechanical, "test:guardrails")).toBe(true);
    await expect(applyGuardrails(mechanical, "test:guardrails")).resolves.toBe("BTC 先观察。");
  });
});
