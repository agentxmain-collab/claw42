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

type DeepSeekResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

const INPUT_USD_PER_MILLION = 0.435;
const OUTPUT_USD_PER_MILLION = 0.87;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEFAULT_DEEPSEEK_FALLBACK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_COMPAT_MODEL = "deepseek-chat";

function pushUniqueModel(models: string[], model: string | undefined) {
  if (model && !models.includes(model)) models.push(model);
}

function resolveDeepSeekModels() {
  const primary = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const fallback = process.env.DEEPSEEK_FALLBACK_MODEL || DEFAULT_DEEPSEEK_FALLBACK_MODEL;
  const compat = process.env.DEEPSEEK_COMPAT_MODEL || DEFAULT_DEEPSEEK_COMPAT_MODEL;
  const models: string[] = [];
  pushUniqueModel(models, primary);
  if (primary === DEFAULT_DEEPSEEK_MODEL) {
    pushUniqueModel(models, fallback);
  }
  pushUniqueModel(models, compat);
  return models;
}

function requestBodyForModel(
  input: LLMInput,
  model: string,
  messages: Array<{ role: string; content: string }>,
) {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: input.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
  if (input.thinkingMode) {
    body.thinking = { type: input.thinkingMode };
  }
  if (input.responseFormat) {
    body.response_format = { type: input.responseFormat };
  }
  return body;
}

function shouldTryFallback(status: number) {
  return status === 429 || status >= 500;
}

function collectDeepSeekAttemptDiagnostic(
  input: LLMInput,
  diagnostic: Omit<LLMAttemptDiagnostic, "provider" | "taskTag">,
) {
  input.diagnosticsCollector?.({
    provider: "deepseek-chat",
    taskTag: input.taskTag,
    ...diagnostic,
  });
}

function usageFromDeepSeek(data: DeepSeekResponse | null) {
  return {
    promptTokens: data?.usage?.prompt_tokens ?? null,
    completionTokens: data?.usage?.completion_tokens ?? null,
    totalTokens: data?.usage?.total_tokens ?? null,
  };
}

export const deepseekChatProvider: LLMProvider = {
  id: "deepseek-chat",
  displayName: "DeepSeek V4 Pro",

  async generate(input: LLMInput): Promise<LLMOutput> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("missing DEEPSEEK_API_KEY");

    const messages = [
      ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
      { role: "user", content: input.prompt },
    ];
    const startedAt = Date.now();
    let lastError: Error | null = null;

    for (const model of resolveDeepSeekModels()) {
      const response = await fetchWithTimeout(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(requestBodyForModel(input, model, messages)),
        },
        input.timeoutMs,
      );

      if (!response.ok) {
        lastError = new Error(`deepseek-chat ${model} ${response.status}`);
        collectDeepSeekAttemptDiagnostic(input, {
          model,
          httpStatus: response.status,
          finishReason: null,
          usage: usageFromDeepSeek(null),
          contentLength: null,
          reasoningContent: { present: false, length: null },
          error: lastError.message,
          latencyMs: Date.now() - startedAt,
        });
        console.warn("[claw42] DeepSeek model failed", {
          taskTag: input.taskTag,
          model,
          error: lastError.message,
        });
        if (shouldTryFallback(response.status)) continue;
        throw lastError;
      }

      const data = (await response.json()) as DeepSeekResponse;
      const firstChoice = data.choices?.[0];
      const content = firstChoice?.message?.content ?? "";
      const reasoningContent =
        firstChoice?.message?.reasoning_content ?? firstChoice?.message?.reasoning ?? "";
      const text = content.trim();
      if (!text) {
        lastError = new Error(`deepseek-chat ${model} empty response`);
        collectDeepSeekAttemptDiagnostic(input, {
          model,
          httpStatus: response.status,
          finishReason: firstChoice?.finish_reason ?? null,
          usage: usageFromDeepSeek(data),
          contentLength: content.length,
          reasoningContent: {
            present: reasoningContent.length > 0,
            length: reasoningContent.length,
          },
          error: lastError.message,
          latencyMs: Date.now() - startedAt,
        });
        console.warn("[claw42] DeepSeek model failed", {
          taskTag: input.taskTag,
          model,
          error: lastError.message,
        });
        continue;
      }

      collectDeepSeekAttemptDiagnostic(input, {
        model,
        httpStatus: response.status,
        finishReason: firstChoice?.finish_reason ?? null,
        usage: usageFromDeepSeek(data),
        contentLength: content.length,
        reasoningContent: {
          present: reasoningContent.length > 0,
          length: reasoningContent.length,
        },
        error: null,
        latencyMs: Date.now() - startedAt,
      });
      console.info("[claw42 deepseek-chat] succeeded", {
        taskTag: input.taskTag,
        model,
      });

      return {
        text,
        provider: "deepseek-chat",
        inputTokens: data.usage?.prompt_tokens ?? resolveInputTokens(input),
        outputTokens: data.usage?.completion_tokens ?? Math.ceil(text.length / 4),
        latencyMs: Date.now() - startedAt,
        cached: false,
      };
    }

    throw lastError ?? new Error("deepseek-chat failed");
  },

  async isHealthy() {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  estimateCost(input: LLMInput) {
    const inputTokens = resolveInputTokens(input);
    const outputTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    return resolveCost(inputTokens, outputTokens, INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION);
  },
};
