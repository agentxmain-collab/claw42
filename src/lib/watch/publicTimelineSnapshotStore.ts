import { randomUUID } from "node:crypto";
import { kv } from "@/lib/kv-shim";
import type { Locale } from "@/i18n/types";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type {
  PublicTimelineSnapshotStatus,
  PublicTimelineSourceHealth,
  PublicWatchTimelinePayload,
} from "@/lib/watch/publicTimelinePayload";

export const PUBLIC_TIMELINE_SNAPSHOT_SCHEMA_VERSION = 1;
export const PUBLIC_TIMELINE_SNAPSHOT_TTL_SECONDS = 15 * 60;
export const PUBLIC_TIMELINE_SNAPSHOT_EXPIRES_MS = 75 * 60_000;
export const PUBLIC_TIMELINE_SNAPSHOT_LAST_GOOD_TTL_SECONDS = 24 * 60 * 60;
export const PUBLIC_TIMELINE_SNAPSHOT_MAX_BYTES = 750_000;

const SNAPSHOT_PREFIX = `claw42:public-timeline-snapshot:v${PUBLIC_TIMELINE_SNAPSHOT_SCHEMA_VERSION}`;
const CURRENT_PREFIX = `claw42:public-timeline-snapshot-current:v${PUBLIC_TIMELINE_SNAPSHOT_SCHEMA_VERSION}`;
const LAST_GOOD_PREFIX = `claw42:public-timeline-snapshot-last-good:v${PUBLIC_TIMELINE_SNAPSHOT_SCHEMA_VERSION}`;
const LOCK_PREFIX = `lock:public-timeline-snapshot:v${PUBLIC_TIMELINE_SNAPSHOT_SCHEMA_VERSION}`;

export interface PublicTimelineSnapshotPointer {
  version: string;
  snapshotKey: string;
  generatedAt: string;
  expiresAt: string;
  sourceHealth: PublicTimelineSourceHealth;
}

export type PublicTimelineSnapshotPayload = PublicWatchTimelinePayload & {
  version: string;
  generatedAt: string;
  expiresAt: string;
  sourceHealth: PublicTimelineSourceHealth;
  snapshotStatus: PublicTimelineSnapshotStatus;
};

export interface PublicTimelineSnapshotReadResult {
  source: "current" | "last-good" | "empty";
  payload: PublicTimelineSnapshotPayload;
  storageError?: boolean;
  missReason?: string;
}

export interface PublicTimelineSnapshotPublishResult {
  ok: boolean;
  snapshotKey?: string;
  currentKey?: string;
  lastGoodKey?: string;
  byteLength?: number;
  error?: string;
}

export interface PublicTimelineSnapshotClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; nx?: true },
  ): Promise<unknown>;
  del?(key: string): Promise<unknown>;
}

export function publicTimelineSnapshotBlobKey(
  locale: Locale,
  windowMinutes: number,
  page: number,
  version: string,
) {
  return `${SNAPSHOT_PREFIX}:${normalizeWatchLocale(locale)}:${windowMinutes}:${page}:${version}`;
}

export function publicTimelineSnapshotCurrentKey(
  locale: Locale,
  windowMinutes: number,
  page: number,
) {
  return `${CURRENT_PREFIX}:${normalizeWatchLocale(locale)}:${windowMinutes}:${page}`;
}

export function publicTimelineSnapshotLastGoodKey(
  locale: Locale,
  windowMinutes: number,
  page: number,
) {
  return `${LAST_GOOD_PREFIX}:${normalizeWatchLocale(locale)}:${windowMinutes}:${page}`;
}

export function publicTimelineSnapshotLockKey(locale: Locale, windowMinutes: number, page: number) {
  return `${LOCK_PREFIX}:${normalizeWatchLocale(locale)}:${windowMinutes}:${page}`;
}

