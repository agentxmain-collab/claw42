import { promises as fs } from "fs";
import path from "path";
import { kv } from "@/lib/kv-shim";
import { persistDecisionRecordDirect } from "@/lib/team/decisionRecordDirectStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import {
  cleanupPublicCardIndex,
  writePublicCardIndexEntry,
  writePublicCardIndexFailureMarker,
} from "@/lib/watch/publicCardIndex";
import { schedulePublicTimelineSnapshotRefresh } from "@/lib/watch/publicTimelineSnapshotProducer";

type KvListClient = {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  lrem(key: string, count: number, value: string): Promise<unknown>;
  sadd(key: string, value: string): Promise<unknown>;
  smembers(key: string): Promise<unknown[]>;
};

const LEGACY_KV_PREFIX = "decision-record:v1:";
const LEGACY_KV_SYMBOL_INDEX_KEY = `${LEGACY_KV_PREFIX}symbols`;
const KV_PREFIX = "claw42:strategy:records:v1:";
const LOCAL_LINE_CAP = 500;
const KV_LINE_CAP = 500;
const memoryRecords = new Map<string, StrategyDecisionRecord[]>();
let warnedAboutMemoryFallback = false;

export type DecisionRecordStorageMode = "persistent" | "ephemeral" | "memory";

export interface DecisionRecordWriteDiagnostics {
  operation: "append" | "upsert";
  storageMode: DecisionRecordStorageMode;
  configuredStorageMode: Exclude<DecisionRecordStorageMode, "memory">;
  locale: Locale;
  symbol: string;
  recordId: string;
  kvKeyPrefix: string;
  kvSymbolKey: string;
  kvSymbolIndexKey: string;
  lpushResult?: unknown;
  ltrimResult?: unknown;
  saddResult?: unknown;
  lremAttemptCount?: number;
  lremResultCount?: number;
  publicCardStorageFailures?: Array<{ stage: string; error: string }>;
  localResult?: "ok";
  fallbackReason?: string;
}

export interface DecisionRecordStoreDiagnostics {
  storageMode: DecisionRecordStorageMode;
  configuredStorageMode: Exclude<DecisionRecordStorageMode, "memory">;
  useKvEnvActualValue: string;
  kvConfigured: boolean;
  kvKeyPrefix: string;
  kvSymbolIndexKey: string;
  legacyKvSymbolIndexKey: string;
  deploymentId: string | null;
  gitSha: string | null;
  lastWrite: DecisionRecordWriteDiagnostics | null;
  decisionRecordReadResult: {
    locale: Locale;
    symbolsChecked: string[];
    recordCount: number;
    firstRecordCreatedAt: string | null;
    requestedRecordIdsPresent: string[];
    kvReadResults?: Array<{
      symbol: string;
      key: string;
      recordCount: number;
      firstRecordCreatedAt: string | null;
      requestedRecordIdsPresent: string[];
    }>;
    fallbackReason?: string;
  };
}

let lastDecisionRecordWriteDiagnostics: DecisionRecordWriteDiagnostics | null = null;

