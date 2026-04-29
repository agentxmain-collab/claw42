import type { SignalRecord, SignalSeverity } from "@/modules/agent-watch/types";

const BUFFER_MAX = 500;
const BUFFER_TTL_MS = 24 * 60 * 60_000;

let signalBuffer: SignalRecord[] = [];
const seenIds = new Set<string>();

function severityRank(severity: SignalSeverity): number {
  if (severity === "alert") return 2;
  if (severity === "watch") return 1;
  return 0;
}

function pruneBuffer(now = Date.now()) {
  const cutoff = now - BUFFER_TTL_MS;
  const removedByAge = signalBuffer.filter((signal) => signal.ts < cutoff);
  signalBuffer = signalBuffer.filter((signal) => signal.ts >= cutoff);
  removedByAge.forEach((signal) => seenIds.delete(signal.id));

  if (signalBuffer.length <= BUFFER_MAX) return;

  const removedBySize = signalBuffer.slice(0, signalBuffer.length - BUFFER_MAX);
  signalBuffer = signalBuffer.slice(-BUFFER_MAX);
  removedBySize.forEach((signal) => seenIds.delete(signal.id));
}

export function pushSignals(records: SignalRecord[]): SignalRecord[] {
  const accepted: SignalRecord[] = [];
  const now = Date.now();

  for (const record of records) {
    const recentDup = signalBuffer.find(
      (signal) =>
        signal.symbol === record.symbol &&
        signal.type === record.type &&
        Math.abs(record.ts - signal.ts) < 60_000,
    );

    if (recentDup) {
      if (severityRank(record.severity) > severityRank(recentDup.severity)) {
        recentDup.severity = record.severity;
        recentDup.payload = { ...recentDup.payload, ...record.payload };
        recentDup.ts = record.ts;
      }
      seenIds.add(record.id);
      continue;
    }

    if (seenIds.has(record.id)) continue;

    signalBuffer.push(record);
    seenIds.add(record.id);
    accepted.push(record);
  }

  pruneBuffer(now);
  return accepted;
}

export function getRecentSignals(limit = 12): SignalRecord[] {
  pruneBuffer();
  return signalBuffer.slice(-Math.max(1, Math.min(limit, BUFFER_MAX)));
}

export function getSignalsByWindow(windowMs: number): SignalRecord[] {
  pruneBuffer();
  const cutoff = Date.now() - windowMs;
  return signalBuffer.filter((signal) => signal.ts >= cutoff);
}

export function getSignalCount(): number {
  pruneBuffer();
  return signalBuffer.length;
}

