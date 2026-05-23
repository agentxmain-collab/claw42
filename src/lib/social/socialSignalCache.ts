import {
  SOCIAL_SIGNAL_CACHE_TTL_MS,
  type SocialSignalSnapshot,
} from "@/lib/social/socialSignalTypes";

const cache = new Map<string, { expiresAt: number; value: SocialSignalSnapshot }>();

export function clearSocialSignalCacheForTests() {
  cache.clear();
}

export async function getCachedSocialSignals({
  cacheKey,
  now = Date.now(),
  fetcher,
}: {
  cacheKey: string;
  now?: number;
  fetcher: () => Promise<SocialSignalSnapshot>;
}) {
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > now) return existing.value;

  const value = await fetcher();
  cache.set(cacheKey, {
    expiresAt: now + SOCIAL_SIGNAL_CACHE_TTL_MS,
    value,
  });
  return value;
}
