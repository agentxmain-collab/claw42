import { kv } from "@/lib/kv-shim";
import { decisionRecordDirectKey } from "@/lib/team/decisionRecordDirectStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";

export const PUBLIC_CARD_RETENTION_MS = 60 * 24 * 60 * 60_000;
export const PUBLIC_CARD_RETENTION_SECONDS = 60 * 24 * 60 * 60;
export const PUBLIC_CARD_TOTAL_CAP = 8_000;
export const PUBLIC_CARD_PAGE_SIZE = 15;
export const PUBLIC_CARD_INDEX_ESTIMATED_ENTRY_BYTES = 500;

const PUBLIC_CARD_INDEX_PREFIX = "claw42:public-card-index:v1:";

export interface PublicCardIndexEntry {
  id: string;
  symbol: string;
  decisionDir: "long" | "short" | "neutral" | "wait" | null;
  newsHeadline: string | null;
  createdAt: string;
  recordKey: string;
  evidenceId: string | null;
}

export interface PublicCardIndexPage {
  entries: PublicCardIndexEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  oldestAt: string | null;
}

export type PublicCardIndexClient = {
  zadd(key: string, value: { score: number; member: string }): Promise<unknown>;
  zrange<T extends unknown[]>(
    key: string,
    start: number,
    stop: number,
    options?: { rev?: boolean },
  ): Promise<T>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
};

export function publicCardIndexKey(locale: Locale) {
  return `${PUBLIC_CARD_INDEX_PREFIX}${normalizeWatchLocale(locale)}`;
}

export function buildPublicCardIndexEntry(
  record: StrategyDecisionRecord,
): PublicCardIndexEntry | null {
  const event = projectDecisionRecordToPublicEvent(record);
  if (!event || event.payload.kind !== "pm_decision") return null;
  const evidenceId = event.evidenceIds[0] ?? null;
  return {
    id: event.id,
    symbol: event.payload.symbol,
    decisionDir: event.payload.tradeDecision?.direction ?? analystDirectionFromRecord(record),
    newsHeadline: null,
    createdAt: record.createdAt,
    recordKey: decisionRecordDirectKey(record.locale, record.id),
    evidenceId,
  };
}

export async function writePublicCardIndexEntry(
  record: StrategyDecisionRecord,
  { client = kv as PublicCardIndexClient }: { client?: PublicCardIndexClient } = {},
) {
  if (!hasKvConfig(client)) return null;
  const entry = buildPublicCardIndexEntry(record);
  if (!entry) return null;
  const score = Date.parse(entry.createdAt);
  if (!Number.isFinite(score)) return null;
  await client.zadd(publicCardIndexKey(record.locale), {
    score,
    member: JSON.stringify(entry),
  });
  return entry;
}

export async function cleanupPublicCardIndex(
  locale: Locale,
  {
    client = kv as PublicCardIndexClient,
    now = Date.now(),
  }: { client?: PublicCardIndexClient; now?: number } = {},
) {
  if (!hasKvConfig(client)) return { removedByAge: 0, removedByCap: 0, count: 0 };
  const key = publicCardIndexKey(locale);
  const cutoff = now - PUBLIC_CARD_RETENTION_MS;
  const removedByAge = await client.zremrangebyscore(key, 0, cutoff);
  const count = await client.zcard(key);
  const overflow = Math.max(0, count - PUBLIC_CARD_TOTAL_CAP);
  const removedByCap = overflow > 0 ? await client.zremrangebyrank(key, 0, overflow - 1) : 0;
  return {
    removedByAge,
    removedByCap,
    count: count - removedByCap,
  };
}