export function createEmptyPublicTimelineSnapshot({
  locale,
  windowMinutes,
  page,
  pageSize,
  now = Date.now(),
  version,
  status = "empty",
  sourceHealth,
  events = [],
  evidenceMap = {},
  oldestTs = null,
  hasMore = false,
  totalCount = events.length,
  nextPollMs = 90_000,
  residentStatus,
  followStats,
}: {
  locale: Locale;
  windowMinutes: number;
  page: number;
  pageSize: number;
  now?: number;
  version?: string;
  status?: PublicTimelineSnapshotStatus;
  sourceHealth?: PublicTimelineSourceHealth;
  events?: PublicWatchTimelinePayload["events"];
  evidenceMap?: PublicWatchTimelinePayload["evidenceMap"];
  oldestTs?: number | null;
  hasMore?: boolean;
  totalCount?: number;
  nextPollMs?: number;
  residentStatus?: PublicWatchTimelinePayload["residentStatus"];
  followStats?: PublicWatchTimelinePayload["followStats"];
}): PublicTimelineSnapshotPayload {
  const generatedAt = new Date(now).toISOString();
  return {
    version: version ?? snapshotVersion(now),
    generatedAt,
    expiresAt: new Date(now + PUBLIC_TIMELINE_SNAPSHOT_EXPIRES_MS).toISOString(),
    locale: normalizeWatchLocale(locale),
    windowMinutes,
    page,
    pageSize,
    totalCount,
    oldestTs,
    hasMore,
    nextPollMs,
    events,
    evidenceMap,
    residentStatus,
    followStats,
    sourceHealth: sourceHealth ?? { state: status === "fresh" ? "ok" : "empty" },
    snapshotStatus: status,
    servedAt: now,
  };
}

export async function publishPublicTimelineSnapshot(
  snapshot: PublicTimelineSnapshotPayload,
  {
    client,
    maxBytes = PUBLIC_TIMELINE_SNAPSHOT_MAX_BYTES,
  }: { client?: PublicTimelineSnapshotClient; maxBytes?: number } = {},
): Promise<PublicTimelineSnapshotPublishResult> {
  const storage = resolveClient(client);
  if (!storage) {
    return { ok: false, error: "snapshot_storage_unconfigured" };
  }

  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const snapshotKey = publicTimelineSnapshotBlobKey(
    normalizedSnapshot.locale,
    normalizedSnapshot.windowMinutes,
    normalizedSnapshot.page ?? 1,
    normalizedSnapshot.version,
  );
  const currentKey = publicTimelineSnapshotCurrentKey(
    normalizedSnapshot.locale,
    normalizedSnapshot.windowMinutes,
    normalizedSnapshot.page ?? 1,
  );
  const lastGoodKey = publicTimelineSnapshotLastGoodKey(
    normalizedSnapshot.locale,
    normalizedSnapshot.windowMinutes,
    normalizedSnapshot.page ?? 1,
  );
  const serialized = JSON.stringify(normalizedSnapshot);
  const byteLength = Buffer.byteLength(serialized, "utf8");
  if (byteLength > maxBytes) {
    console.warn("[claw42] public timeline snapshot rejected: blob too large", {
      locale: normalizedSnapshot.locale,
      page: normalizedSnapshot.page,
      byteLength,
      maxBytes,
    });
    return {
      ok: false,
      snapshotKey,
      currentKey,
      lastGoodKey,
      byteLength,
      error: "snapshot_too_large",
    };
  }

  const pointer: PublicTimelineSnapshotPointer = {
    version: normalizedSnapshot.version,
    snapshotKey,
    generatedAt: normalizedSnapshot.generatedAt,
    expiresAt: normalizedSnapshot.expiresAt,
    sourceHealth: normalizedSnapshot.sourceHealth,
  };

  try {
    await storage.set(snapshotKey, serialized, {
      ex: PUBLIC_TIMELINE_SNAPSHOT_LAST_GOOD_TTL_SECONDS,
    });
    await storage.set(currentKey, JSON.stringify(pointer), {
      ex: PUBLIC_TIMELINE_SNAPSHOT_TTL_SECONDS,
    });
    await storage.set(lastGoodKey, JSON.stringify(pointer), {
      ex: PUBLIC_TIMELINE_SNAPSHOT_LAST_GOOD_TTL_SECONDS,
    });
    return { ok: true, snapshotKey, currentKey, lastGoodKey, byteLength };
  } catch (error) {
    return {
      ok: false,
      snapshotKey,
      currentKey,
      lastGoodKey,
      byteLength,
      error: safeErrorMessage(error),
    };
  }
}

