import type {
  LLMAttemptDiagnostic,
  LLMInput,
  LLMOutput,
  LLMProvider,
} from "@/lib/llm/providers/types";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  fetchWithTimeout,
  resolveCost,
  resolveInputTokens,
} from "@/lib/llm/providers/types";

type MiniMaxResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
};

const INPUT_USD_PER_MILLION = 0.2;
const OUTPUT_USD_PER_MILLION = 1.1;

function collectMiniMaxAttemptDiagnostic(
  input: LLMInput,
  diagnostic: Omit<LLMAttemptDiagnostic, "provider" | "taskTag">,
) {
  input.diagnosticsCollector?.({
    provider: "minimax",
    taskTag: input.taskTag,
    ...diagnostic,
  });
}

function usageFromMiniMax(data: MiniMaxResponse | null) {
  return {
    promptTokens: data?.usage?.prompt_tokens ?? null,
    completionTokens: data?.usage?.completion_tokens ?? null,
    totalTokens: data?.usage?.total_tokens ?? null,
  };
}

export const minimaxProvider: LLMProvider = {
  id: "minimax",
  displayName: "MiniMax",

  async generate(input: LLMInput): Promise<LLMOutput> {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error("missing MINIMAX_API_KEY");

    const startedAt = Date.now();
    const messages = [
      ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
      { role: "user", content: input.prompt },
    ];
    const response = await fetchWithTimeout(
      process.env.MINIMAX_ENDPOINT || "https://api.minimaxi.com/v1/text/chatcompletion_v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.MINIMAX_MODEL || "MiniMax-Text-01",
          messages,
          max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
          top_p: 0.9,
        }),
      },
      input.timeoutMs,
    );

    if (!response.ok) {
      const error = new Error(`minimax ${response.status}`);
      collectMiniMaxAttemptDiagnostic(input, {
        model: process.env.MINIMAX_MODEL || "MiniMax-Text-01",
        httpStatus: response.status,
        finishReason: null,
        usage: usageFromMiniMax(null),
        contentLength: null,
        reasoningContent: { present: false, length: null },
        error: error.message,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
    const data = (await response.json()) as MiniMaxResponse;
    const firstChoice = data.choices?.[0];
    const content = firstChoice?.message?.content ?? "";
    const reasoningContent =
      firstChoice?.message?.reasoning_content ?? firstChoice?.message?.reasoning ?? "";
    const text = content.trim();
    if (!text) {
      const error = new Error("minimax empty response");
      collectMiniMaxAttemptDiagnostic(input, {
        model: process.env.MINIMAX_MODEL || "MiniMax-Text-01",
        httpStatus: response.status,
        finishReason: firstChoice?.finish_reason ?? null,
        usage: usageFromMiniMax(data),
        contentLength: content.length,
        reasoningContent: {
          present: reasoningContent.length > 0,
          length: reasoningContent.length,
        },
        error: error.message,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }

    return {
      text,
      provider: "minimax",
      inputTokens: data.usage?.prompt_tokens ?? resolveInputTokens(input),
      outputTokens: data.usage?.completion_tokens ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  },

  async isHealthy() {
    return Boolean(process.env.MINIMAX_API_KEY);
  },

  estimateCost(input: LLMInput) {
    const inputTokens = resolveInputTokens(input);
    const outputTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    return resolveCost(inputTokens, outputTokens, INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION);
  },
};
