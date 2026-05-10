import { trackUsage, isBudgetAutopaused, BudgetExceededError } from "@/lib/llm/budget-tracker";
import { __llmCacheTestUtils, getFromCache, setCache } from "@/lib/llm/cache";
import { anthropicProvider } from "@/lib/llm/providers/anthropic";
import { claudeHaikuProvider } from "@/lib/llm/providers/claude-haiku";
import { deepseekChatProvider } from "@/lib/llm/providers/deepseek-chat";
import { minimaxProvider } from "@/lib/llm/providers/minimax";
import { openaiProvider } from "@/lib/llm/providers/openai";
import { stubProvider } from "@/lib/llm/providers/stub";
import type { LLMInput, LLMOutput, LLMProvider, ProviderId } from "@/lib/llm/providers/types";

export { BudgetExceededError };
export type { LLMInput, LLMOutput, LLMProvider, ProviderId } from "@/lib/llm/providers/types";

const PROVIDERS: Record<ProviderId, LLMProvider> = {
  "deepseek-chat": deepseekChatProvider,
  minimax: minimaxProvider,
  "claude-haiku": claudeHaikuProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  stub: stubProvider,
};

function isProviderId(value: string | undefined): value is ProviderId {
  return Boolean(value && value in PROVIDERS);
}

function pushUnique(chain: ProviderId[], providerId: ProviderId) {
  if (!chain.includes(providerId)) chain.push(providerId);
}

export function getProvider(providerId: ProviderId): LLMProvider {
  return PROVIDERS[providerId];
}

export function getProviderChain(providerOverride?: ProviderId): ProviderId[] {
  const chain: ProviderId[] = [];
  if (providerOverride) pushUnique(chain, providerOverride);
  const primary = process.env.LLM_PRIMARY_PROVIDER;
  pushUnique(chain, isProviderId(primary) ? primary : "deepseek-chat");
  pushUnique(chain, "minimax");
  pushUnique(chain, "claude-haiku");
  if (process.env.NODE_ENV !== "production" || process.env.LLM_ENABLE_STUB === "1") {
    pushUnique(chain, "stub");
  }
  return chain;
}

export async function callWithChain(input: LLMInput): Promise<LLMOutput> {
  if (input.cacheKey) {
    const cached = await getFromCache(input.cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
        cacheHitProvider: cached.cacheHitProvider ?? cached.provider,
      };
    }
  }

  if (await isBudgetAutopaused()) {
    throw new BudgetExceededError("Monthly LLM budget exceeded autopause threshold");
  }

  let lastError: Error | null = null;
  for (const providerId of getProviderChain(input.providerOverride)) {
    const provider = getProvider(providerId);
    try {
      if (!(await provider.isHealthy())) continue;

      const output = await provider.generate(input);
      const normalizedOutput = { ...output, cached: false };
      await trackUsage(provider, input, normalizedOutput);
      if (input.cacheKey) {
        await setCache(input.cacheKey, normalizedOutput, input.cacheTTLSeconds);
      }
      return normalizedOutput;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`LLM provider ${providerId} failed`, {
        taskTag: input.taskTag,
        error: lastError.message,
      });
    }
  }

  throw lastError ?? new Error("All LLM providers in chain failed");
}

export const __llmProviderTestUtils = {
  clearCache() {
    __llmCacheTestUtils.clearMemoryCache();
  },
};
