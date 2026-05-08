import { kv } from "@vercel/kv";

export interface QuotaOptions {
  period: "daily" | "monthly";
  limit: number;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
  resetAt: number;
}

interface FallbackCounter {
  used: number;
  expiresAt: number;
}

const DAILY_TTL_SECONDS = 86_400 * 2;
const MONTHLY_TTL_SECONDS = 86_400 * 35;

const fallbackCounters = new Map<string, FallbackCounter>();
let warnedAboutFallback = false;

function hasKvClient() {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.incrby === "function" &&
    typeof kv.decrby === "function" &&
    typeof kv.expire === "function" &&
    typeof kv.get === "function",
  );
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory quota fallback (single instance only)");
}

function assertOptions(amount: number | null, options: QuotaOptions) {
  if (amount !== null && (!Number.isFinite(amount) || amount < 1)) {
    throw new Error("Quota amount must be at least 1");
  }
  if (!Number.isFinite(options.limit) || options.limit < 1) {
    throw new Error("Quota limit must be at least 1");
  }
}

function getPeriodState(options: QuotaOptions, now = new Date()) {
  const iso = now.toISOString();

  if (options.period === "daily") {
    const periodKey = iso.slice(0, 10);
    const resetAt = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    );
    return {
      periodKey,
      resetAt,
      ttlSeconds: DAILY_TTL_SECONDS,
    };
  }

  const periodKey = iso.slice(0, 7);
  const resetAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  return {
    periodKey,
    resetAt,
    ttlSeconds: MONTHLY_TTL_SECONDS,
  };
}

function buildKey(key: string, options: QuotaOptions, periodKey: string) {
  return `quota:${options.period}:${key}:${periodKey}`;
}

function buildResult(used: number, limit: number, resetAt: number): QuotaResult {
  return {
    allowed: used <= limit,
    used,
    remaining: Math.max(0, limit - used),
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

function readFallback(fullKey: string, now: number) {
  cleanupExpiredFallbackCounters(now);
  return fallbackCounters.get(fullKey)?.used ?? 0;
}

async function consumeFallbackQuota(
  fullKey: string,
  amount: number,
  options: QuotaOptions,
  resetAt: number,
): Promise<QuotaResult> {
  warnFallbackOnce();
  const now = Date.now();
  const currentUsed = readFallback(fullKey, now);
  const nextUsed = currentUsed + amount;

  if (nextUsed > options.limit) {
    return {
      allowed: false,
      used: currentUsed,
      remaining: 0,
      resetAt,
    };
  }

  fallbackCounters.set(fullKey, {
    used: nextUsed,
    expiresAt: resetAt,
  });

  return buildResult(nextUsed, options.limit, resetAt);
}

async function peekFallbackQuota(
  fullKey: string,
  options: QuotaOptions,
  resetAt: number,
): Promise<QuotaResult> {
  warnFallbackOnce();
  const used = readFallback(fullKey, Date.now());
  return buildResult(used, options.limit, resetAt);
}

export async function consumeQuota(
  key: string,
  amount: number,
  options: QuotaOptions,
): Promise<QuotaResult> {
  assertOptions(amount, options);

  const { periodKey, resetAt, ttlSeconds } = getPeriodState(options);
  const fullKey = buildKey(key, options, periodKey);

  if (!hasKvClient()) {
    return consumeFallbackQuota(fullKey, amount, options, resetAt);
  }

  const used = await kv.incrby(fullKey, amount);
  if (used === amount) {
    await kv.expire(fullKey, ttlSeconds);
  }

  if (used > options.limit) {
    await kv.decrby(fullKey, amount);
    return {
      allowed: false,
      used: used - amount,
      remaining: 0,
      resetAt,
    };
  }

  return buildResult(used, options.limit, resetAt);
}

export async function peekQuota(key: string, options: QuotaOptions): Promise<QuotaResult> {
  assertOptions(null, options);

  const { periodKey, resetAt } = getPeriodState(options);
  const fullKey = buildKey(key, options, periodKey);

  if (!hasKvClient()) {
    return peekFallbackQuota(fullKey, options, resetAt);
  }

  const used = Number((await kv.get(fullKey)) ?? 0);
  return buildResult(used, options.limit, resetAt);
}
