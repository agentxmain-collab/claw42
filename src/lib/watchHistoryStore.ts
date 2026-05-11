import type { StreamEntry, WatchEntryMeta } from "@/modules/agent-watch/types";
import { kv as vercelKv } from "@vercel/kv";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";

const RETENTION_MS = 12 * 60 * 60 * 1000;
const KV_TTL_SECONDS = 13 * 60 * 60;
const MAX_ENTRIES_TOTAL = 500;
const LEGACY_KV_KEY = "claw42:watch:history:v1";
const KV_KEY_PREFIX = "claw42:watch:history:v2:";

interface KvClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

const USE_KV = process.env.USE_PERSISTENT_KV === "true";
const memoryStore = new Map<Locale, StreamEntry[]>();
let warnedKvFallback = false;

function warnKvFallback(error: unknown) {
  if (warnedKvFallback) return;
  warnedKvFallback = true;
  console.warn("[claw42] watch history KV unavailable, falling back to in-memory", error);
}

async function getKvClient(): Promise<KvClient | null> {
  if (!USE_KV) return null;
  return vercelKv as KvClient;
}

function pruneEntries(entries: StreamEntry[], now = Date.now()): StreamEntry[] {
  const cutoff = now - RETENTION_MS;
  return entries
    .filter((entry) => entry.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_ENTRIES_TOTAL);
}

function appendMemoryEntry(entry: StreamEntry, now = Date.now()) {
  const locale = localeForEntry(entry);
  const current = memoryStore.get(locale) ?? [];
  memoryStore.set(locale, pruneEntries([...current, ensureEntryLocale(entry, locale)], now));
}

function hasCompleteMeta(meta: WatchEntryMeta | undefined): meta is WatchEntryMeta {
  return Boolean(
    meta &&
    (meta.visibility === "public" || meta.visibility === "debug") &&
    ["low", "medium", "high", "critical"].includes(meta.importance) &&
    [
      "market_signal",
      "news",
      "pm_decision",
      "team_discussion",
      "cron_heartbeat",
      "fallback",
    ].includes(meta.sourceTrigger) &&
    Array.isArray(meta.evidenceIds) &&
    meta.locale === normalizeWatchLocale(meta.locale),
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
  const locale = localeForEntry(entry);
  const normalizedEntry = ensureEntryLocale(entry, locale);
  const kv = await getKvClient();
  if (!kv) {
    appendMemoryEntry(normalizedEntry, now);
    return;
  }

  try {
    const key = kvKeyForLocale(locale);
    const existing = (await kv.get<StreamEntry[]>(key)) ?? [];
    const pruned = pruneEntries(
      [...existing.map((item) => ensureEntryLocale(item, locale)), normalizedEntry],
      now,
    );
    await kv.set(key, pruned, { ex: KV_TTL_SECONDS });
  } catch (error) {
    warnKvFallback(error);
    appendMemoryEntry(normalizedEntry, now);
  }
}

export async function getWatchHistory(
  options: {
    before?: number;
    since?: number;
    limit?: number;
    windowMinutes?: number;
    locale?: Locale;
  } = {},
): Promise<{
  entries: StreamEntry[];
  hasMore: boolean;
  oldestTs: number | null;
}> {
  const before = options.before ?? Date.now();
  const since = options.since;
  const limit = Math.max(1, Math.min(options.limit ?? 30, 100));
  const now = Date.now();
  const locale = normalizeWatchLocale(options.locale);
  const windowMs = Math.max(1, Math.min(options.windowMinutes ?? 720, 720)) * 60_000;
  const cutoff = now - Math.min(RETENTION_MS, windowMs);
  const kv = await getKvClient();
  let all = memoryStore.get(locale) ?? [];

  if (kv) {
    try {
      all = (await kv.get<StreamEntry[]>(kvKeyForLocale(locale))) ?? [];
      if (all.length === 0 && locale === LEGACY_WATCH_LOCALE) {
        all = (await kv.get<StreamEntry[]>(LEGACY_KV_KEY)) ?? [];
      }
      const pruned = pruneEntries(
        all.map((entry) => ensureEntryLocale(entry, locale)),
        now,
      );
      if (pruned.length !== all.length) {
        void kv.set(kvKeyForLocale(locale), pruned, { ex: KV_TTL_SECONDS }).catch(warnKvFallback);
      }
      all = pruned;
    } catch (error) {
      warnKvFallback(error);
      all = memoryStore.get(locale) ?? [];
    }
  }

  const filtered = all
    .filter(
      (entry) =>
        entry.ts < before && entry.ts >= cutoff && (since === undefined || entry.ts > since),
    )
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
  memoryStore.clear();
  warnedKvFallback = false;
}

function kvKeyForLocale(locale: Locale) {
  return `${KV_KEY_PREFIX}${normalizeWatchLocale(locale)}`;
}

function localeForEntry(entry: StreamEntry) {
  return normalizeWatchLocale(entry.meta?.locale);
}

function ensureEntryLocale(entry: StreamEntry, locale: Locale): StreamEntry {
  if (!entry.meta) return entry;
  return {
    ...entry,
    meta: {
      ...entry.meta,
      locale: normalizeWatchLocale(entry.meta.locale, locale),
    },
  };
}
