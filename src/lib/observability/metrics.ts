import { join } from "node:path";
import { appendJsonLine } from "../storage/jsonl-writer";
import {
  hasKvConfig,
  writeMetricToKv,
  type KvClient,
  type MetricRecord,
} from "./kv-metrics";

export type MetricProperties = Record<string, unknown>;

export interface MetricsEmitterOptions {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  rootDir?: string;
  kvClient?: KvClient;
  jsonlWriter?: typeof appendJsonLine;
  warn?: (message: string, error?: unknown) => void;
}

const MAX_PROPERTY_KEYS = 40;
const MAX_STRING_LENGTH = 500;

export async function emit(
  metricName: string,
  properties: MetricProperties = {},
  value?: number,
) {
  await createMetricsEmitter().emit(metricName, properties, value);
}

export function createMetricsEmitter(options: MetricsEmitterOptions = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const rootDir = options.rootDir ?? process.cwd();
  const jsonlWriter = options.jsonlWriter ?? appendJsonLine;
  const warn = options.warn ?? ((message, error) => console.warn(message, error));

  return {
    async emit(metricName: string, properties: MetricProperties = {}, value?: number) {
      const record = buildMetricRecord(metricName, properties, value, now());
      const shouldUseKv = env.NODE_ENV === "production" && hasKvConfig(env);
      const shouldWriteJsonl = env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview";
      let wrote = false;

      if (shouldUseKv) {
        try {
          await writeMetricToKv(record, { client: options.kvClient });
          wrote = true;
        } catch (error) {
          warn("[claw42] metric KV write failed", error);
        }
      }

      if (shouldWriteJsonl) {
        try {
          await jsonlWriter(metricPath(rootDir, record.ts), record);
          wrote = true;
        } catch (error) {
          warn("[claw42] metric JSONL write failed", error);
        }
      }

      if (!wrote) {
        warn("[claw42] metric dropped; no writable sink configured");
      }
    },
  };
}

export function buildMetricRecord(
  metricName: string,
  properties: MetricProperties,
  value: number | undefined,
  now: Date,
): MetricRecord {
  const record: MetricRecord = {
    name: normalizeMetricName(metricName),
    properties: sanitizeProperties(properties),
    ts: now.toISOString(),
  };

  if (typeof value === "number" && Number.isFinite(value)) {
    record.value = value;
  }

  return record;
}

export function metricPath(rootDir: string, isoTimestamp: string) {
  return join(rootDir, "reports", "metrics", `${isoTimestamp.slice(0, 10)}.jsonl`);
}

function normalizeMetricName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
  return normalized || "metric";
}

function sanitizeProperties(properties: MetricProperties) {
  return Object.entries(properties)
    .slice(0, MAX_PROPERTY_KEYS)
    .reduce<Record<string, unknown>>((acc, [key, item]) => {
      if (item === undefined) return acc;
      acc[key.slice(0, 80)] = sanitizeValue(item);
      return acc;
    }, {});
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (typeof value === "object" && value !== null) {
    return sanitizeProperties(value as MetricProperties);
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}
