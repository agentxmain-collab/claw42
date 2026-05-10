import type { StreamEntry, WatchEntryMeta } from "@/modules/agent-watch/types";

const RETENTION_MS = 12 * 60 * 60 * 1000;
const KV_TTL_SECONDS = 13 * 60 * 60;
const MAX_ENTRIES_TOTAL = 500;
const KV_KEY = "claw42:watch:history:v1";

interface KvClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

const USE_KV = process.env.USE_PERSISTENT_KV === "true";
const memoryStore: StreamEntry[] = [];
let kvClientPromise: Promise<KvClient | null> | null = null;
let warnedKvFallback = false;

function warnKvFallback(error: unknown) {
  if (warnedKvFallback) return;
  warnedKvFallback = true;
  console.warn("[claw42] watch history KV unavailable, falling back to in-memory", error);
}

async function getKvClient(): Promise<KvClient | null> {
  if (!USE_KV) return null;
  if (!kvClientPromise) {
    kvClientPromise = new Function("return import('@vercel/kv')")()
      .then((module: { kv?: KvClient }) => module.kv ?? null)
      .catch((error: unknown) => {
        warnKvFallback(error);
        return null;
      });
  }
  return kvClientPromise;
}

function pruneEntries(entries: StreamEntry[], now = Date.now()): StreamEntry[] {
  const cutoff = now - RETENTION_MS;
  return entries
    .filter((entry) => entry.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_ENTRIES_TOTAL);
}

function appendMemoryEntry(entry: StreamEntry, now = Date.now()) {
  const pruned = pruneEntries([...memoryStore, entry], now);
  memoryStore.length = 0;
  memoryStore.push(...pruned);
}

function hasCompleteMeta(meta: WatchEntryMeta | undefined): meta is WatchEntryMeta {
  return Boolean(
    meta &&
      (meta.visibility === "public" || meta.visibility === "debug") &&
      ["low", "medium", "high", "critical"].includes(meta.importance) &&
      ["market_signal", "news", "pm_decision", "team_discussion", "cron_heartbeat", "fallback"].includes(
        meta.sourceTrigger,
      ) &&
      Array.isArray(meta.evidenceIds),
  );
}

export async function appendWatchHistoryEntry(
  entry: StreamEntry & { meta: WatchEntryMeta },
): Promise<void> {
  if (!hasCompleteMeta(entry.meta)) {
    throw new Error("watch history entry meta is required");
  }
  await appendWatchEntry(entry);
}

export async function appendWatchEntry(entry: StreamEntry): Promise<void> {
  const now = Date.now();
  const kv = await getKvClient();
  if (!kv) {
    appendMemoryEntry(entry, now);
    return;
  }

  try {
    const existing = (await kv.get<StreamEntry[]>(KV_KEY)) ?? [];
    const pruned = pruneEntries([...existing, entry], now);
    await kv.set(KV_KEY, pruned, { ex: KV_TTL_SECONDS });
  } catch (error) {
    warnKvFallback(error);
    appendMemoryEntry(entry, now);
  }
}

export async function getWatchHistory(options: { before?: number; limit?: number } = {}): Promise<{
  entries: StreamEntry[];
  hasMore: boolean;
  oldestTs: number | null;
}> {
  const before = options.before ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 30, 100));
  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  const kv = await getKvClient();
  let all = memoryStore;

  if (kv) {
    try {
      all = (await kv.get<StreamEntry[]>(KV_KEY)) ?? [];
      const pruned = pruneEntries(all, now);
      if (pruned.length !== all.length) {
        void kv.set(KV_KEY, pruned, { ex: KV_TTL_SECONDS }).catch(warnKvFallback);
      }
      all = pruned;
    } catch (error) {
      warnKvFallback(error);
      all = memoryStore;
    }
  }

  const filtered = all
    .filter((entry) => entry.ts < before && entry.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts);
  const entries = filtered.slice(0, limit);
  const oldestTs = entries.length > 0 ? (entries[entries.length - 1]?.ts ?? null) : null;

  return {
    entries,
    hasMore: filtered.length > limit,
    oldestTs,
  };
}

export function __resetWatchHistoryForTests() {
  memoryStore.length = 0;
  warnedKvFallback = false;
}
