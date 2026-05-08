import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  fetchWithTimeout,
  resolveCost,
  resolveInputTokens,
} from "@/lib/llm/providers/types";

type MiniMaxResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
};

const INPUT_USD_PER_MILLION = 0.2;
const OUTPUT_USD_PER_MILLION = 1.1;

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

    if (!response.ok) throw new Error(`minimax ${response.status}`);
    const data = (await response.json()) as MiniMaxResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("minimax empty response");

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