export async function readPublicCardIndexPage(
  locale: Locale,
  {
    page = 1,
    pageSize = PUBLIC_CARD_PAGE_SIZE,
    client = kv as PublicCardIndexClient,
  }: { page?: number; pageSize?: number; client?: PublicCardIndexClient } = {},
): Promise<PublicCardIndexPage> {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedPageSize = Math.max(1, Math.min(Math.floor(pageSize), 100));
  if (!hasKvConfig(client)) {
    return {
      entries: [],
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount: 0,
      hasMore: false,
      oldestAt: null,
    };
  }
  const key = publicCardIndexKey(locale);
  const start = (normalizedPage - 1) * normalizedPageSize;
  const stop = start + normalizedPageSize - 1;
  const [members, totalCount, oldest] = await Promise.all([
    client.zrange<unknown[]>(key, start, stop, { rev: true }),
    client.zcard(key),
    client.zrange<unknown[]>(key, 0, 0),
  ]);
  const entries = members.map(parsePublicCardIndexEntry).filter(isPublicCardIndexEntry);
  const oldestEntry = oldest.map(parsePublicCardIndexEntry).find(isPublicCardIndexEntry) ?? null;
  return {
    entries,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
    hasMore: start + entries.length < totalCount,
    oldestAt: oldestEntry?.createdAt ?? null,
  };
}

export async function getPublicCardIndexStats(
  locale: Locale,
  { client = kv as PublicCardIndexClient }: { client?: PublicCardIndexClient } = {},
) {
  const page = await readPublicCardIndexPage(locale, { page: 1, pageSize: 1, client });
  return {
    count: page.totalCount,
    oldestAt: page.oldestAt,
    estimatedBytes: page.totalCount * PUBLIC_CARD_INDEX_ESTIMATED_ENTRY_BYTES,
  };
}

function analystDirectionFromRecord(record: StrategyDecisionRecord) {
  const directional = record.analystInputs
    .map((input) => input.direction)
    .find((direction) => direction === "long" || direction === "short");
  return directional ?? record.analystInputs[0]?.direction ?? null;
}

function parsePublicCardIndexEntry(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isPublicCardIndexEntry(value: unknown): value is PublicCardIndexEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<PublicCardIndexEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.symbol === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.recordKey === "string"
  );
}

function hasKvConfig(client: PublicCardIndexClient) {
  if (isMemoryClient(client)) return true;
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

type MemoryPublicCardIndexClient = PublicCardIndexClient & {
  __memoryPublicCardIndexClient: true;
};

function createMemoryClient(): MemoryPublicCardIndexClient {
  const store = new Map<string, Map<string, number>>();
  function sorted(key: string) {
    return Array.from(store.get(key)?.entries() ?? []).sort((a, b) => {
      const scoreDelta = a[1] - b[1];
      if (scoreDelta !== 0) return scoreDelta;
      return a[0].localeCompare(b[0]);
    });
  }
  return {
    __memoryPublicCardIndexClient: true,
    async zadd(key, value) {
      const zset = store.get(key) ?? new Map<string, number>();
      zset.set(value.member, value.score);
      store.set(key, zset);
      return 1;
    },
    async zrange<T extends unknown[]>(
      key: string,
      start: number,
      stop: number,
      options?: { rev?: boolean },
    ) {
      const items = options?.rev ? sorted(key).reverse() : sorted(key);
      return items.slice(start, stop + 1).map(([member]) => member) as T;
    },
    async zcard(key) {
      return store.get(key)?.size ?? 0;
    },
    async zremrangebyscore(key, min, max) {
      const zset = store.get(key);
      if (!zset) return 0;
      const minScore = Number(min);
      const maxScore = Number(max);
      let removed = 0;
      for (const [member, score] of Array.from(zset.entries())) {
        if (score >= minScore && score <= maxScore) {
          zset.delete(member);
          removed += 1;
        }
      }
      return removed;
    },
    async zremrangebyrank(key, start, stop) {
      const zset = store.get(key);
      if (!zset) return 0;
      const members = sorted(key)
        .slice(start, stop + 1)
        .map(([member]) => member);
      for (const member of members) zset.delete(member);
      return members.length;
    },
  };
}

function isMemoryClient(client: PublicCardIndexClient): client is MemoryPublicCardIndexClient {
  if (client === (kv as PublicCardIndexClient)) return false;
  return (client as Partial<MemoryPublicCardIndexClient>).__memoryPublicCardIndexClient === true;
}

export const __publicCardIndexTestUtils = {
  createMemoryClient,
  isMemoryClient,
};
