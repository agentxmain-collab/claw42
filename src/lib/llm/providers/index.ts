import { trackUsage, isBudgetAutopaused, BudgetExceededError } from "@/lib/llm/budget-tracker";
import { __llmCacheTestUtils, getFromCache, setCache } from "@/lib/llm/cache";
import { anthropicProvider } from "@/lib/llm/providers/anthropic";
import { claudeHaikuProvider } from "@/lib/llm/providers/claude-haiku";
import { deepseekChatProvider } from "@/lib/llm/providers/deepseek-chat";
import { minimaxProvider } from "@/lib/llm/providers/minimax";
import { openaiProvider } from "@/lib/llm/providers/openai";
import { stubProvider } from "@/lib/llm/providers/stub";
import { recordProviderCall } from "@/lib/team/providerTelemetry";
import type { TeamProviderId } from "@/lib/team/teamRegistry";
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

export function mapTeamProviderToProviderId(providerId: TeamProviderId): ProviderId {
  switch (providerId) {
    case "deepseek":
      return "deepseek-chat";
    case "minimax":
      return "minimax";
    case "claude-haiku":
    case "claude-opus":
      return "claude-haiku";
    default:
      return "deepseek-chat";
  }
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

export async function callExactProvider(
  input: LLMInput,
  providerId: ProviderId,
): Promise<LLMOutput> {
  const startedAt = Date.now();
  const providerChain: ProviderId[] = [providerId];
  const attemptedProviders: ProviderId[] = [];
  const skippedProviders: ProviderId[] = [];
  const provider = getProvider(providerId);

  if (await isBudgetAutopaused()) {
    skippedProviders.push(providerId);
    await recordProviderCall({
      taskTag: input.taskTag,
      providerOverride: providerId,
      providerChain,
      attemptedProviders,
      skippedProviders,
      finalProvider: null,
      fallbackCount: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      cached: false,
      error: "Monthly LLM budget exceeded autopause threshold",
    });
    throw new BudgetExceededError("Monthly LLM budget exceeded autopause threshold");
  }

  try {
    if (!(await provider.isHealthy())) {
      skippedProviders.push(providerId);
      throw new Error(`Provider ${providerId} unhealthy`);
    }

    attemptedProviders.push(providerId);
    const output = await provider.generate({ ...input, providerOverride: providerId });
    const normalizedOutput = { ...output, cached: false };
    await trackUsage(provider, { ...input, providerOverride: providerId }, normalizedOutput);
    await recordProviderCall({
      taskTag: input.taskTag,
      providerOverride: providerId,
      providerChain,
      attemptedProviders,
      skippedProviders,
      finalProvider: normalizedOutput.provider,
      fallbackCount: 0,
      latencyMs: Date.now() - startedAt,
      success: true,
      cached: false,
    });
    return normalizedOutput;
  } catch (error) {
    const lastError = error instanceof Error ? error : new Error(String(error));
    console.warn(`LLM exact provider ${providerId} failed`, {
      taskTag: input.taskTag,
      error: lastError.message,
    });
    await recordProviderCall({
      taskTag: input.taskTag,
      providerOverride: providerId,
      providerChain,
      attemptedProviders,
      skippedProviders,
      finalProvider: null,
      fallbackCount: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      cached: false,
      error: lastError.message,
    });
    throw lastError;
  }
}

export async function callWithChain(input: LLMInput): Promise<LLMOutput> {
  const startedAt = Date.now();
  const providerChain = getProviderChain(input.providerOverride);
  if (input.cacheKey) {
    const cached = await getFromCache(input.cacheKey);
    if (cached) {
      await recordProviderCall({
        taskTag: input.taskTag,
        providerOverride: input.providerOverride,
        providerChain,
        attemptedProviders: [],
        skippedProviders: [],
        finalProvider: cached.provider,
        fallbackCount: 0,
        latencyMs: Date.now() - startedAt,
        success: true,
        cached: true,
        cacheHitProvider: cached.cacheHitProvider ?? cached.provider,
      });
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
  const attemptedProviders: ProviderId[] = [];
  const skippedProviders: ProviderId[] = [];
  for (const providerId of providerChain) {
    const provider = getProvider(providerId);
    try {
      if (!(await provider.isHealthy())) {
        skippedProviders.push(providerId);
        continue;
      }

      attemptedProviders.push(providerId);
      const output = await provider.generate(input);
      const normalizedOutput = { ...output, cached: false };
      await trackUsage(provider, input, normalizedOutput);
      if (input.cacheKey) {
        await setCache(input.cacheKey, normalizedOutput, input.cacheTTLSeconds);
      }
      await recordProviderCall({
        taskTag: input.taskTag,
        providerOverride: input.providerOverride,
        providerChain,
        attemptedProviders,
        skippedProviders,
        finalProvider: normalizedOutput.provider,
        fallbackCount: Math.max(0, providerChain.indexOf(providerId)),
        latencyMs: Date.now() - startedAt,
        success: true,
        cached: false,
      });
      return normalizedOutput;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`LLM provider ${providerId} failed`, {
        taskTag: input.taskTag,
        error: lastError.message,
      });
    }
  }

  await recordProviderCall({
    taskTag: input.taskTag,
    providerOverride: input.providerOverride,
    providerChain,
    attemptedProviders,
    skippedProviders,
    finalProvider: null,
    fallbackCount: providerChain.length,
    latencyMs: Date.now() - startedAt,
    success: false,
    cached: false,
    error: lastError?.message ?? "All LLM providers in chain failed",
  });
  throw lastError ?? new Error("All LLM providers in chain failed");
}

export const __llmProviderTestUtils = {
  clearCache() {
    __llmCacheTestUtils.clearMemoryCache();
  },
};