export async function readPublicTimelineSnapshot({
  locale,
  windowMinutes,
  page,
  pageSize,
  now = Date.now(),
  client,
}: {
  locale: Locale;
  windowMinutes: number;
  page: number;
  pageSize: number;
  now?: number;
  client?: PublicTimelineSnapshotClient;
}): Promise<PublicTimelineSnapshotReadResult> {
  const normalizedLocale = normalizeWatchLocale(locale);
  const storage = resolveClient(client);
  if (!storage) {
    return emptyReadResult({
      locale: normalizedLocale,
      windowMinutes,
      page,
      pageSize,
      now,
      status: "degraded",
      reason: "snapshot_storage_unconfigured",
    });
  }

  let current: PublicTimelineSnapshotPointer | null = null;
  let currentReadError: unknown = null;
  try {
    current = await readPointer(
      storage,
      publicTimelineSnapshotCurrentKey(normalizedLocale, windowMinutes, page),
    );
    const currentSnapshot = current
      ? await readSnapshotBlob(storage, current.snapshotKey, {
          locale: normalizedLocale,
          windowMinutes,
          page,
          pageSize,
        })
      : null;
    if (currentSnapshot) {
      return {
        source: "current",
        payload: markSnapshotFreshness(currentSnapshot, now, "current"),
      };
    }
  } catch (error) {
    currentReadError = error;
  }

  try {
    const lastGood = await readPointer(
      storage,
      publicTimelineSnapshotLastGoodKey(normalizedLocale, windowMinutes, page),
    );
    const lastGoodSnapshot = lastGood
      ? await readSnapshotBlob(storage, lastGood.snapshotKey, {
          locale: normalizedLocale,
          windowMinutes,
          page,
          pageSize,
        })
      : null;
    if (lastGoodSnapshot) {
      return {
        source: "last-good",
        missReason: currentReadError
          ? "current_storage_error"
          : current
            ? "current_blob_missing"
            : "current_pointer_missing",
        payload: {
          ...markSnapshotFreshness(lastGoodSnapshot, now, "last-good"),
          snapshotStatus: "stale",
          sourceHealth: {
            ...lastGoodSnapshot.sourceHealth,
            readSource: "last-good",
            reason: currentReadError
              ? "current_storage_error"
              : current
                ? "current_blob_missing"
                : "current_pointer_missing",
            error: currentReadError ? safeErrorMessage(currentReadError) : undefined,
          },
        },
      };
    }

    if (currentReadError) {
      return emptyReadResult({
        locale: normalizedLocale,
        windowMinutes,
        page,
        pageSize,
        now,
        status: "degraded",
        reason: "snapshot_storage_error",
        error: safeErrorMessage(currentReadError),
        storageError: true,
      });
    }

    return emptyReadResult({
      locale: normalizedLocale,
      windowMinutes,
      page,
      pageSize,
      now,
      status: "empty",
      reason: current ? "current_blob_missing" : "snapshot_missing",
    });
  } catch (error) {
    return emptyReadResult({
      locale: normalizedLocale,
      windowMinutes,
      page,
      pageSize,
      now,
      status: "degraded",
      reason: "snapshot_storage_error",
      error: safeErrorMessage(error),
      storageError: true,
    });
  }
}

function resolveClient(client?: PublicTimelineSnapshotClient) {
  if (client) return client;
  if (!hasKvEnv()) return null;
  return kv as PublicTimelineSnapshotClient;
}

function hasKvEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  );
}

function snapshotVersion(now: number) {
  return `${new Date(now).toISOString()}:${randomUUID()}`;
}

