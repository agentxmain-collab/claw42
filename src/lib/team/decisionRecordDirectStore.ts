import { kv } from "@/lib/kv-shim";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";
import { normalizeWatchLocale } from "@/lib/watch/locale";

type KvDirectRecordClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

export const DECISION_RECORD_DIRECT_TTL_SECONDS = 60 * 24 * 60 * 60;
const DIRECT_RECORD_PREFIX = "claw42:strategy:record-by-id:v1:";

export function decisionRecordDirectKey(locale: Locale, recordId: string) {
  return `${DIRECT_RECORD_PREFIX}${normalizeWatchLocale(locale)}:${encodeURIComponent(recordId)}`;
}

export async function persistDecisionRecordDirect(
  record: StrategyDecisionRecord,
  {
    client = kv as KvDirectRecordClient,
    ttlSeconds = DECISION_RECORD_DIRECT_TTL_SECONDS,
  }: {
    client?: KvDirectRecordClient;
    ttlSeconds?: number;
  } = {},
) {
  if (!hasKvConfig()) return null;
  const key = decisionRecordDirectKey(record.locale, record.id);
  await client.set(key, JSON.stringify(record), { ex: ttlSeconds });
  return key;
}

export async function readDecisionRecordDirect(
  key: string,
  { client = kv as KvDirectRecordClient }: { client?: KvDirectRecordClient } = {},
) {
  if (!hasKvConfig()) return null;
  try {
    const value = await client.get<StrategyDecisionRecord | string>(key);
    return parseDecisionRecord(value);
  } catch {
    return null;
  }
}

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

function parseDecisionRecord(value: StrategyDecisionRecord | string | null) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return normalizeParsedRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  return normalizeParsedRecord(value);
}

function normalizeParsedRecord(value: unknown): StrategyDecisionRecord | null {
  if (!isStrategyDecisionRecord(value)) return null;
  return {
    ...value,
    locale: normalizeWatchLocale(value.locale),
    symbol: value.symbol.trim().replace(/^\$+/, "").toUpperCase(),
  };
}

function isStrategyDecisionRecord(value: unknown): value is StrategyDecisionRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StrategyDecisionRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.symbol === "string" &&
    typeof candidate.locale === "string" &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.analystInputs)
  );
}