export async function appendDecisionRecord(record: StrategyDecisionRecord): Promise<void> {
  const normalizedRecord = normalizeRecord(record);
  const key = kvSymbolKey(normalizedRecord.locale, normalizedRecord.symbol);
  const indexKey = kvSymbolIndexKey(normalizedRecord.locale);
  if (hasKvConfig()) {
    try {
      const client = kv as KvListClient;
      const lpushResult = await client.lpush(key, JSON.stringify(normalizedRecord));
      const ltrimResult = await client.ltrim(key, 0, KV_LINE_CAP - 1);
      const saddResult = await client.sadd(indexKey, normalizedRecord.symbol);
      const publicCardStorageFailures = await writePublicCardStorage(normalizedRecord);
      rememberDecisionRecordWrite({
        operation: "append",
        storageMode: "persistent",
        configuredStorageMode: "persistent",
        locale: normalizedRecord.locale,
        symbol: normalizedRecord.symbol,
        recordId: normalizedRecord.id,
        kvKeyPrefix: KV_PREFIX,
        kvSymbolKey: key,
        kvSymbolIndexKey: indexKey,
        lpushResult: safeStorageResult(lpushResult),
        ltrimResult: safeStorageResult(ltrimResult),
        saddResult: safeStorageResult(saddResult),
        publicCardStorageFailures,
      });
      return;
    } catch (error) {
      appendMemoryRecord(normalizedRecord);
      rememberDecisionRecordWrite({
        operation: "append",
        storageMode: "memory",
        configuredStorageMode: "persistent",
        locale: normalizedRecord.locale,
        symbol: normalizedRecord.symbol,
        recordId: normalizedRecord.id,
        kvKeyPrefix: KV_PREFIX,
        kvSymbolKey: key,
        kvSymbolIndexKey: indexKey,
        fallbackReason: safeErrorMessage(error),
      });
      return;
    }
  }

  try {
    await appendLocalRecord(normalizedRecord);
    rememberDecisionRecordWrite({
      operation: "append",
      storageMode: "ephemeral",
      configuredStorageMode: "ephemeral",
      locale: normalizedRecord.locale,
      symbol: normalizedRecord.symbol,
      recordId: normalizedRecord.id,
      kvKeyPrefix: KV_PREFIX,
      kvSymbolKey: key,
      kvSymbolIndexKey: indexKey,
      localResult: "ok",
    });
  } catch (error) {
    appendMemoryRecord(normalizedRecord);
    rememberDecisionRecordWrite({
      operation: "append",
      storageMode: "memory",
      configuredStorageMode: "ephemeral",
      locale: normalizedRecord.locale,
      symbol: normalizedRecord.symbol,
      recordId: normalizedRecord.id,
      kvKeyPrefix: KV_PREFIX,
      kvSymbolKey: key,
      kvSymbolIndexKey: indexKey,
      fallbackReason: safeErrorMessage(error),
    });
  }
}

export async function upsertDecisionRecord(record: StrategyDecisionRecord): Promise<void> {
  const normalizedRecord = normalizeRecord(record);
  const key = kvSymbolKey(normalizedRecord.locale, normalizedRecord.symbol);
  const indexKey = kvSymbolIndexKey(normalizedRecord.locale);
  if (hasKvConfig()) {
    try {
      const result = await upsertKvRecord(normalizedRecord);
      rememberDecisionRecordWrite({
        operation: "upsert",
        storageMode: "persistent",
        configuredStorageMode: "persistent",
        locale: normalizedRecord.locale,
        symbol: normalizedRecord.symbol,
        recordId: normalizedRecord.id,
        kvKeyPrefix: KV_PREFIX,
        kvSymbolKey: key,
        kvSymbolIndexKey: indexKey,
        ...result,
      });
      return;
    } catch (error) {
      upsertMemoryRecord(normalizedRecord);
      rememberDecisionRecordWrite({
        operation: "upsert",
        storageMode: "memory",
        configuredStorageMode: "persistent",
        locale: normalizedRecord.locale,
        symbol: normalizedRecord.symbol,
        recordId: normalizedRecord.id,
        kvKeyPrefix: KV_PREFIX,
        kvSymbolKey: key,
        kvSymbolIndexKey: indexKey,
        fallbackReason: safeErrorMessage(error),
      });
      return;
    }
  }

  try {
    await upsertLocalRecord(normalizedRecord);
    rememberDecisionRecordWrite({
      operation: "upsert",
      storageMode: "ephemeral",
      configuredStorageMode: "ephemeral",
      locale: normalizedRecord.locale,
      symbol: normalizedRecord.symbol,
      recordId: normalizedRecord.id,
      kvKeyPrefix: KV_PREFIX,
      kvSymbolKey: key,
      kvSymbolIndexKey: indexKey,
      localResult: "ok",
    });
  } catch (error) {
    upsertMemoryRecord(normalizedRecord);
    rememberDecisionRecordWrite({
      operation: "upsert",
      storageMode: "memory",
      configuredStorageMode: "ephemeral",
      locale: normalizedRecord.locale,
      symbol: normalizedRecord.symbol,
      recordId: normalizedRecord.id,
      kvKeyPrefix: KV_PREFIX,
      kvSymbolKey: key,
      kvSymbolIndexKey: indexKey,
      fallbackReason: safeErrorMessage(error),
    });
  }
}

