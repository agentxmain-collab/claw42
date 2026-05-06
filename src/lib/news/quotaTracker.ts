import { NEWS_SOURCE_CONFIGS, type NewsSourceId } from "@/lib/news/sourceRegistry";

interface QuotaEntry {
  bucket: string;
  used: number;
  alertedAt: number | null;
}

const quotaEntries = new Map<NewsSourceId, QuotaEntry>();

function monthBucket(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 7);
}

export function recordNewsSourceUsage(
  sourceId: NewsSourceId,
  count = 1,
  now = Date.now(),
): { usedPct: number; shouldAlert: boolean } {
  const source = NEWS_SOURCE_CONFIGS.find((item) => item.id === sourceId);
  const quota = source?.monthlyQuota;
  const bucket = monthBucket(now);
  const entry = quotaEntries.get(sourceId);
  const nextEntry: QuotaEntry =
    entry && entry.bucket === bucket
      ? { ...entry, used: entry.used + count }
      : { bucket, used: count, alertedAt: null };

  quotaEntries.set(sourceId, nextEntry);

  if (!quota || quota <= 0) return { usedPct: 0, shouldAlert: false };

  const usedPct = Math.round((nextEntry.used / quota) * 100);
  const shouldAlert = usedPct >= 80 && !nextEntry.alertedAt;
  if (shouldAlert) quotaEntries.set(sourceId, { ...nextEntry, alertedAt: now });
  return { usedPct, shouldAlert };
}

export function quotaSnapshot() {
  return Object.fromEntries(quotaEntries.entries());
}
