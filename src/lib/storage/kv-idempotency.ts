import { kv } from "@vercel/kv";

export type IdempotencyState = "pending" | "sent" | "failed";

export interface IdempotencyRecord {
  requestId: string;
  state: IdempotencyState;
  claimedAt: string;
  updatedAt: string;
}

export type ClaimResult =
  | { claimed: true; record: IdempotencyRecord }
  | { claimed: false; existingRecord?: IdempotencyRecord };

type KvClient = {
  set(key: string, value: string, options?: { nx?: true; ex?: number }): Promise<unknown>;
  get<T = unknown>(key: string): Promise<T | null>;
};

type MemoryRecord = {
  value: IdempotencyRecord;
  expiresAt: number;
};

const memoryRecords = new Map<string, MemoryRecord>();
let warnedAboutFallback = false;

export async function atomicClaim(
  key: string,
  requestId: string,
  ttlSec: number,
): Promise<ClaimResult> {
  const record = buildRecord(requestId);
  if (!hasKvConfig()) return claimMemory(key, record, ttlSec);

  try {
    const result = await (kv as KvClient).set(key, JSON.stringify(record), {
      nx: true,
      ex: ttlSec,
    });
    if (isSetOk(result)) return { claimed: true, record };
    return {
      claimed: false,
      existingRecord: await readIdempotencyRecord(key),
    };
  } catch {
    warnFallbackOnce();
    return claimMemory(key, record, ttlSec);
  }
}

export async function markIdempotencyState(
  key: string,
  state: IdempotencyState,
  ttlSec: number,
): Promise<IdempotencyRecord | null> {
  const existing = await readIdempotencyRecord(key);
  if (!existing) return null;
  const next: IdempotencyRecord = {
    ...existing,
    state,
    updatedAt: new Date().toISOString(),
  };

  if (!hasKvConfig()) {
    memoryRecords.set(key, { value: next, expiresAt: Date.now() + ttlSec * 1000 });
    return next;
  }

  try {
    await (kv as KvClient).set(key, JSON.stringify(next), { ex: ttlSec });
    return next;
  } catch {
    warnFallbackOnce();
    memoryRecords.set(key, { value: next, expiresAt: Date.now() + ttlSec * 1000 });
    return next;
  }
}

export async function readIdempotencyRecord(key: string): Promise<IdempotencyRecord | undefined> {
  if (!hasKvConfig()) return readMemoryRecord(key);

  try {
    return parseRecord(await (kv as KvClient).get<string | IdempotencyRecord>(key));
  } catch {
    warnFallbackOnce();
    return readMemoryRecord(key);
  }
}

function claimMemory(key: string, record: IdempotencyRecord, ttlSec: number): ClaimResult {
  warnFallbackOnce();
  cleanupExpiredMemoryRecord(key);
  const existing = memoryRecords.get(key);
  if (existing) return { claimed: false, existingRecord: existing.value };
  memoryRecords.set(key, { value: record, expiresAt: Date.now() + ttlSec * 1000 });
  return { claimed: true, record };
}

function readMemoryRecord(key: string) {
  cleanupExpiredMemoryRecord(key);
  return memoryRecords.get(key)?.value;
}

function cleanupExpiredMemoryRecord(key: string) {
  const existing = memoryRecords.get(key);
  if (existing && existing.expiresAt <= Date.now()) memoryRecords.delete(key);
}

function buildRecord(requestId: string): IdempotencyRecord {
  const now = new Date().toISOString();
  return {
    requestId,
    state: "pending",
    claimedAt: now,
    updatedAt: now,
  };
}

function parseRecord(value: string | IdempotencyRecord | null) {
  if (!value) return undefined;
  if (typeof value === "object") return isRecord(value) ? value : undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is IdempotencyRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<IdempotencyRecord>;
  return (
    typeof candidate.requestId === "string" &&
    (candidate.state === "pending" || candidate.state === "sent" || candidate.state === "failed") &&
    typeof candidate.claimedAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isSetOk(value: unknown) {
  return value === "OK" || value === "ok" || value === true;
}

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV idempotency fallback is in-memory only; configure KV for shared exactly-once");
}
