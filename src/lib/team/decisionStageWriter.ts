import {
  updateKvVersionedJson,
  type UpdateKvVersionedJsonOptions,
  type VersionedKvEnvelope,
} from "@/lib/storage/kv-version-cas";
import { upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { normalizeWatchLocale } from "@/lib/watch/locale";

type UpdateVersionedStrategyRecord = (
  key: string,
  updater: (
    current: StrategyDecisionRecord | null,
    currentVersion: number,
  ) => StrategyDecisionRecord | Promise<StrategyDecisionRecord>,
  options?: UpdateKvVersionedJsonOptions,
) => Promise<VersionedKvEnvelope<StrategyDecisionRecord>>;

interface WriteDecisionStagePartialOptions {
  updateDecisionRecord?: (record: StrategyDecisionRecord) => Promise<void>;
  updateVersionedJson?: UpdateVersionedStrategyRecord;
}

const PARTIAL_RECORD_TTL_SECONDS = 13 * 60 * 60;

export async function writeDecisionStagePartial(
  record: StrategyDecisionRecord,
  options: WriteDecisionStagePartialOptions = {},
): Promise<StrategyDecisionRecord> {
  const updateVersionedJson = options.updateVersionedJson ?? updateKvVersionedJson;
  const envelope = await updateVersionedJson(
    decisionStagePartialKey(record),
    (_current, currentVersion) => ({
      ...record,
      recordVersion: currentVersion + 1,
    }),
    { ttlSeconds: PARTIAL_RECORD_TTL_SECONDS },
  );
  const versionedRecord = normalizeVersionedRecord(envelope);
  await (options.updateDecisionRecord ?? upsertDecisionRecord)(versionedRecord);
  return versionedRecord;
}

export function decisionStagePartialKey(
  record: Pick<StrategyDecisionRecord, "locale" | "symbol" | "id">,
) {
  return `claw42:strategy:partial:v1:${normalizeWatchLocale(record.locale)}:${normalizeSymbol(
    record.symbol,
  )}:${record.id}`;
}

function normalizeVersionedRecord(
  envelope: VersionedKvEnvelope<StrategyDecisionRecord>,
): StrategyDecisionRecord {
  return {
    ...envelope.value,
    recordVersion: envelope.version,
  };
}

function normalizeSymbol(symbol: string) {
  return symbol
    .trim()
    .replace(/^\$+/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}
