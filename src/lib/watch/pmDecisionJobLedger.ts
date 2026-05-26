import { promises as fs } from "fs";
import path from "path";
import { kv } from "@/lib/kv-shim";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { NewsItem } from "@/lib/types";

type KvClient = {
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  get<T>(key: string): Promise<T | null>;
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
};

export type PmDecisionJobKind = "once" | "batch";
export type PmDecisionJobStatus = "queued" | "running" | "succeeded" | "failed";
export type PmDecisionJobTriggerSource = "cron" | "user_visit_trigger";

export interface PmDecisionJobRecord {
  id: string;
  schemaVersion: 1;
  kind: PmDecisionJobKind;
  status: PmDecisionJobStatus;
  triggerSource: PmDecisionJobTriggerSource;
  locale: Locale;
  idempotencyKey: string;
  candidate: DecisionCandidate | null;
  symbol: string | null;
  newsItems?: NewsItem[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt: string | null;
  lastError: string | null;
  outputCount: number;
  decisionRecordIds: string[];
  auditEventCount: number;
}

const KV_PREFIX = "claw42:pm-decision-jobs:v1:";
const KV_TTL_SECONDS = 7 * 86_400;
const LINE_CAP = 500;
const DEFAULT_MAX_ATTEMPTS = 3;
const IDEMPOTENCY_WINDOW_MS = 5 * 60_000;
const RETRY_DELAY_MS = 5 * 60_000;
const memoryJobs = new Map<string, PmDecisionJobRecord>();
let warnedAboutMemoryFallback = false;

export async function enqueuePmDecisionJob({
  kind,
  triggerSource,
  locale = LEGACY_WATCH_LOCALE,
  candidate = null,
  symbol = null,
  newsItems = [],
  now = Date.now(),
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: {
  kind: PmDecisionJobKind;
  triggerSource: PmDecisionJobTriggerSource;
  locale?: Locale;
  candidate?: DecisionCandidate | null;
  symbol?: string | null;
  newsItems?: NewsItem[];
  now?: number;
  maxAttempts?: number;
}): Promise<PmDecisionJobRecord> {
  const normalizedLocale = normalizeWatchLocale(locale);
  const normalizedSymbol = normalizeOptionalSymbol(symbol ?? candidate?.symbol);
  const idempotencyKey = buildIdempotencyKey({
    kind,
    triggerSource,
    locale: normalizedLocale,
    candidate,
    symbol: normalizedSymbol,
    now,
  });
  const existing = await readPmDecisionJob(jobIdFor(idempotencyKey));
  if (existing && existing.status !== "failed") return existing;

  const createdAt = new Date(now).toISOString();
  const job: PmDecisionJobRecord = {
    id: jobIdFor(idempotencyKey),
    schemaVersion: 1,
    kind,
    status: "queued",
    triggerSource,
    locale: normalizedLocale,
    idempotencyKey,
    candidate: candidate ? candidateSnapshot(candidate) : null,
    symbol: normalizedSymbol,
    ...(newsItems.length > 0 ? { newsItems: normalizeNewsItemsSnapshot(newsItems) } : {}),
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: Math.max(1, Math.floor(maxAttempts)),
    nextRunAt: createdAt,
    lastError: null,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
  };
  await upsertPmDecisionJob(job);
  return job;
}

export async function readPmDecisionJob(id: string): Promise<PmDecisionJobRecord | null> {
  if (hasKvConfig()) {
    try {
      return normalizeJob(await (kv as KvClient).get<PmDecisionJobRecord>(kvJobKey(id)));
    } catch {
      return memoryJobs.get(id) ?? null;
    }
  }

  for (const job of await readLocalJobs().catch(() => [])) {
    if (job.id === id) return job;
  }
  return memoryJobs.get(id) ?? null;
}

export async function readPmDecisionJobs({
  locale = LEGACY_WATCH_LOCALE,
  limit = LINE_CAP,
}: {
  locale?: Locale;
  limit?: number;
} = {}): Promise<PmDecisionJobRecord[]> {
  const normalizedLocale = normalizeWatchLocale(locale);
  if (hasKvConfig()) {
    try {
      const client = kv as KvClient;
      const ids = await client.lrange(kvLocaleIndexKey(normalizedLocale), 0, limit - 1);
      const uniqueIds = Array.from(
        new Set(ids.filter((id): id is string => typeof id === "string")),
      );
      const jobs = await Promise.all(
        uniqueIds.map((id) => client.get<PmDecisionJobRecord>(kvJobKey(id))),
      );
      return sortJobs(jobs.map(normalizeJob).filter(isPmDecisionJobRecord)).slice(0, limit);
    } catch {
      return readMemoryJobs(normalizedLocale, limit);
    }
  }

  return sortJobs(await readLocalJobs().catch(() => readMemoryJobs(normalizedLocale, limit)))
    .filter((job) => job.locale === normalizedLocale)
    .slice(0, limit);
}

export async function markPmDecisionJobRunning(
  id: string,
  { now = Date.now() }: { now?: number } = {},
) {
  const job = await readPmDecisionJob(id);
  if (!job) return null;
  const timestamp = new Date(now).toISOString();
  const next = {
    ...job,
    status: "running" as const,
    updatedAt: timestamp,
    startedAt: job.startedAt ?? timestamp,
    completedAt: null,
    attemptCount: job.attemptCount + 1,
    nextRunAt: null,
    lastError: null,
  };
  await upsertPmDecisionJob(next);
  return next;
}

export async function markPmDecisionJobSucceeded(
  id: string,
  {
    now = Date.now(),
    outputCount = 0,
    decisionRecordIds = [],
    auditEventCount = 0,
  }: {
    now?: number;
    outputCount?: number;
    decisionRecordIds?: string[];
    auditEventCount?: number;
  } = {},
) {
  const job = await readPmDecisionJob(id);
  if (!job) return null;
  const timestamp = new Date(now).toISOString();
  const next = {
    ...job,
    status: "succeeded" as const,
    updatedAt: timestamp,
    completedAt: timestamp,
    nextRunAt: null,
    lastError: null,
    outputCount,
    decisionRecordIds,
    auditEventCount,
  };
  await upsertPmDecisionJob(next);
  return next;
}

export async function markPmDecisionJobFailed(
  id: string,
  { now = Date.now(), error }: { now?: number; error: unknown },
) {
  const job = await readPmDecisionJob(id);
  if (!job) return null;
  const timestamp = new Date(now).toISOString();
  const nextAttempt = Math.max(1, job.attemptCount);
  const exhausted = nextAttempt >= job.maxAttempts;
  const next = {
    ...job,
    status: "failed" as const,
    updatedAt: timestamp,
    completedAt: timestamp,
    nextRunAt: exhausted ? null : new Date(now + RETRY_DELAY_MS * nextAttempt).toISOString(),
    lastError: error instanceof Error ? error.message : String(error),
  };
  await upsertPmDecisionJob(next);
  return next;
}

async function upsertPmDecisionJob(job: PmDecisionJobRecord): Promise<void> {
  const normalized = normalizeJob(job);
  if (!normalized) return;
  if (hasKvConfig()) {
    try {
      const client = kv as KvClient;
      await client.set(kvJobKey(normalized.id), normalized, { ex: KV_TTL_SECONDS });
      await client.lpush(kvLocaleIndexKey(normalized.locale), normalized.id);
      await client.ltrim(kvLocaleIndexKey(normalized.locale), 0, LINE_CAP - 1);
      return;
    } catch {
      upsertMemoryJob(normalized);
      return;
    }
  }

  try {
    await upsertLocalJob(normalized);
  } catch {
    upsertMemoryJob(normalized);
  }
}

function buildIdempotencyKey({
  kind,
  triggerSource,
  locale,
  candidate,
  symbol,
  now,
}: {
  kind: PmDecisionJobKind;
  triggerSource: PmDecisionJobTriggerSource;
  locale: Locale;
  candidate: DecisionCandidate | null;
  symbol: string | null;
  now: number;
}) {
  const candidateKey = candidate?.candidateKey ?? symbol ?? "auto";
  const bucket = Math.floor(now / IDEMPOTENCY_WINDOW_MS);
  return [kind, triggerSource, locale, candidateKey, bucket].map(sanitizeKeyPart).join(":");
}

function jobIdFor(idempotencyKey: string) {
  return `pm-job:${idempotencyKey}`;
}

function candidateSnapshot(candidate: DecisionCandidate): PmDecisionJobRecord["candidate"] {
  return {
    candidateType: candidate.candidateType,
    candidateKey: candidate.candidateKey,
    displayTitle: candidate.displayTitle,
    executable: candidate.executable,
    cadence: candidate.cadence,
    score: candidate.score,
    reasons: candidate.reasons,
    ...(candidate.symbol
      ? { symbol: normalizeOptionalSymbol(candidate.symbol) ?? candidate.symbol }
      : {}),
  };
}

function normalizeJob(value: unknown): PmDecisionJobRecord | null {
  if (!isPmDecisionJobRecord(value)) return null;
  return {
    ...value,
    locale: normalizeWatchLocale(value.locale),
    symbol: normalizeOptionalSymbol(value.symbol),
    candidate: value.candidate
      ? {
          ...value.candidate,
          ...(value.candidate.symbol
            ? { symbol: normalizeOptionalSymbol(value.candidate.symbol) ?? value.candidate.symbol }
            : {}),
        }
      : null,
    ...(Array.isArray(value.newsItems) && value.newsItems.length > 0
      ? { newsItems: normalizeNewsItemsSnapshot(value.newsItems) }
      : {}),
  };
}

function normalizeNewsItemsSnapshot(items: NewsItem[]) {
  return items
    .flatMap((item) => {
      if (!item || typeof item.id !== "string" || typeof item.title !== "string") return [];
      return [
        {
          id: item.id,
          title: item.title,
          url: typeof item.url === "string" ? item.url : "",
          source: typeof item.source === "string" ? item.source : "",
          ...(typeof item.sourceDomain === "string" ? { sourceDomain: item.sourceDomain } : {}),
          currencies: Array.isArray(item.currencies) ? item.currencies.map(String).slice(0, 5) : [],
          sentiment:
            item.sentiment === "bullish" || item.sentiment === "bearish"
              ? item.sentiment
              : "neutral",
          publishedAt:
            typeof item.publishedAt === "number" && Number.isFinite(item.publishedAt)
              ? item.publishedAt
              : Date.now(),
          ...(item.votes ? { votes: item.votes } : {}),
        } satisfies NewsItem,
      ];
    })
    .slice(0, 3);
}

async function upsertLocalJob(job: PmDecisionJobRecord) {
  const file = await localStoreFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const existing = await readLocalJobs().catch(() => []);
  const next = [job, ...existing.filter((item) => item.id !== job.id)].slice(0, LINE_CAP);
  await fs.writeFile(file, `${next.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

async function readLocalJobs(): Promise<PmDecisionJobRecord[]> {
  const content = await fs.readFile(await localStoreFile(), "utf8").catch(() => "");
  return content
    .split("\n")
    .filter(Boolean)
    .map(parseJob)
    .map(normalizeJob)
    .filter(isPmDecisionJobRecord);
}

function parseJob(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isPmDecisionJobRecord(value: unknown): value is PmDecisionJobRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "schemaVersion" in value &&
    "status" in value &&
    "idempotencyKey" in value
  );
}

function upsertMemoryJob(job: PmDecisionJobRecord) {
  warnMemoryFallbackOnce();
  memoryJobs.set(job.id, job);
}

function readMemoryJobs(locale: Locale, limit: number) {
  warnMemoryFallbackOnce();
  const normalizedLocale = normalizeWatchLocale(locale);
  return sortJobs(
    Array.from(memoryJobs.values()).filter((job) => job.locale === normalizedLocale),
  ).slice(0, limit);
}

function sortJobs(jobs: PmDecisionJobRecord[]) {
  return [...jobs].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  );
}

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

function kvJobKey(id: string) {
  return `${KV_PREFIX}job:${id}`;
}

function kvLocaleIndexKey(locale: Locale) {
  return `${KV_PREFIX}${normalizeWatchLocale(locale)}:index`;
}

async function localStoreFile() {
  const dir =
    process.env.PM_DECISION_JOB_STORE_DIR ?? path.join(process.cwd(), ".cache", "pm-jobs");
  return path.join(dir, "jobs.jsonl");
}

function normalizeOptionalSymbol(symbol: string | null | undefined) {
  if (!symbol) return null;
  return (
    symbol
      .trim()
      .replace(/^\$+/, "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "_") || null
  );
}

function sanitizeKeyPart(value: string | number) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function warnMemoryFallbackOnce() {
  if (warnedAboutMemoryFallback) return;
  warnedAboutMemoryFallback = true;
  if (process.env.NODE_ENV !== "test") {
    console.warn("[claw42] PM decision job ledger fell back to memory");
  }
}

export const __pmDecisionJobLedgerTestUtils = {
  clearMemoryJobs() {
    memoryJobs.clear();
    warnedAboutMemoryFallback = false;
  },
  memoryJobs,
};