export async function readDecisionRecords(
  symbol: string,
  limit = LOCAL_LINE_CAP,
  locale: Locale = LEGACY_WATCH_LOCALE,
): Promise<StrategyDecisionRecord[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedLocale = normalizeWatchLocale(locale);
  if (hasKvConfig()) {
    try {
      const values = await (kv as KvListClient).lrange(
        kvSymbolKey(normalizedLocale, normalizedSymbol),
        0,
        limit - 1,
      );
      const records = values.map(parseRecord).filter(isStrategyDecisionRecord);
      if (records.length > 0 || normalizedLocale !== LEGACY_WATCH_LOCALE) return records;
      const legacyValues = await (kv as KvListClient).lrange(
        legacyKvSymbolKey(normalizedSymbol),
        0,
        limit - 1,
      );
      return legacyValues.map(parseRecord).filter(isStrategyDecisionRecord);
    } catch {
      return readMemoryRecords(normalizedLocale, normalizedSymbol, limit);
    }
  }

  try {
    const records = (await readLocalRecords(normalizedLocale, normalizedSymbol)).slice(0, limit);
    if (records.length > 0 || normalizedLocale !== LEGACY_WATCH_LOCALE) return records;
    return (await readLegacyLocalRecords(normalizedSymbol)).slice(0, limit);
  } catch {
    return readMemoryRecords(normalizedLocale, normalizedSymbol, limit);
  }
}

export async function readAllDecisionRecords(
  limit = LOCAL_LINE_CAP,
  locale: Locale = LEGACY_WATCH_LOCALE,
): Promise<StrategyDecisionRecord[]> {
  const normalizedLocale = normalizeWatchLocale(locale);
  if (hasKvConfig()) {
    try {
      const symbols = await (kv as KvListClient).smembers(kvSymbolIndexKey(normalizedLocale));
      const batches = await Promise.all(
        symbols
          .map((symbol) => (typeof symbol === "string" ? normalizeSymbol(symbol) : null))
          .filter((symbol): symbol is string => Boolean(symbol))
          .map((symbol) => readDecisionRecords(symbol, limit, normalizedLocale)),
      );
      const records = sortRecords(batches.flat()).slice(0, limit);
      if (records.length > 0 || normalizedLocale !== LEGACY_WATCH_LOCALE) return records;
      const legacySymbols = await (kv as KvListClient).smembers(LEGACY_KV_SYMBOL_INDEX_KEY);
      const legacyBatches = await Promise.all(
        legacySymbols
          .map((symbol) => (typeof symbol === "string" ? normalizeSymbol(symbol) : null))
          .filter((symbol): symbol is string => Boolean(symbol))
          .map((symbol) => readDecisionRecords(symbol, limit, LEGACY_WATCH_LOCALE)),
      );
      return sortRecords(legacyBatches.flat()).slice(0, limit);
    } catch {
      return sortRecords(Array.from(memoryRecords.values()).flat()).slice(0, limit);
    }
  }

  try {
    const dir = await localStoreDir();
    const files = await fs.readdir(dir).catch(() => []);
    const batches = await Promise.all(
      files
        .filter((file) => localRecordFileBelongsToLocale(file, normalizedLocale))
        .map((file) => readLocalRecordsFromFile(path.join(dir, file))),
    );
    return sortRecords(batches.flat()).slice(0, limit);
  } catch {
    return readAllMemoryRecords(normalizedLocale, limit);
  }
}

