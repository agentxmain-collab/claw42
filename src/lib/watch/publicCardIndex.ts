import { kv } from "@/lib/kv-shim";
import {
  decisionRecordDirectKey,
  persistDecisionRecordDirect,
  readDecisionRecordDirect,
} from "@/lib/team/decisionRecordDirectStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";

export const PUBLIC_CARD_RETENTION_MS = 60 * 24 * 60 * 60_000;
export const PUBLIC_CARD_RETENTION_SECONDS = 60 * 24 * 60 * 60;
export const PUBLIC_CARD_TOTAL_CAP = 8_000;
export const PUBLIC_CARD_PAGE_SIZE = 15;
export const PUBLIC_CARD_INDEX_ESTIMATED_ENTRY_BYTES = 500;
export const PUBLIC_CARD_INDEX_WRITE_FAILURE_LOG_CAP = 100;
export const PUBLIC_CARD_INDEX_STRATEGY_PRUNE_SCAN_CAP = 200;

const PUBLIC_CARD_INDEX_PREFIX = "claw42:public-card-index:v1:";
const PUBLIC_CARD_INDEX_WRITE_FAILURE_LOG_PREFIX = "claw42:public-card-index:v1:write-failure-log:";

export interface PublicCardIndexEntry {
  id: string;
  symbol: string;
  decisionDir: "long" | "short";
  newsHeadline: string | null;
  createdAt: string;
  resolvedAt?: string | null;
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

export interface PublicCardIndexRange {
  entries: PublicCardIndexEntry[];
  offset: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
  oldestAt: string | null;
}

export interface PublicCardIndexWriteFailureMarker {
  recordId: string;
  locale: Locale;
  symbol: string;
  recordCreatedAt: string;
  failedAt: string;
  stage: string;
  error: string;
}

export interface PublicCardIndexBackfillResult {
  ok: true;
  locale: Locale;
  dryRun: boolean;
  recordsScanned: number;
  recordsWritten: number;
  recordsSkippedReason: {
    localeMismatch: number;
    notProjectable: number;
    invalidCreatedAt: number;
    writeFailed: number;
  };
  indexCountAfter: number;
  removedByAge: number;
  removedByCap: number;
  removedByNonStrategy: number;
  durationMs: number;
}

export interface PublicCardIndexRebuildResult {
  ok: true;
  locale: Locale;
  dryRun: boolean;
  recordsRead: number;
  candidateCount: number;
  rebuiltCount: number;
  addedCount: number;
  removedCount: number;
  kept: number;
  alreadyIndexed: number;
  skippedNonStrategy: number;
  invalidCreatedAt: number;
  errors: number;
  indexCountAfter: number;
  durationMs: number;
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
  zrem(key: string, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
};

export type PublicCardIndexFailureLogClient = {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
};

export function publicCardIndexKey(locale: Locale) {
  return `${PUBLIC_CARD_INDEX_PREFIX}${normalizeWatchLocale(locale)}`;
}

export function publicCardIndexWriteFailureLogKey(locale: Locale) {
  return `${PUBLIC_CARD_INDEX_WRITE_FAILURE_LOG_PREFIX}${normalizeWatchLocale(locale)}`;
}

export function buildPublicCardIndexEntry(
  record: StrategyDecisionRecord,
): PublicCardIndexEntry | null {
  const decision = record.tradeDecision;
  if (!hasPublicStrategy(record) || !decision || !isDirectionalDecision(decision.direction)) {
    return null;
  }
  const decisionDir = decision.direction;
  const event = projectDecisionRecordToPublicEvent(record);
  if (!event || event.payload.kind !== "pm_decision") return null;
  const evidenceId = event.evidenceIds[0] ?? null;
  return {
    id: event.id,
    symbol: event.payload.symbol,
    decisionDir,
    newsHeadline: null,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt ?? null,
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
    pruneStrategies = false,
    readRecord = readIndexedDecisionRecord,
  }: {
    client?: PublicCardIndexClient;
    now?: number;
    pruneStrategies?: boolean;
    readRecord?: (entry: PublicCardIndexEntry) => Promise<StrategyDecisionRecord | null>;
  } = {},
) {
  if (!hasKvConfig(client)) {
    return { removedByAge: 0, removedByCap: 0, removedByNonStrategy: 0, count: 0 };
  }
  const key = publicCardIndexKey(locale);
  const cutoff = now - PUBLIC_CARD_RETENTION_MS;
  const removedByAge = await client.zremrangebyscore(key, 0, cutoff);
  const removedByNonStrategy = pruneStrategies
    ? await prunePublicCardIndexByStrategy(locale, {
        client,
        readRecord,
        maxMembers: PUBLIC_CARD_INDEX_STRATEGY_PRUNE_SCAN_CAP,
      })
    : 0;
  const count = await client.zcard(key);
  const overflow = Math.max(0, count - PUBLIC_CARD_TOTAL_CAP);
  const removedByCap = overflow > 0 ? await client.zremrangebyrank(key, 0, overflow - 1) : 0;
  return {
    removedByAge,
    removedByCap,
    removedByNonStrategy,
    count: count - removedByCap,
  };
}

export async function prunePublicCardIndexByStrategy(
  locale: Locale,
  {
    client = kv as PublicCardIndexClient,
    readRecord = readIndexedDecisionRecord,
    maxMembers,
  }: {
    client?: PublicCardIndexClient;
    readRecord?: (entry: PublicCardIndexEntry) => Promise<StrategyDecisionRecord | null>;
    maxMembers?: number;
  } = {},
) {
  if (!hasKvConfig(client)) return 0;
  const key = publicCardIndexKey(locale);
  const stop = maxMembers && maxMembers > 0 ? Math.floor(maxMembers) - 1 : -1;
  const members = await client.zrange<unknown[]>(key, 0, stop);
  let removed = 0;

  for (const member of members) {
    const entry = parsePublicCardIndexEntry(member);
    if (!isPublicCardIndexEntry(entry) || !isDirectionalDecision(entry.decisionDir)) {
      removed += await client.zrem(key, serializePublicCardIndexMember(member));
      continue;
    }

    const record = await readRecord(entry);
    if (!record || !hasPublicStrategy(record)) {
      removed += await client.zrem(key, serializePublicCardIndexMember(member));
    }
  }

  return removed;
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

export async function readPublicCardIndexRange(
  locale: Locale,
  {
    offset = 0,
    limit = PUBLIC_CARD_PAGE_SIZE,
    client = kv as PublicCardIndexClient,
  }: { offset?: number; limit?: number; client?: PublicCardIndexClient } = {},
): Promise<PublicCardIndexRange> {
  const normalizedOffset = Math.max(0, Math.floor(offset));
  const normalizedLimit = Math.max(1, Math.min(Math.floor(limit), PUBLIC_CARD_TOTAL_CAP));
  if (!hasKvConfig(client)) {
    return {
      entries: [],
      offset: normalizedOffset,
      limit: normalizedLimit,
      totalCount: 0,
      hasMore: false,
      oldestAt: null,
    };
  }
  const key = publicCardIndexKey(locale);
  const stop = normalizedOffset + normalizedLimit - 1;
  const [members, totalCount, oldest] = await Promise.all([
    client.zrange<unknown[]>(key, normalizedOffset, stop, { rev: true }),
    client.zcard(key),
    client.zrange<unknown[]>(key, 0, 0),
  ]);
  const entries = members.map(parsePublicCardIndexEntry).filter(isPublicCardIndexEntry);
  const oldestEntry = oldest.map(parsePublicCardIndexEntry).find(isPublicCardIndexEntry) ?? null;
  return {
    entries,
    offset: normalizedOffset,
    limit: normalizedLimit,
    totalCount,
    hasMore: normalizedOffset + entries.length < totalCount,
    oldestAt: oldestEntry?.createdAt ?? null,
  };
}

export async function readPublicCardIndexEntries(
  locale: Locale,
  {
    limit = PUBLIC_CARD_TOTAL_CAP,
    client = kv as PublicCardIndexClient,
  }: { limit?: number; client?: PublicCardIndexClient } = {},
) {
  if (!hasKvConfig(client)) return [];
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), PUBLIC_CARD_TOTAL_CAP));
  const members = await client.zrange<unknown[]>(publicCardIndexKey(locale), 0, safeLimit - 1, {
    rev: true,
  });
  return members.map(parsePublicCardIndexEntry).filter(isPublicCardIndexEntry);
}

