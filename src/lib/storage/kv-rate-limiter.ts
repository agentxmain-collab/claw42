import { kv } from "@vercel/kv";

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface FallbackCounter {
  count: number;
  expiresAt: number;
}

const fallbackCounters = new Map<string, FallbackCounter>();
let warnedAboutFallback = false;

function hasKvClient() {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.incr === "function" &&
    typeof kv.expire === "function",
  );
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory rate limiter fallback (single instance only)");
}

function assertOptions(options: RateLimitOptions) {
  if (!Number.isFinite(options.max) || options.max < 1) {
    throw new Error("Rate limit max must be at least 1");
  }
  if (!Number.isFinite(options.windowMs) || options.windowMs < 1) {
    throw new Error("Rate limit windowMs must be at least 1");
  }
}

function buildResult(count: number, max: number, resetAt: number): RateLimitResult {
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt,
  };
}

function cleanupExpiredFallbackCounters(now: number) {
  fallbackCounters.forEach((counter, key) => {
    if (counter.expiresAt <= now) {
      fallbackCounters.delete(key);
    }
  });
}

async function checkFallbackRateLimit(
  fullKey: string,
  options: RateLimitOptions,
  now: number,
  resetAt: number,
): Promise<RateLimitResult> {
  warnFallbackOnce();
  cleanupExpiredFallbackCounters(now);

  const counter = fallbackCounters.get(fullKey);
  const nextCount = (counter?.count ?? 0) + 1;
  fallbackCounters.set(fullKey, {
    count: nextCount,
    expiresAt: resetAt,
  });

  return buildResult(nextCount, options.max, resetAt);
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  assertOptions(options);

  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  const resetAt = windowStart + options.windowMs;
  const fullKey = `rate:${key}:${windowStart}`;

  if (!hasKvClient()) {
    return checkFallbackRateLimit(fullKey, options, now, resetAt);
  }

  const count = await kv.incr(fullKey);
  if (count === 1) {
    await kv.expire(fullKey, Math.ceil(options.windowMs / 1000));
  }

  return buildResult(count, options.max, resetAt);
}
