import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  fetchWithTimeout,
  resolveCost,
  resolveInputTokens,
} from "@/lib/llm/providers/types";

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const INPUT_USD_PER_MILLION = 0.15;
const OUTPUT_USD_PER_MILLION = 0.6;

export const openaiProvider: LLMProvider = {
  id: "openai",
  displayName: "OpenAI",

  async generate(input: LLMInput): Promise<LLMOutput> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("missing OPENAI_API_KEY");

    const startedAt = Date.now();
    const messages = [
      ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
      { role: "user", content: input.prompt },
    ];
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages,
          max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
        }),
      },
      input.timeoutMs,
    );

    if (!response.ok) throw new Error(`openai ${response.status}`);
    const data = (await response.json()) as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("openai empty response");

    return {
      text,
      provider: "openai",
      inputTokens: data.usage?.prompt_tokens ?? resolveInputTokens(input),
      outputTokens: data.usage?.completion_tokens ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  },

  async isHealthy() {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  estimateCost(input: LLMInput) {
    const inputTokens = resolveInputTokens(input);
    const outputTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    return resolveCost(inputTokens, outputTokens, INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION);
  },
};