export async function writePublicCardIndexFailureMarker(
  marker: PublicCardIndexWriteFailureMarker,
  {
    client = kv as unknown as PublicCardIndexFailureLogClient,
    cap = PUBLIC_CARD_INDEX_WRITE_FAILURE_LOG_CAP,
  }: { client?: PublicCardIndexFailureLogClient; cap?: number } = {},
) {
  if (!hasFailureLogConfig(client)) return null;
  const key = publicCardIndexWriteFailureLogKey(marker.locale);
  await client.lpush(key, JSON.stringify(marker));
  await client.ltrim(key, 0, Math.max(0, cap - 1));
  return marker;
}

export async function readPublicCardIndexWriteFailureMarkers(
  locale: Locale,
  {
    limit = PUBLIC_CARD_INDEX_WRITE_FAILURE_LOG_CAP,
    client = kv as unknown as PublicCardIndexFailureLogClient,
  }: { limit?: number; client?: PublicCardIndexFailureLogClient } = {},
) {
  if (!hasFailureLogConfig(client)) return [];
  const key = publicCardIndexWriteFailureLogKey(locale);
  const values = await client.lrange(key, 0, Math.max(0, limit - 1));
  return values.map(parsePublicCardIndexFailureMarker).filter(isPublicCardIndexFailureMarker);
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

export async function backfillPublicCardIndexFromRecords(
  records: StrategyDecisionRecord[],
  {
    locale,
    dryRun = false,
    client = kv as PublicCardIndexClient,
    now = Date.now(),
    persistRecord = persistDecisionRecordDirect,
  }: {
    locale: Locale;
    dryRun?: boolean;
    client?: PublicCardIndexClient;
    now?: number;
    persistRecord?: (record: StrategyDecisionRecord) => Promise<unknown>;
  },
): Promise<PublicCardIndexBackfillResult> {
  const startedAt = Date.now();
  const normalizedLocale = normalizeWatchLocale(locale);
  const skipped = {
    localeMismatch: 0,
    notProjectable: 0,
    invalidCreatedAt: 0,
    writeFailed: 0,
  };
  let recordsWritten = 0;

  for (const record of records) {
    if (normalizeWatchLocale(record.locale) !== normalizedLocale) {
      skipped.localeMismatch += 1;
      continue;
    }
    const entry = buildPublicCardIndexEntry(record);
    if (!entry) {
      skipped.notProjectable += 1;
      continue;
    }
    const score = Date.parse(entry.createdAt);
    if (!Number.isFinite(score)) {
      skipped.invalidCreatedAt += 1;
      continue;
    }
    if (dryRun) {
      recordsWritten += 1;
      continue;
    }
    try {
      await persistRecord(record);
      await client.zadd(publicCardIndexKey(normalizedLocale), {
        score,
        member: JSON.stringify(entry),
      });
      recordsWritten += 1;
    } catch {
      skipped.writeFailed += 1;
    }
  }

  const cleanup = dryRun
    ? {
        removedByAge: 0,
        removedByCap: 0,
        removedByNonStrategy: 0,
        count: await safeIndexCount(normalizedLocale, client),
      }
    : await cleanupPublicCardIndex(normalizedLocale, { client, now });

  return {
    ok: true,
    locale: normalizedLocale,
    dryRun,
    recordsScanned: records.length,
    recordsWritten,
    recordsSkippedReason: skipped,
    indexCountAfter: cleanup.count,
    removedByAge: cleanup.removedByAge,
    removedByCap: cleanup.removedByCap,
    removedByNonStrategy: cleanup.removedByNonStrategy,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

export async function rebuildPublicCardIndexFromRecords(
  records: StrategyDecisionRecord[],
  {
    locale,
    dryRun = false,
    client = kv as PublicCardIndexClient,
    persistRecord = persistDecisionRecordDirect,
  }: {
    locale: Locale;
    dryRun?: boolean;
    client?: PublicCardIndexClient;
    persistRecord?: (record: StrategyDecisionRecord) => Promise<unknown>;
  },
): Promise<PublicCardIndexRebuildResult> {
  const startedAt = Date.now();
  const normalizedLocale = normalizeWatchLocale(locale);
  const key = publicCardIndexKey(normalizedLocale);
  const currentMembers = hasKvConfig(client) ? await client.zrange<unknown[]>(key, 0, -1) : [];
  const currentById = new Map<string, unknown>();
  const invalidMembers: unknown[] = [];

  for (const member of currentMembers) {
    const entry = parsePublicCardIndexEntry(member);
    if (isPublicCardIndexEntry(entry)) {
      currentById.set(entry.id, member);
    } else {
      invalidMembers.push(member);
    }
  }

  const eligible = new Map<
    string,
    { record: StrategyDecisionRecord; entry: PublicCardIndexEntry; score: number }
  >();
  let skippedNonStrategy = 0;
  let invalidCreatedAt = 0;
  let errors = 0;

  for (const record of records) {
    if (normalizeWatchLocale(record.locale) !== normalizedLocale) continue;
    const entry = buildPublicCardIndexEntry(record);
    if (!entry) {
      skippedNonStrategy += 1;
      continue;
    }
    const score = Date.parse(entry.createdAt);
    if (!Number.isFinite(score)) {
      invalidCreatedAt += 1;
      continue;
    }
    eligible.set(entry.id, { record, entry, score });
  }

  let removedCount = invalidMembers.length;
  let addedCount = 0;
  let alreadyIndexed = 0;

  if (!dryRun) {
    for (const member of invalidMembers) {
      try {
        await client.zrem(key, serializePublicCardIndexMember(member));
      } catch {
        errors += 1;
      }
    }
  }

  for (const [id, member] of Array.from(currentById.entries())) {
    if (eligible.has(id)) {
      alreadyIndexed += 1;
      continue;
    }
    removedCount += 1;
    if (!dryRun) {
      try {
        await client.zrem(key, serializePublicCardIndexMember(member));
      } catch {
        errors += 1;
      }
    }
  }

  for (const [id, candidate] of Array.from(eligible.entries())) {
    if (currentById.has(id)) continue;
    addedCount += 1;
    if (!dryRun) {
      try {
        await persistRecord(candidate.record);
        await client.zadd(key, {
          score: candidate.score,
          member: JSON.stringify(candidate.entry),
        });
      } catch {
        errors += 1;
      }
    }
  }

  return {
    ok: true,
    locale: normalizedLocale,
    dryRun,
    recordsRead: records.length,
    candidateCount: eligible.size,
    rebuiltCount: addedCount + removedCount,
    addedCount,
    removedCount,
    kept: alreadyIndexed,
    alreadyIndexed,
    skippedNonStrategy,
    invalidCreatedAt,
    errors,
    indexCountAfter: dryRun ? currentById.size : await safeIndexCount(normalizedLocale, client),
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

export function hasPublicStrategy(record: StrategyDecisionRecord) {
  const decision = record.tradeDecision;
  return Boolean(
    decision &&
    isDirectionalDecision(decision.direction) &&
    Number.isFinite(decision.entryPrice) &&
    Number.isFinite(decision.stopLoss) &&
    Array.isArray(decision.takeProfit) &&
    decision.takeProfit.some((value) => Number.isFinite(value)),
  );
}

function isDirectionalDecision(value: unknown): value is "long" | "short" {
  return value === "long" || value === "short";
}

async function readIndexedDecisionRecord(entry: PublicCardIndexEntry) {
  return readDecisionRecordDirect(entry.recordKey);
}

async function safeIndexCount(locale: Locale, client: PublicCardIndexClient) {
  try {
    return await client.zcard(publicCardIndexKey(locale));
  } catch {
    return 0;
  }
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

function serializePublicCardIndexMember(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
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

function parsePublicCardIndexFailureMarker(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isPublicCardIndexFailureMarker(
  value: unknown,
): value is PublicCardIndexWriteFailureMarker {
  if (typeof value !== "object" || value === null) return false;
  const marker = value as Partial<PublicCardIndexWriteFailureMarker>;
  return (
    typeof marker.recordId === "string" &&
    typeof marker.locale === "string" &&
    typeof marker.symbol === "string" &&
    typeof marker.recordCreatedAt === "string" &&
    typeof marker.failedAt === "string" &&
    typeof marker.stage === "string" &&
    typeof marker.error === "string"
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

function hasFailureLogConfig(client: PublicCardIndexFailureLogClient) {
  if (client !== (kv as unknown as PublicCardIndexFailureLogClient)) return true;
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

type MemoryPublicCardIndexClient = PublicCardIndexClient & {
  __memoryPublicCardIndexClient: true;
  calls: Array<{ name: keyof PublicCardIndexClient; key: string }>;
};

function createMemoryClient(): MemoryPublicCardIndexClient {
  const store = new Map<string, Map<string, number>>();
  const calls: Array<{ name: keyof PublicCardIndexClient; key: string }> = [];
  function sorted(key: string) {
    return Array.from(store.get(key)?.entries() ?? []).sort((a, b) => {
      const scoreDelta = a[1] - b[1];
      if (scoreDelta !== 0) return scoreDelta;
      return a[0].localeCompare(b[0]);
    });
  }
  return {
    __memoryPublicCardIndexClient: true,
    calls,
    async zadd(key, value) {
      calls.push({ name: "zadd", key });
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
      calls.push({ name: "zrange", key });
      const items = options?.rev ? sorted(key).reverse() : sorted(key);
      const normalizedStop = stop < 0 ? items.length + stop : stop;
      return items.slice(start, normalizedStop + 1).map(([member]) => member) as T;
    },
    async zcard(key) {
      calls.push({ name: "zcard", key });
      return store.get(key)?.size ?? 0;
    },
    async zrem(key, member) {
      calls.push({ name: "zrem", key });
      const zset = store.get(key);
      if (!zset) return 0;
      const existed = zset.delete(member);
      return existed ? 1 : 0;
    },
    async zremrangebyscore(key, min, max) {
      calls.push({ name: "zremrangebyscore", key });
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
      calls.push({ name: "zremrangebyrank", key });
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
