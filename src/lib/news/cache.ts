import type { NewsItem } from "@/lib/types";
import type { NewsSourceId } from "@/lib/news/sourceRegistry";

type UsageBand = "low" | "medium" | "high";

interface CacheEntry {
  items: NewsItem[];
  expiresAt: number;
}

const TTL_BY_BAND: Record<UsageBand, number> = {
  low: 5 * 60_000,
  medium: 3 * 60_000,
  high: 60_000,
};

const NEGATIVE_CACHE_MS = 30_000;
const cache = new Map<string, CacheEntry>();
const negativeCache = new Map<string, number>();

function usageBand(): UsageBand {
  const value = process.env.NEWS_USAGE_BAND;
  return value === "medium" || value === "high" ? value : "low";
}

export function getCacheKey(sourceId: NewsSourceId, opts: { limit: number }) {
  return `${sourceId}:${opts.limit}`;
}

export function getCachedNews(sourceId: NewsSourceId, opts: { limit: number }, now = Date.now()) {
  const key = getCacheKey(sourceId, opts);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry.items.slice(0, opts.limit);
}

export function setCachedNews(
  sourceId: NewsSourceId,
  opts: { limit: number },
  items: NewsItem[],
  now = Date.now(),
) {
  cache.set(getCacheKey(sourceId, opts), {
    items: items.slice(0, opts.limit),
    expiresAt: now + TTL_BY_BAND[usageBand()],
  });
}

export function setNegativeCache(sourceId: NewsSourceId, durationMs = NEGATIVE_CACHE_MS) {
  negativeCache.set(sourceId, Date.now() + durationMs);
}

export function isNegativeCached(sourceId: NewsSourceId, now = Date.now()) {
  const expiresAt = negativeCache.get(sourceId);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    negativeCache.delete(sourceId);
    return false;
  }
  return true;
}

export function newsCacheSnapshot(now = Date.now()) {
  for (const [key, entry] of Array.from(cache.entries())) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  for (const [key, expiresAt] of Array.from(negativeCache.entries())) {
    if (expiresAt <= now) negativeCache.delete(key);
  }

  return {
    positiveEntries: cache.size,
    negativeEntries: negativeCache.size,
  };
}
