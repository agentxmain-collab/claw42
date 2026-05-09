import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

type KvListClient = {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  sadd(key: string, value: string): Promise<unknown>;
  smembers(key: string): Promise<unknown[]>;
};

const KV_PREFIX = "decision-record:v1:";
const KV_SYMBOL_INDEX_KEY = `${KV_PREFIX}symbols`;
const LOCAL_LINE_CAP = 500;
const KV_LINE_CAP = 1_000;
const memoryRecords = new Map<string, StrategyDecisionRecord[]>();
let warnedAboutMemoryFallback = false;

export async function appendDecisionRecord(record: StrategyDecisionRecord): Promise<void> {
  const normalizedRecord = normalizeRecord(record);
  if (hasKvConfig()) {
    try {
      const client = kv as KvListClient;
      await client.lpush(kvSymbolKey(normalizedRecord.symbol), JSON.stringify(normalizedRecord));
      await client.ltrim(kvSymbolKey(normalizedRecord.symbol), 0, KV_LINE_CAP - 1);
      await client.sadd(KV_SYMBOL_INDEX_KEY, normalizedRecord.symbol);
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
): Promise<StrategyDecisionRecord[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (hasKvConfig()) {
    try {
      const values = await (kv as KvListClient).lrange(kvSymbolKey(normalizedSymbol), 0, limit - 1);
      return values.map(parseRecord).filter(isStrategyDecisionRecord);
    } catch {
      return readMemoryRecords(normalizedSymbol, limit);
    }
  }

  try {
    return (await readLocalRecords(normalizedSymbol)).slice(0, limit);
  } catch {
    return readMemoryRecords(normalizedSymbol, limit);
  }
}

export async function readAllDecisionRecords(
  limit = LOCAL_LINE_CAP,
): Promise<StrategyDecisionRecord[]> {
  if (hasKvConfig()) {
    try {
      const symbols = await (kv as KvListClient).smembers(KV_SYMBOL_INDEX_KEY);
      const batches = await Promise.all(
        symbols
          .map((symbol) => (typeof symbol === "string" ? normalizeSymbol(symbol) : null))
          .filter((symbol): symbol is string => Boolean(symbol))
          .map((symbol) => readDecisionRecords(symbol, limit)),
      );
      return sortRecords(batches.flat()).slice(0, limit);
    } catch {
      return sortRecords(Array.from(memoryRecords.values()).flat()).slice(0, limit);
    }
  }

  try {
    const dir = await localStoreDir();
    const files = await fs.readdir(dir).catch(() => []);
    const batches = await Promise.all(
      files
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => readLocalRecords(file.replace(/\.jsonl$/, ""))),
    );
    return sortRecords(batches.flat()).slice(0, limit);
  } catch {
    return sortRecords(Array.from(memoryRecords.values()).flat()).slice(0, limit);
  }
}

function normalizeRecord(record: StrategyDecisionRecord): StrategyDecisionRecord {
  return {
    ...record,
    symbol: normalizeSymbol(record.symbol),
  };
}

async function appendLocalRecord(record: StrategyDecisionRecord) {
  const file = await localStoreFile(record.symbol);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const existing = await fs
    .readFile(file, "utf8")
    .then((content) => content.split("\n").filter(Boolean))
    .catch(() => []);
  const next = [...existing, JSON.stringify(record)].slice(-LOCAL_LINE_CAP);
  await fs.writeFile(file, `${next.join("\n")}\n`, "utf8");
}

async function readLocalRecords(symbol: string): Promise<StrategyDecisionRecord[]> {
  const file = await localStoreFile(symbol);
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
  const existing = memoryRecords.get(record.symbol) ?? [];
  memoryRecords.set(record.symbol, [record, ...existing].slice(0, LOCAL_LINE_CAP));
}

function readMemoryRecords(symbol: string, limit: number) {
  warnMemoryFallbackOnce();
  return (memoryRecords.get(symbol) ?? []).slice(0, limit);
}

function parseRecord(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
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

function kvSymbolKey(symbol: string) {
  return `${KV_PREFIX}${normalizeSymbol(symbol)}`;
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

async function localStoreFile(symbol: string) {
  return path.join(await localStoreDir(), `${normalizeSymbol(symbol)}.jsonl`);
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