export async function getDecisionRecordStoreDiagnostics({
  locale = LEGACY_WATCH_LOCALE,
  symbols = [],
  recordIds = [],
  limit = 20,
}: {
  locale?: Locale;
  symbols?: string[];
  recordIds?: string[];
  limit?: number;
} = {}): Promise<DecisionRecordStoreDiagnostics> {
  const normalizedLocale = normalizeWatchLocale(locale);
  const normalizedSymbols = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
  const requestedRecordIds = new Set(recordIds.filter(Boolean));
  const kvConfigured = hasKvConfig();
  const configuredStorageMode: Exclude<DecisionRecordStorageMode, "memory"> = kvConfigured
    ? "persistent"
    : "ephemeral";
  const base = {
    configuredStorageMode,
    useKvEnvActualValue: stringifyEnvValue(process.env.USE_PERSISTENT_KV),
    kvConfigured,
    kvKeyPrefix: KV_PREFIX,
    kvSymbolIndexKey: kvSymbolIndexKey(normalizedLocale),
    legacyKvSymbolIndexKey: LEGACY_KV_SYMBOL_INDEX_KEY,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    lastWrite: lastDecisionRecordWriteDiagnostics,
  };

  if (kvConfigured) {
    try {
      const client = kv as KvListClient;
      const indexedSymbols = (await client.smembers(kvSymbolIndexKey(normalizedLocale)))
        .map((symbol) => (typeof symbol === "string" ? normalizeSymbol(symbol) : null))
        .filter((symbol): symbol is string => Boolean(symbol));
      const symbolsChecked = normalizedSymbols.length > 0 ? normalizedSymbols : indexedSymbols;
      const kvReadResults = await Promise.all(
        symbolsChecked.slice(0, Math.max(1, Math.min(limit, 20))).map(async (symbol) => {
          const key = kvSymbolKey(normalizedLocale, symbol);
          const values = await client.lrange(key, 0, Math.max(1, Math.min(limit, 50)) - 1);
          const records = values.map(parseRecord).filter(isStrategyDecisionRecord);
          return readResultForRecords(symbol, key, records, requestedRecordIds);
        }),
      );
      const records = kvReadResults.flatMap((result) =>
        result.requestedRecordIdsPresent.length > 0 ? result.requestedRecordIdsPresent : [],
      );
      const recordCount = kvReadResults.reduce((total, result) => total + result.recordCount, 0);
      const firstRecordCreatedAt =
        kvReadResults
          .map((result) => result.firstRecordCreatedAt)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
      return {
        ...base,
        storageMode: "persistent",
        decisionRecordReadResult: {
          locale: normalizedLocale,
          symbolsChecked,
          recordCount,
          firstRecordCreatedAt,
          requestedRecordIdsPresent: Array.from(new Set(records)),
          kvReadResults,
        },
      };
    } catch (error) {
      const records = await readAllMemoryRecords(normalizedLocale, limit);
      return {
        ...base,
        storageMode: "memory",
        decisionRecordReadResult: readAggregateResult(
          records,
          normalizedLocale,
          normalizedSymbols,
          requestedRecordIds,
          safeErrorMessage(error),
        ),
      };
    }
  }

  const records = await readAllDecisionRecords(limit, normalizedLocale);
  return {
    ...base,
    storageMode: lastDecisionRecordWriteDiagnostics?.storageMode ?? "ephemeral",
    decisionRecordReadResult: readAggregateResult(
      records,
      normalizedLocale,
      normalizedSymbols,
      requestedRecordIds,
    ),
  };
}

export function getLastDecisionRecordWriteDiagnostics() {
  return lastDecisionRecordWriteDiagnostics;
}

function normalizeRecord(record: StrategyDecisionRecord): StrategyDecisionRecord {
  return {
    ...record,
    symbol: normalizeSymbol(record.symbol),
    locale: normalizeWatchLocale(record.locale),
  };
}

async function upsertKvRecord(record: StrategyDecisionRecord) {
  const client = kv as KvListClient;
  const key = kvSymbolKey(record.locale, record.symbol);
  const values = await client.lrange(key, 0, KV_LINE_CAP - 1);
  const lremResults = await Promise.all(
    values
      .filter((value) => rawRecordId(value) === record.id)
      .map((value) =>
        client.lrem(key, 0, typeof value === "string" ? value : JSON.stringify(value)),
      ),
  );
  const lpushResult = await client.lpush(key, JSON.stringify(record));
  const ltrimResult = await client.ltrim(key, 0, KV_LINE_CAP - 1);
  const saddResult = await client.sadd(kvSymbolIndexKey(record.locale), record.symbol);
  const publicCardStorageFailures = await writePublicCardStorage(record);
  return {
    lremAttemptCount: lremResults.length,
    lremResultCount: lremResults.filter((result) => Number(result) > 0).length,
    lpushResult: safeStorageResult(lpushResult),
    ltrimResult: safeStorageResult(ltrimResult),
    saddResult: safeStorageResult(saddResult),
    publicCardStorageFailures,
  };
}

