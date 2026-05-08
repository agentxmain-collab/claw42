import fs from "fs/promises";
import path from "path";

import type { MetricRecord } from "./metric-sink";

const MAX_JSONL_BYTES = 10 * 1024 * 1024;
const METRICS_DIR = path.join(process.cwd(), "reports", "metrics");

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function metricFilePath(date: Date): string {
  return path.join(METRICS_DIR, `${formatDate(date)}.jsonl`);
}

async function rotateIfNeeded(filePath: string, nextLineBytes: number): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size + nextLineBytes <= MAX_JSONL_BYTES) return;

    const parsed = path.parse(filePath);
    const rotatedPath = path.join(
      parsed.dir,
      `${parsed.name}-${Date.now()}${parsed.ext}`
    );

    await fs.rename(filePath, rotatedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

export async function appendDevMetric(record: MetricRecord): Promise<void> {
  const filePath = metricFilePath(new Date(record.timestamp));
  const line = `${JSON.stringify(record)}\n`;
  const lineBytes = Buffer.byteLength(line, "utf8");

  await fs.mkdir(METRICS_DIR, { recursive: true });
  // TODO: Replace this local JSONL append/rotation with T1-core's shared
  // jsonl-writer once that branch is merged.
  await rotateIfNeeded(filePath, lineBytes);
  await fs.appendFile(filePath, line, "utf8");
}
