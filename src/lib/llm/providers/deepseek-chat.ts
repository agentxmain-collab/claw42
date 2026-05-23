import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  fetchWithTimeout,
  resolveCost,
  resolveInputTokens,
} from "@/lib/llm/providers/types";

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const INPUT_USD_PER_MILLION = 0.435;
const OUTPUT_USD_PER_MILLION = 0.87;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEFAULT_DEEPSEEK_FALLBACK_MODEL = "deepseek-v4-flash";

function resolveDeepSeekModels() {
  const primary = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const fallback = process.env.DEEPSEEK_FALLBACK_MODEL || DEFAULT_DEEPSEEK_FALLBACK_MODEL;
  if (primary !== DEFAULT_DEEPSEEK_MODEL || fallback === primary) return [primary];
  return [primary, fallback];
}

function shouldTryFallback(status: number) {
  return status === 429 || status >= 500;
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
          body: JSON.stringify({
            model,
            messages,
            temperature: input.temperature ?? DEFAULT_TEMPERATURE,
            max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          }),
        },
        input.timeoutMs,
      );

      if (!response.ok) {
        lastError = new Error(`deepseek-chat ${model} ${response.status}`);
        if (shouldTryFallback(response.status)) continue;
        throw lastError;
      }

      const data = (await response.json()) as DeepSeekResponse;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        lastError = new Error(`deepseek-chat ${model} empty response`);
        continue;
      }

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
