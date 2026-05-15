import { readAllDecisionRecords, upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import {
  applyDecisionResolution,
  type DecisionRecordWriter,
  type DecisionResolutionResult,
} from "@/lib/team/decisionResolution";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { Locale } from "@/i18n/types";

const RECORD_SCAN_LIMIT = 1_000;

export type ManualCloseDecisionErrorCode = "not_found" | "already_resolved" | "missing_price";

export class ManualCloseDecisionError extends Error {
  constructor(
    readonly code: ManualCloseDecisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ManualCloseDecisionError";
  }
}

export interface ManualCloseDecisionInput {
  recordId: string;
  locale: Locale;
  now?: number;
  observedPrice?: number | null;
  priceBySymbol?: ReadonlyMap<string, number>;
  readRecords?: (limit: number, locale: Locale) => Promise<StrategyDecisionRecord[]>;
  writeRecord?: DecisionRecordWriter;
}

export async function manualCloseDecisionRecord({
  recordId,
  locale,
  now = Date.now(),
  observedPrice,
  priceBySymbol = new Map(),
  readRecords = readAllDecisionRecords,
  writeRecord = upsertDecisionRecord,
}: ManualCloseDecisionInput) {
  const records = await readRecords(RECORD_SCAN_LIMIT, locale);
  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) {
    throw new ManualCloseDecisionError("not_found", `decision record not found: ${recordId}`);
  }
  if (record.resolvedOutcome || record.resolvedAt) {
    throw new ManualCloseDecisionError(
      "already_resolved",
      `decision record already resolved: ${recordId}`,
    );
  }

  const price = normalizePrice(observedPrice) ?? priceFromMap(record, priceBySymbol);
  if (price === null) {
    throw new ManualCloseDecisionError(
      "missing_price",
      `manual close price unavailable: ${recordId}`,
    );
  }

  const resolution: DecisionResolutionResult = {
    outcome: "manual_close",
    reason: "manual_close_requested",
    observedPrice: price,
    observedPriceSource: "admin_manual",
    resolvedAt: new Date(now).toISOString(),
  };
  const resolvedRecord = applyDecisionResolution(record, resolution);
  await writeRecord(resolvedRecord);
  return {
    resolution,
    record: resolvedRecord,
  };
}

function priceFromMap(
  record: StrategyDecisionRecord,
  priceBySymbol: ReadonlyMap<string, number>,
): number | null {
  const symbols = [record.symbol, record.tradeDecision?.symbol]
    .map(normalizeSymbol)
    .filter((symbol): symbol is string => Boolean(symbol));
  for (const symbol of symbols) {
    const price = normalizePrice(priceBySymbol.get(symbol));
    if (price !== null) return price;
  }
  return null;
}

function normalizeSymbol(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^\$+/, "").toUpperCase();
  return normalized && normalized !== "UNKNOWN" ? normalized : null;
}

function normalizePrice(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
