import { kv } from "@vercel/kv";

export interface MetricRecord {
  name: string;
  properties: Record<string, unknown>;
  value?: number;
  ts: string;
}

export interface KvClient {
  lpush: (key: string, value: string) => Promise<unknown>;
  expire: (key: string, seconds: number) => Promise<unknown>;
}

const METRIC_TTL_SECONDS = 7 * 24 * 60 * 60;

export function metricKey(date: string, metricName: string) {
  return `metrics:${date}:${metricName}`;
}

export function hasKvConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}

export async function writeMetricToKv(
  record: MetricRecord,
  options: {
    client?: KvClient;
    ttlSeconds?: number;
    date?: string;
    retries?: number;
  } = {},
) {
  const client = options.client ?? kv;
  const ttlSeconds = options.ttlSeconds ?? METRIC_TTL_SECONDS;
  const key = metricKey(options.date ?? record.ts.slice(0, 10), record.name);
  const value = JSON.stringify(record);
  const retries = Math.max(0, Math.floor(options.retries ?? 1));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await client.lpush(key, value);
      await client.expire(key, ttlSeconds);
      return;
    } catch (error) {
      if (attempt >= retries) throw error;
    }
  }
}
