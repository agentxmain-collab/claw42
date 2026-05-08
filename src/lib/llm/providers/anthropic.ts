import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  fetchWithTimeout,
  resolveCost,
  resolveInputTokens,
} from "@/lib/llm/providers/types";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const INPUT_USD_PER_MILLION = 3;
const OUTPUT_USD_PER_MILLION = 15;

export const anthropicProvider: LLMProvider = {
  id: "anthropic",
  displayName: "Anthropic",

  async generate(input: LLMInput): Promise<LLMOutput> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("missing ANTHROPIC_API_KEY");

    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
          system: input.systemPrompt,
          max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
          messages: [{ role: "user", content: input.prompt }],
        }),
      },
      input.timeoutMs,
    );

    if (!response.ok) throw new Error(`anthropic ${response.status}`);
    const data = (await response.json()) as AnthropicResponse;
    const text = data.content?.find((item) => item.type === "text")?.text?.trim();
    if (!text) throw new Error("anthropic empty response");

    return {
      text,
      provider: "anthropic",
      inputTokens: data.usage?.input_tokens ?? resolveInputTokens(input),
      outputTokens: data.usage?.output_tokens ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  },

  async isHealthy() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  estimateCost(input: LLMInput) {
    const inputTokens = resolveInputTokens(input);
    const outputTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    return resolveCost(inputTokens, outputTokens, INPUT_USD_PER_MILLION, OUTPUT_USD_PER_MILLION);
  },
};