async function writePublicCardStorage(record: StrategyDecisionRecord) {
  const results = await Promise.allSettled([
    persistDecisionRecordDirect(record),
    writePublicCardIndexEntry(record),
  ]);
  const publicCardResult = results[1];
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            stage: index === 0 ? "direct-record" : "public-card-index",
            error: safeErrorMessage(result.reason),
          },
        ]
      : [],
  );
  for (const failure of failures) {
    console.warn("[claw42] public card storage write failed", {
      locale: record.locale,
      symbol: record.symbol,
      recordId: record.id,
      stage: failure.stage,
      error: failure.error,
    });
    await writePublicCardIndexFailureMarker({
      recordId: record.id,
      locale: record.locale,
      symbol: record.symbol,
      recordCreatedAt: record.createdAt,
      failedAt: new Date().toISOString(),
      stage: failure.stage,
      error: failure.error,
    }).catch(() => null);
  }
  await cleanupPublicCardIndex(record.locale).catch((error) => {
    console.warn("[claw42] public card index cleanup failed", {
      locale: record.locale,
      recordId: record.id,
      error: safeErrorMessage(error),
    });
  });
  if (publicCardResult.status === "fulfilled" && publicCardResult.value) {
    void Promise.resolve(
      schedulePublicTimelineSnapshotRefresh(record.locale, { reason: "decision-record-write" }),
    ).catch((error) => {
      console.warn("[claw42] public timeline snapshot refresh schedule failed", {
        locale: record.locale,
        recordId: record.id,
        error: safeErrorMessage(error),
      });
    });
  }
  return failures;
}

async function appendLocalRecord(record: StrategyDecisionRecord) {
  const file = await localStoreFile(record.locale, record.symbol);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const existing = await fs
    .readFile(file, "utf8")
    .then((content) => content.split("\n").filter(Boolean))
    .catch(() => []);
  const next = [...existing, JSON.stringify(record)].slice(-LOCAL_LINE_CAP);
  await fs.writeFile(file, `${next.join("\n")}\n`, "utf8");
}

async function upsertLocalRecord(record: StrategyDecisionRecord) {
  const file = await localStoreFile(record.locale, record.symbol);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const existing = await fs
    .readFile(file, "utf8")
    .then((content) => content.split("\n").filter(Boolean))
    .catch(() => []);
  const next = [
    ...existing.filter((line) => rawRecordId(line) !== record.id),
    JSON.stringify(record),
  ].slice(-LOCAL_LINE_CAP);
  await fs.writeFile(file, `${next.join("\n")}\n`, "utf8");
}

async function readLocalRecords(locale: Locale, symbol: string): Promise<StrategyDecisionRecord[]> {
  const file = await localStoreFile(locale, symbol);
  return readLocalRecordsFromFile(file);
}

async function readLegacyLocalRecords(symbol: string): Promise<StrategyDecisionRecord[]> {
  const file = path.join(await localStoreDir(), `${normalizeSymbol(symbol)}.jsonl`);
  return readLocalRecordsFromFile(file);
}

async function readLocalRecordsFromFile(file: string): Promise<StrategyDecisionRecord[]> {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  return content
    .split("\n")
    .filter(Boolean)
    .map(parseRecord)
    .filter(isStrategyDecisionRecord)
    .reverse();
}

function appendMemoryRecord(record: StrategyDecisionRecord) {
  warnMemoryFallbackOnce();
  const key = memoryKey(record.locale, record.symbol);
  const existing = memoryRecords.get(key) ?? [];
  memoryRecords.set(key, [record, ...existing].slice(0, LOCAL_LINE_CAP));
}

function upsertMemoryRecord(record: StrategyDecisionRecord) {
  warnMemoryFallbackOnce();
  const key = memoryKey(record.locale, record.symbol);
  const existing = memoryRecords.get(key) ?? [];
  memoryRecords.set(
    key,
    [record, ...existing.filter((existingRecord) => existingRecord.id !== record.id)].slice(
      0,
      LOCAL_LINE_CAP,
    ),
  );
}

function readMemoryRecords(locale: Locale, symbol: string, limit: number) {
  warnMemoryFallbackOnce();
  const normalizedLocale = normalizeWatchLocale(locale);
  const records = (memoryRecords.get(memoryKey(normalizedLocale, symbol)) ?? []).slice(0, limit);
  if (records.length > 0 || normalizedLocale !== LEGACY_WATCH_LOCALE) return records;
  return (memoryRecords.get(memoryKey(LEGACY_WATCH_LOCALE, symbol)) ?? []).slice(0, limit);
}

function readAllMemoryRecords(locale: Locale, limit: number) {
  warnMemoryFallbackOnce();
  const normalizedLocale = normalizeWatchLocale(locale);
  const prefix = `${normalizedLocale}:`;
  return sortRecords(
    Array.from(memoryRecords.entries())
      .filter(([key]) => key.startsWith(prefix))
      .flatMap(([, records]) => records),
  ).slice(0, limit);
}

