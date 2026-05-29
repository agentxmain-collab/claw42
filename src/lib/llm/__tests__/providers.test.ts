import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BudgetExceededError,
  __llmProviderTestUtils,
  callExactProvider,
  callWithChain,
  getProvider,
  getProviderChain,
} from "@/lib/llm/providers";
import {
  __llmBudgetTestUtils,
  getMonthlyUsage,
  isBudgetAutopaused,
  shouldAlarmBudget,
  trackUsage,
} from "@/lib/llm/budget-tracker";
import { __providerTelemetryTestUtils } from "@/lib/team/providerTelemetry";
import type { LLMProvider } from "@/lib/llm/providers/types";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
  delete process.env.DEEPSEEK_FALLBACK_MODEL;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.LLM_PRIMARY_PROVIDER;
  delete process.env.LLM_MONTHLY_BUDGET_USD;
  delete process.env.LLM_BUDGET_ALARM_THRESHOLD;
  delete process.env.LLM_BUDGET_AUTOPAUSE_THRESHOLD;
}

describe("LLM provider core", () => {
  beforeEach(() => {
    resetEnv();
    __llmBudgetTestUtils.clearMemoryUsage();
    __llmProviderTestUtils.clearCache();
    __providerTelemetryTestUtils.clearMemory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("registers all provider implementations", () => {
    expect(getProvider("deepseek-chat").id).toBe("deepseek-chat");
    expect(getProvider("minimax").id).toBe("minimax");
    expect(getProvider("claude-haiku").id).toBe("claude-haiku");
    expect(getProvider("openai").id).toBe("openai");
    expect(getProvider("anthropic").id).toBe("anthropic");
    expect(getProvider("stub").id).toBe("stub");
  });

  it("uses the locked provider chain with dev stub fallback", () => {
    expect(getProviderChain()).toEqual(["deepseek-chat", "minimax", "claude-haiku", "stub"]);
  });

  it("falls back to deterministic stub when no keys are configured in dev", async () => {
    const output = await callWithChain({
      prompt: "hello market",
      taskTag: "test:stub",
      maxTokens: 64,
    });

    expect(output.provider).toBe("stub");
    expect(output.text).toMatch(/^\[STUB:test:stub:/);
    expect(output.cached).toBe(false);
  });

  it("can call one exact provider without falling back to the chain", async () => {
    await expect(
      callExactProvider(
        {
          prompt: "hello",
          taskTag: "test:exact-minimax-unhealthy",
          maxTokens: 64,
        },
        "minimax",
      ),
    ).rejects.toThrow("Provider minimax unhealthy");

    expect(__providerTelemetryTestUtils.memoryCalls[0]).toMatchObject({
      taskTag: "test:exact-minimax-unhealthy",
      providerChain: ["minimax"],
      attemptedProviders: [],
      skippedProviders: ["minimax"],
      finalProvider: null,
      fallbackCount: 0,
      success: false,
    });
  });

  it("records cost and telemetry for an exact successful provider call", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "exact provider ok" } }],
            usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const output = await callExactProvider(
      {
        prompt: "hello",
        taskTag: "test:exact-deepseek",
        maxTokens: 64,
      },
      "deepseek-chat",
    );

    expect(output.provider).toBe("deepseek-chat");
    expect(output.text).toBe("exact provider ok");
    expect(await getMonthlyUsage("deepseek-chat")).toMatchObject({ usd: 0.87 });
    expect(__providerTelemetryTestUtils.memoryCalls[0]).toMatchObject({
      taskTag: "test:exact-deepseek",
      providerOverride: "deepseek-chat",
      providerChain: ["deepseek-chat"],
      attemptedProviders: ["deepseek-chat"],
      skippedProviders: [],
      finalProvider: "deepseek-chat",
      fallbackCount: 0,
      success: true,
      cached: false,
    });
  });

  it("skips exact provider fallback when the monthly budget is autopaused", async () => {
    process.env.LLM_MONTHLY_BUDGET_USD = "1";
    process.env.LLM_BUDGET_AUTOPAUSE_THRESHOLD = "0.5";
    const provider: LLMProvider = {
      id: "stub",
      displayName: "Budget test",
      async generate() {
        throw new Error("not used");
      },
      async isHealthy() {
        return true;
      },
      estimateCost() {
        return { inputUsd: 0.25, outputUsd: 0.75 };
      },
    };
    await trackUsage(
      provider,
      { prompt: "x", taskTag: "test:exact-budget-seed" },
      {
        text: "ok",
        provider: "stub",
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
        cached: false,
      },
    );

    await expect(
      callExactProvider(
        {
          prompt: "hello",
          taskTag: "test:exact-budget-autopause",
          maxTokens: 64,
        },
        "stub",
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);

    expect(__providerTelemetryTestUtils.memoryCalls[0]).toMatchObject({
      taskTag: "test:exact-budget-autopause",
      providerChain: ["stub"],
      attemptedProviders: [],
      skippedProviders: ["stub"],
      finalProvider: null,
      fallbackCount: 0,
      success: false,
      error: "Monthly LLM budget exceeded autopause threshold",
    });
  });

  it("returns cache hits when cacheKey is provided", async () => {
    const first = await callWithChain({
      prompt: "same prompt",
      taskTag: "test:cache",
      cacheKey: "llm-cache:test",
    });
    const second = await callWithChain({
      prompt: "changed prompt but same key",
      taskTag: "test:cache",
      cacheKey: "llm-cache:test",
    });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
    expect(second.cacheHitProvider).toBe("stub");
  });

  it("tracks monthly budget and trips alarm/autopause thresholds", async () => {
    process.env.LLM_MONTHLY_BUDGET_USD = "1";
    process.env.LLM_BUDGET_ALARM_THRESHOLD = "0.5";
    process.env.LLM_BUDGET_AUTOPAUSE_THRESHOLD = "0.9";

    const provider: LLMProvider = {
      id: "stub",
      displayName: "Budget test",
      async generate() {
        throw new Error("not used");
      },
      async isHealthy() {
        return true;
      },
      estimateCost() {
        return { inputUsd: 0.25, outputUsd: 0.75 };
      },
    };

    await trackUsage(
      provider,
      { prompt: "x", taskTag: "test:budget" },
      {
        text: "ok",
        provider: "stub",
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
        cached: false,
      },
    );

    const usage = await getMonthlyUsage();
    expect(usage.usd).toBe(1);
    expect(await shouldAlarmBudget()).toBe(true);
    expect(await isBudgetAutopaused()).toBe(true);
  });

  it("real provider health checks depend on env keys", async () => {
    expect(await getProvider("deepseek-chat").isHealthy()).toBe(false);
    process.env.DEEPSEEK_API_KEY = "test-key";
    expect(await getProvider("deepseek-chat").isHealthy()).toBe(true);
  });

  it("uses DeepSeek V4 Pro model and pricing by default", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    let requestBody: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body ?? "{}"));
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "market check" } }],
            usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const provider = getProvider("deepseek-chat");
    const output = await provider.generate({ prompt: "hello", taskTag: "test:deepseek" });
    const estimate = provider.estimateCost({
      prompt: "x".repeat(3_999_999),
      maxTokens: 1_000_000,
      taskTag: "test:deepseek-cost",
    });

    expect(provider.displayName).toBe("DeepSeek V4 Pro");
    expect(requestBody).toMatchObject({ model: "deepseek-v4-pro" });
    expect(output.provider).toBe("deepseek-chat");
    expect(estimate).toEqual({ inputUsd: 0.435, outputUsd: 0.87 });
  });

  it("can force DeepSeek V4 into final JSON mode without exposing private text", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    let requestBody: Record<string, unknown> = {};
    const diagnostics: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: '{"analysisSummary":"ok","direction":"long"}',
                  reasoning_content: "private reasoning",
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const output = await getProvider("deepseek-chat").generate({
      prompt: "private news title",
      taskTag: "test:deepseek-final-json-mode",
      thinkingMode: "disabled",
      responseFormat: "json_object",
      diagnosticsCollector: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(requestBody).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    });
    expect(output.text).toBe('{"analysisSummary":"ok","direction":"long"}');
    expect(diagnostics).toEqual([
      expect.objectContaining({
        provider: "deepseek-chat",
        model: "deepseek-v4-pro",
        httpStatus: 200,
        finishReason: "stop",
        usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
        contentLength: '{"analysisSummary":"ok","direction":"long"}'.length,
        reasoningContent: { present: true, length: "private reasoning".length },
        error: null,
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("private news title");
    expect(JSON.stringify(diagnostics)).not.toContain("private reasoning");
  });

  it("falls back from DeepSeek V4 Pro to V4 Flash on transient model failure", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const requestModels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
        requestModels.push(String(requestBody.model));
        if (requestBody.model === "deepseek-v4-pro") {
          return new Response(JSON.stringify({ error: "temporary unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "flash fallback" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const output = await getProvider("deepseek-chat").generate({
      prompt: "hello",
      taskTag: "test:deepseek-fallback",
    });

    expect(requestModels).toEqual(["deepseek-v4-pro", "deepseek-v4-flash"]);
    expect(output.text).toBe("flash fallback");
    expect(output.provider).toBe("deepseek-chat");
  });

  it("falls back to the stable DeepSeek chat model when V4 models return empty content", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const requestModels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
        requestModels.push(String(requestBody.model));
        if (requestBody.model === "deepseek-chat") {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: "stable fallback" } }],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "" } }],
            usage: { prompt_tokens: 10, completion_tokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const output = await getProvider("deepseek-chat").generate({
      prompt: "hello",
      taskTag: "test:deepseek-stable-fallback",
    });

    expect(requestModels).toEqual(["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat"]);
    expect(output.text).toBe("stable fallback");
    expect(output.provider).toBe("deepseek-chat");
  });

  it("collects safe DeepSeek empty-response diagnostics without response text", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const diagnostics: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: "", reasoning_content: "private reasoning".repeat(20) },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 700, total_tokens: 820 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(
      getProvider("deepseek-chat").generate({
        prompt: "do not expose this prompt",
        taskTag: "test:deepseek-empty-diagnostics",
        diagnosticsCollector: (diagnostic) => diagnostics.push(diagnostic),
      }),
    ).rejects.toThrow("deepseek-chat deepseek-chat empty response");

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0]).toMatchObject({
      provider: "deepseek-chat",
      model: "deepseek-v4-pro",
      httpStatus: 200,
      finishReason: "length",
      usage: { promptTokens: 120, completionTokens: 700, totalTokens: 820 },
      contentLength: 0,
      reasoningContent: { present: true, length: "private reasoning".repeat(20).length },
      error: "deepseek-chat deepseek-v4-pro empty response",
    });
    expect(JSON.stringify(diagnostics)).not.toContain("do not expose this prompt");
    expect(JSON.stringify(diagnostics)).not.toContain("private reasoning");
  });

  it("collects safe Minimax empty-response diagnostics", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_MODEL = "MiniMax-Test";
    const diagnostics: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content: "" } }],
            usage: { prompt_tokens: 80, completion_tokens: 0, total_tokens: 80 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(
      getProvider("minimax").generate({
        prompt: "private news title",
        taskTag: "test:minimax-empty-diagnostics",
        diagnosticsCollector: (diagnostic) => diagnostics.push(diagnostic),
      }),
    ).rejects.toThrow("minimax empty response");

    expect(diagnostics).toEqual([
      expect.objectContaining({
        provider: "minimax",
        model: "MiniMax-Test",
        httpStatus: 200,
        finishReason: "stop",
        usage: { promptTokens: 80, completionTokens: 0, totalTokens: 80 },
        contentLength: 0,
        reasoningContent: { present: false, length: 0 },
        error: "minimax empty response",
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("private news title");
  });

  it("can force Minimax validation onto a non-reasoning text model", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_MODEL = "MiniMax-M2.7";
    let requestBody: Record<string, unknown> = {};
    const diagnostics: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: '{"analysisSummary":"ok","direction":"short"}' },
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const output = await getProvider("minimax").generate({
      prompt: "private news title",
      taskTag: "test:minimax-model-override",
      modelOverride: "MiniMax-Text-01",
      diagnosticsCollector: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(requestBody).toMatchObject({ model: "MiniMax-Text-01" });
    expect(output.text).toBe('{"analysisSummary":"ok","direction":"short"}');
    expect(diagnostics).toEqual([
      expect.objectContaining({
        provider: "minimax",
        model: "MiniMax-Text-01",
        httpStatus: 200,
        finishReason: "stop",
        contentLength: '{"analysisSummary":"ok","direction":"short"}'.length,
        reasoningContent: { present: false, length: 0 },
        error: null,
      }),
    ]);
  });
});
