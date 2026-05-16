import { kv } from "@vercel/kv";

export interface LockOptions {
  ttlMs?: number;
  waitMs?: number;
}

export interface LockHandle {
  key: string;
  token: string;
  acquiredAt: number;
}

export interface LockSnapshot {
  key: string;
  locked: boolean;
  expiresAt: number | null;
}

type KvClient = {
  set(key: string, value: string, options: { nx: true; px: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  eval?(script: string, keys: string[], args: string[]): Promise<unknown>;
};

type MemoryLock = {
  token: string;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_WAIT_MS = 0;
const MIN_RETRY_MS = 50;
const MAX_RETRY_MS = 1_000;
const lockPrefix = "lock:";
const memoryLocks = new Map<string, MemoryLock>();
let warnedAboutFallback = false;

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export class LockBusyError extends Error {
  constructor(
    public readonly key: string,
    public readonly waitedMs: number,
  ) {
    super(`Failed to acquire lock for "${key}" within ${waitedMs}ms`);
    this.name = "LockBusyError";
  }
}

export async function tryAcquireLock(
  key: string,
  options: LockOptions = {},
): Promise<LockHandle | null> {
  const ttlMs = normalizePositiveInteger(options.ttlMs, DEFAULT_TTL_MS);
  const waitMs = normalizeNonNegativeInteger(options.waitMs, DEFAULT_WAIT_MS);
  const startedAt = Date.now();
  let delayMs = MIN_RETRY_MS;

  do {
    const token = crypto.randomUUID();
    const acquired = await acquireOnce(storageKey(key), token, ttlMs);
    if (acquired) {
      return {
        key,
        token,
        acquiredAt: Date.now(),
      };
    }

    if (waitMs <= 0 || Date.now() - startedAt >= waitMs) return null;
    const remainingMs = Math.max(0, waitMs - (Date.now() - startedAt));
    await sleep(Math.min(delayMs, remainingMs));
    delayMs = Math.min(MAX_RETRY_MS, delayMs * 2);
  } while (Date.now() - startedAt <= waitMs);

  return null;
}

export async function releaseLock(handle: LockHandle): Promise<boolean> {
  const key = storageKey(handle.key);
  if (!hasKvConfig()) return releaseMemoryLock(key, handle.token);

  try {
    const client = kv as KvClient;
    if (typeof client.eval === "function") {
      const result = await client.eval(RELEASE_SCRIPT, [key], [handle.token]);
      return result === 1 || result === "1";
    }
  } catch {
    // Vercel KV may not expose eval on every backing store. Fall back to a
    // token-checked GET+DEL so release never deletes a lock owned by another token.
  }

  return releaseWithTokenCheckedFallback(key, handle.token);
}

export async function checkLock(key: string): Promise<LockSnapshot> {
  const fullKey = storageKey(key);
  if (!hasKvConfig()) return checkMemoryLock(key, fullKey);

  try {
    const existing = await (kv as KvClient).get(fullKey);
    return {
      key,
      locked: existing !== null && existing !== undefined,
      expiresAt: null,
    };
  } catch {
    warnFallbackOnce();
    return checkMemoryLock(key, fullKey);
  }
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const waitedMs = normalizeNonNegativeInteger(options.waitMs, DEFAULT_WAIT_MS);
  const handle = await tryAcquireLock(key, options);
  if (!handle) throw new LockBusyError(key, waitedMs);

  try {
    return await fn();
  } finally {
    await releaseLock(handle);
  }
}

async function acquireOnce(key: string, token: string, ttlMs: number) {
  if (!hasKvConfig()) return acquireMemoryLock(key, token, ttlMs);

  try {
    const result = await (kv as KvClient).set(key, token, { nx: true, px: ttlMs });
    return result === "OK" || result === "ok" || result === true;
  } catch {
    warnFallbackOnce();
    return acquireMemoryLock(key, token, ttlMs);
  }
}

function acquireMemoryLock(key: string, token: string, ttlMs: number) {
  warnFallbackOnce();
  cleanupExpiredMemoryLock(key);
  if (memoryLocks.has(key)) return false;
  memoryLocks.set(key, { token, expiresAt: Date.now() + ttlMs });
  return true;
}

function releaseMemoryLock(key: string, token: string) {
  cleanupExpiredMemoryLock(key);
  const existing = memoryLocks.get(key);
  if (!existing || existing.token !== token) return false;
  memoryLocks.delete(key);
  return true;
}

function checkMemoryLock(key: string, fullKey: string): LockSnapshot {
  cleanupExpiredMemoryLock(fullKey);
  const existing = memoryLocks.get(fullKey);
  return {
    key,
    locked: Boolean(existing),
    expiresAt: existing?.expiresAt ?? null,
  };
}

async function releaseWithTokenCheckedFallback(key: string, token: string) {
  const client = kv as KvClient;
  const existing = await client.get(key);
  if (existing !== token) return false;
  await client.del(key);
  return true;
}

function cleanupExpiredMemoryLock(key: string) {
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt <= Date.now()) memoryLocks.delete(key);
}

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function storageKey(key: string) {
  return `${lockPrefix}${key}`;
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory lock fallback (single instance only)");
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __kvLockTestUtils = {
  clearMemoryLocks() {
    memoryLocks.clear();
    warnedAboutFallback = false;
  },
  memoryLocks,
};
