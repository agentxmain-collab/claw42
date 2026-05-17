import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type {
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { PmDecisionTriggerSource } from "@/lib/team/pmDecisionPipeline";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";

type KvClient = {
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  get<T>(key: string): Promise<T | null>;
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
};

export type DecisionRunStatus = "skipped" | "running" | "succeeded" | "failed";
export type DecisionRunStageStatus = DecisionStageTraceStatus | "failed";

export interface DecisionRunRecord {
  id: string;
  schemaVersion: 1;
  status: DecisionRunStatus;
  triggerSource: PmDecisionTriggerSource;
  locale: Locale;
  candidate: Pick<
    DecisionCandidate,
    "candidateType" | "candidateKey" | "displayTitle" | "executable" | "symbol"
  >;
  symbol: string;
  startedAt: string;
  completedAt: string | null;
  stageStatus: Partial<Record<DecisionStageTraceId, DecisionRunStageStatus>>;
  analystRoundCount: number;
  activeMemberIds: TeamMemberId[];
  abstainedMemberIds: TeamMemberId[];
  decisionRecordId: string | null;
  publicTimelineEventId: string | null;
  error: string | null;
  skipReason: string | null;
}

const KV_PREFIX = "claw42:decision-runs:v1:";
const KV_TTL_SECONDS = 14 * 86_400;
const LINE_CAP = 500;
const memoryRuns = new Map<string, DecisionRunRecord>();
let warnedAboutMemoryFallback = false;

export async function upsertDecisionRun(run: DecisionRunRecord): Promise<void> {
  const normalized = normalizeRun(run);
  if (hasKvConfig()) {
    try {
      const client = kv as KvClient;
      await client.set(kvRunKey(normalized.id), normalized, { ex: KV_TTL_SECONDS });
      await client.lpush(kvLocaleIndexKey(normalized.locale), normalized.id);
      await client.ltrim(kvLocaleIndexKey(normalized.locale), 0, LINE_CAP - 1);
      return;
    } catch {
      upsertMemoryRun(normalized);
      return;
    }
  }

  try {
    await upsertLocalRun(normalized);
  } catch {
    upsertMemoryRun(normalized);
  }
}

export async function readDecisionRuns({
  locale = LEGACY_WATCH_LOCALE,
  limit = LINE_CAP,
}: {
  locale?: Locale;
  limit?: number;
} = {}): Promise<DecisionRunRecord[]> {
  const normalizedLocale = normalizeWatchLocale(locale);
  if (hasKvConfig()) {
    try {
      const client = kv as KvClient;
      const ids = await client.lrange(kvLocaleIndexKey(normalizedLocale), 0, limit - 1);
      const uniqueIds = Array.from(
        new Set(ids.filter((id): id is string => typeof id === "string")),
      );
      const runs = await Promise.all(
        uniqueIds.map((id) => client.get<DecisionRunRecord>(kvRunKey(id))),
      );
      return sortRuns(runs.filter(isDecisionRunRecord)).slice(0, limit);
    } catch {
      return readMemoryRuns(normalizedLocale, limit);
    }
  }

  try {
    return sortRuns(await readLocalRuns(normalizedLocale)).slice(0, limit);
  } catch {
    return readMemoryRuns(normalizedLocale, limit);
  }
}

function normalizeRun(run: DecisionRunRecord): DecisionRunRecord {
  return {
    ...run,
    locale: normalizeWatchLocale(run.locale),
    symbol: normalizeSymbol(run.symbol),
    candidate: {
      ...run.candidate,
      ...(run.candidate.symbol ? { symbol: normalizeSymbol(run.candidate.symbol) } : {}),
    },
  };
}

async function upsertLocalRun(run: DecisionRunRecord) {
  const file = await localStoreFile(run.locale);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const existing = await readLocalRuns(run.locale).catch(() => []);
  const next = [run, ...existing.filter((item) => item.id !== run.id)].slice(0, LINE_CAP);
  await fs.writeFile(file, `${next.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

async function readLocalRuns(locale: Locale): Promise<DecisionRunRecord[]> {
  const content = await fs.readFile(await localStoreFile(locale), "utf8").catch(() => "");
  return content.split("\n").filter(Boolean).map(parseRun).filter(isDecisionRunRecord);
}

function parseRun(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isDecisionRunRecord(value: unknown): value is DecisionRunRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "schemaVersion" in value &&
    "status" in value &&
    "startedAt" in value
  );
}

function upsertMemoryRun(run: DecisionRunRecord) {
  warnMemoryFallbackOnce();
  memoryRuns.set(run.id, run);
}

function readMemoryRuns(locale: Locale, limit: number) {
  warnMemoryFallbackOnce();
  const normalizedLocale = normalizeWatchLocale(locale);
  return sortRuns(
    Array.from(memoryRuns.values()).filter((run) => run.locale === normalizedLocale),
  ).slice(0, limit);
}

function sortRuns(runs: DecisionRunRecord[]) {
  return [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

function kvRunKey(id: string) {
  return `${KV_PREFIX}run:${id}`;
}

function kvLocaleIndexKey(locale: Locale) {
  return `${KV_PREFIX}${normalizeWatchLocale(locale)}:index`;
}

async function localStoreFile(locale: Locale) {
  const dir =
    process.env.DECISION_RUN_STORE_DIR ?? path.join(process.cwd(), ".cache", "decision-runs");
  return path.join(dir, `${normalizeWatchLocale(locale)}.jsonl`);
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

function warnMemoryFallbackOnce() {
  if (warnedAboutMemoryFallback) return;
  warnedAboutMemoryFallback = true;
  if (process.env.NODE_ENV !== "test") {
    console.warn("[claw42] decision run ledger fell back to memory");
  }
}

export const __decisionRunLedgerTestUtils = {
  clearMemoryRuns() {
    memoryRuns.clear();
    warnedAboutMemoryFallback = false;
  },
  memoryRuns,
};