function parseRecord(value: unknown) {
  if (typeof value === "object" && value !== null) return normalizeParsedRecord(value);
  if (typeof value !== "string") return null;
  try {
    return normalizeParsedRecord(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function rawRecordId(value: unknown) {
  const parsed = parseRecord(value);
  return isStrategyDecisionRecord(parsed) ? parsed.id : null;
}

function normalizeParsedRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Partial<StrategyDecisionRecord>;
  return {
    ...record,
    symbol: normalizeSymbol(String(record.symbol ?? "UNKNOWN")),
    locale: normalizeWatchLocale(record.locale),
  };
}

function isStrategyDecisionRecord(value: unknown): value is StrategyDecisionRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "symbol" in value &&
    "schemaVersion" in value
  );
}

function sortRecords(records: StrategyDecisionRecord[]) {
  return [...records].sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
}

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

function rememberDecisionRecordWrite(diagnostics: DecisionRecordWriteDiagnostics) {
  lastDecisionRecordWriteDiagnostics = diagnostics;
}

function stringifyEnvValue(value: string | undefined) {
  return JSON.stringify(value) ?? "undefined";
}

function safeStorageResult(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return Object.prototype.toString.call(value);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/token=[A-Za-z0-9._-]+/gi, "token=[redacted]");
}

function readResultForRecords(
  symbol: string,
  key: string,
  records: StrategyDecisionRecord[],
  requestedRecordIds: ReadonlySet<string>,
) {
  return {
    symbol,
    key,
    recordCount: records.length,
    firstRecordCreatedAt: records[0]?.createdAt ?? null,
    requestedRecordIdsPresent: records
      .map((record) => record.id)
      .filter((id) => requestedRecordIds.has(id)),
  };
}

function readAggregateResult(
  records: StrategyDecisionRecord[],
  locale: Locale,
  symbolsChecked: string[],
  requestedRecordIds: ReadonlySet<string>,
  fallbackReason?: string,
): DecisionRecordStoreDiagnostics["decisionRecordReadResult"] {
  const filtered = symbolsChecked.length
    ? records.filter((record) => symbolsChecked.includes(normalizeSymbol(record.symbol)))
    : records;
  return {
    locale,
    symbolsChecked,
    recordCount: filtered.length,
    firstRecordCreatedAt: filtered[0]?.createdAt ?? null,
    requestedRecordIdsPresent: filtered
      .map((record) => record.id)
      .filter((id) => requestedRecordIds.has(id)),
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

function kvSymbolIndexKey(locale: Locale) {
  return `${KV_PREFIX}${normalizeWatchLocale(locale)}:symbols`;
}

function kvSymbolKey(locale: Locale, symbol: string) {
  return `${KV_PREFIX}${normalizeWatchLocale(locale)}:${normalizeSymbol(symbol)}`;
}

function legacyKvSymbolKey(symbol: string) {
  return `${LEGACY_KV_PREFIX}${normalizeSymbol(symbol)}`;
}

function memoryKey(locale: Locale, symbol: string) {
  return `${normalizeWatchLocale(locale)}:${normalizeSymbol(symbol)}`;
}

function normalizeSymbol(symbol: string) {
  return (
    symbol
      .trim()
      .replace(/^\$+/, "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "_") || "UNKNOWN"
  );
}

async function localStoreDir() {
  return (
    process.env.DECISION_RECORD_STORE_DIR ?? path.join(process.cwd(), ".cache", "decision-records")
  );
}

async function localStoreFile(locale: Locale, symbol: string) {
  return path.join(
    await localStoreDir(),
    `${normalizeWatchLocale(locale)}-${normalizeSymbol(symbol)}.jsonl`,
  );
}

function localRecordFileBelongsToLocale(file: string, locale: Locale) {
  if (!file.endsWith(".jsonl")) return false;
  const normalizedLocale = normalizeWatchLocale(locale);
  if (file.startsWith(`${normalizedLocale}-`)) return true;
  return normalizedLocale === LEGACY_WATCH_LOCALE && !file.includes("-");
}

function warnMemoryFallbackOnce() {
  if (warnedAboutMemoryFallback) return;
  warnedAboutMemoryFallback = true;
  if (process.env.NODE_ENV !== "test") {
    console.warn("[claw42] decision record store fell back to memory");
  }
}

export const __decisionRecordStoreTestUtils = {
  clearMemoryRecords() {
    memoryRecords.clear();
    warnedAboutMemoryFallback = false;
    lastDecisionRecordWriteDiagnostics = null;
  },
  memoryRecords,
};