function normalizeSnapshot(snapshot: PublicTimelineSnapshotPayload): PublicTimelineSnapshotPayload {
  const page = Math.max(1, Math.floor(snapshot.page ?? 1));
  const pageSize = Math.max(1, Math.floor(snapshot.pageSize ?? snapshot.events.length ?? 15));
  return {
    ...snapshot,
    locale: normalizeWatchLocale(snapshot.locale),
    page,
    pageSize,
    totalCount: Math.max(snapshot.totalCount ?? snapshot.events.length, snapshot.events.length),
    snapshotStatus: snapshot.snapshotStatus ?? "fresh",
    sourceHealth: snapshot.sourceHealth ?? { state: "ok" },
  };
}

async function readPointer(storage: PublicTimelineSnapshotClient, key: string) {
  const raw = await storage.get<unknown>(key);
  const parsed = parseJson(raw);
  return isPointer(parsed) ? parsed : null;
}

async function readSnapshotBlob(
  storage: PublicTimelineSnapshotClient,
  key: string,
  expected: { locale: Locale; windowMinutes: number; page: number; pageSize: number },
) {
  const raw = await storage.get<unknown>(key);
  const parsed = parseJson(raw);
  if (!isSnapshotPayload(parsed)) return null;
  if (parsed.locale !== normalizeWatchLocale(expected.locale)) return null;
  if (parsed.windowMinutes !== expected.windowMinutes) return null;
  if ((parsed.page ?? 1) !== expected.page) return null;
  return {
    ...parsed,
    pageSize: parsed.pageSize ?? expected.pageSize,
  };
}

function parseJson(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

function isPointer(value: unknown): value is PublicTimelineSnapshotPointer {
  if (!value || typeof value !== "object") return false;
  const pointer = value as Partial<PublicTimelineSnapshotPointer>;
  return (
    typeof pointer.version === "string" &&
    typeof pointer.snapshotKey === "string" &&
    typeof pointer.generatedAt === "string" &&
    typeof pointer.expiresAt === "string" &&
    Boolean(pointer.sourceHealth)
  );
}

function isSnapshotPayload(value: unknown): value is PublicTimelineSnapshotPayload {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<PublicTimelineSnapshotPayload>;
  return (
    typeof snapshot.version === "string" &&
    typeof snapshot.generatedAt === "string" &&
    typeof snapshot.expiresAt === "string" &&
    Array.isArray(snapshot.events) &&
    Boolean(snapshot.evidenceMap) &&
    typeof snapshot.windowMinutes === "number" &&
    typeof snapshot.locale === "string"
  );
}

function markSnapshotFreshness(
  snapshot: PublicTimelineSnapshotPayload,
  now: number,
  readSource: "current" | "last-good",
) {
  const expiresAt = Date.parse(snapshot.expiresAt);
  const expired = Number.isFinite(expiresAt) && expiresAt < now;
  const snapshotStatus: PublicTimelineSnapshotStatus =
    snapshot.snapshotStatus === "degraded" || snapshot.snapshotStatus === "empty"
      ? snapshot.snapshotStatus
      : expired
        ? "stale"
        : "fresh";
  return {
    ...snapshot,
    snapshotStatus,
    sourceHealth: {
      ...snapshot.sourceHealth,
      readSource,
    },
    servedAt: now,
  };
}

function emptyReadResult({
  locale,
  windowMinutes,
  page,
  pageSize,
  now,
  status,
  reason,
  error,
  storageError,
}: {
  locale: Locale;
  windowMinutes: number;
  page: number;
  pageSize: number;
  now: number;
  status: PublicTimelineSnapshotStatus;
  reason: string;
  error?: string;
  storageError?: boolean;
}): PublicTimelineSnapshotReadResult {
  return {
    source: "empty",
    missReason: reason,
    storageError,
    payload: createEmptyPublicTimelineSnapshot({
      locale,
      windowMinutes,
      page,
      pageSize,
      now,
      status,
      sourceHealth: {
        state: status === "empty" ? "empty" : "degraded",
        reason,
        error,
        storageError,
      },
    }),
  };
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
