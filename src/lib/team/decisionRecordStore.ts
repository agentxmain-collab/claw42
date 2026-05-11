import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";

type KvListClient = {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  sadd(key: string, value: string): Promise<unknown>;
  smembers(key: string): Promise<unknown[]>;
};

const LEGACY_KV_PREFIX = "decision-record:v1:";
const LEGACY_KV_SYMBOL_INDEX_KEY = `${LEGACY_KV_PREFIX}symbols`;
const KV_PREFIX = "claw42:strategy:records:v1:";
const LOCAL_LINE_CAP = 500;
const KV_LINE_CAP = 1_000;
const memoryRecords = new Map<string, StrategyDecisionRecord[]>();
let warnedAboutMemoryFallback = false;

export async function appendDecisionRecord(record: StrategyDecisionRecord): Promise<void> {
  const normalizedRecord = normalizeRecord(record);
  if (hasKvConfig()) {
    try {
      const client = kv as KvListClient;
      await client.lpush(
        kvSymbolKey(normalizedRecord.locale, normalizedRecord.symbol),
        JSON.stringify(normalizedRecord),
      );
      await client.ltrim(
        kvSymbolKey(normalizedRecord.locale, normalizedRecord.symbol),
        0,
        KV_LINE_CAP - 1,
      );
      await client.sadd(kvSymbolIndexKey(normalizedRecord.locale), normalizedRecord.symbol);
      return;
    } catch {
      appendMemoryRecord(normalizedRecord);
      return;
    }
  }

  try {
    await appendLocalRecord(normalizedRecord);
  } catch {
    appendMemoryRecord(normalizedRecord);
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

function normalizeRecord(record: StrategyDecisionRecord): StrategyDecisionRecord {
  return {
    ...record,
    symbol: normalizeSymbol(record.symbol),
    locale: normalizeWatchLocale(record.locale),
  };
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
  },
  memoryRecords,
};
