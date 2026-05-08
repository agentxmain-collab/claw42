import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import type { LLMOutput } from "@/lib/llm/providers/types";

type CacheKvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

type MemoryCacheEntry = {
  output: LLMOutput;
  expiresAt: number;
};

const DEFAULT_TTL_SECONDS = 300;
const memoryCache = new Map<string, MemoryCacheEntry>();
let warnedAboutFallback = false;

function hasKvClient(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.get === "function" &&
    typeof kv.set === "function",
  );
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory LLM cache fallback (single instance only)");
}

function cleanupMemoryCache(now = Date.now()) {
  memoryCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  });
}

export function hashCacheKey(prompt: string, taskTag: string, systemPrompt?: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(prompt);
  hash.update("|");
  hash.update(taskTag);
  if (systemPrompt) {
    hash.update("|");
    hash.update(systemPrompt);
  }
  return `llm-cache:${hash.digest("hex").slice(0, 16)}`;
}

export async function getFromCache(cacheKey: string): Promise<LLMOutput | null> {
  if (hasKvClient()) {
    return ((await (kv as CacheKvClient).get<LLMOutput>(cacheKey)) ?? null) as LLMOutput | null;
  }

  warnFallbackOnce();
  cleanupMemoryCache();
  const cached = memoryCache.get(cacheKey);
  return cached?.output ?? null;
}

export async function setCache(
  cacheKey: string,
  output: LLMOutput,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (ttlSeconds <= 0) return;

  if (hasKvClient()) {
    await (kv as CacheKvClient).set(cacheKey, output, { ex: ttlSeconds });
    return;
  }

  warnFallbackOnce();
  cleanupMemoryCache();
  memoryCache.set(cacheKey, {
    output,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export const __llmCacheTestUtils = {
  clearMemoryCache() {
    memoryCache.clear();
    warnedAboutFallback = false;
  },
  memoryCache,
};
