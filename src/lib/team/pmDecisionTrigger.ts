import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import type { CoinPoolPayload, CoinTickerEntry, SignalRecord } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const PM_DECISION_TRIGGER_LOCK_KEY = "watch:pm-decision:trigger";
const PM_DECISION_TRIGGER_LOCK_MS = 5 * 60_000;

function signalFromTicker(item: CoinTickerEntry, now: number): SignalRecord | null {
  const change = item.change24h;
  if (!Number.isFinite(change)) return null;
  const severity = Math.abs(change) >= 3 ? "alert" : Math.abs(change) >= 1 ? "watch" : "info";
  return {
    id: `ticker:${item.symbol}:${Math.floor(now / 300_000)}`,
    ts: now,
    symbol: item.symbol.replace(/^\$/, "").toUpperCase(),
    type: "range_change",
    severity,
    payload: {
      priceLevel: item.price,
      change24h: change,
      description: `${item.symbol} 24h ${change.toFixed(2)}%`,
    },
  };
}

export function marketSignalsFromPool(pool: CoinPoolPayload | undefined, now = Date.now()): SignalRecord[] {
  if (!pool) return [];
  return [...pool.majors, ...pool.trending, ...pool.opportunity]
    .map((item) => signalFromTicker(item, now))
    .filter((item): item is SignalRecord => Boolean(item));
}

export async function evidenceFromNewsItems(items: NewsItem[]) {
  const evidences = items.map((item) => newsItemToEvidence(item));
  await Promise.all(evidences.map((evidence) => saveNewsEvidence(evidence)));
  return evidences;
}

export async function triggerPmDecisionPipelineOnce({
  triggerSource,
  pool,
  newsItems = [],
  now = Date.now(),
}: {
  triggerSource: "cron" | "user_visit_trigger";
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  now?: number;
}) {
  const lock = await tryAcquireLock(PM_DECISION_TRIGGER_LOCK_KEY, {
    ttlMs: PM_DECISION_TRIGGER_LOCK_MS,
    waitMs: 0,
  });
  if (!lock) return null;

  const recentNewsEvidence = await evidenceFromNewsItems(newsItems);
  return runPmDecisionPipeline({
    triggerSource,
    recentMarketSignals: marketSignalsFromPool(pool, now),
    recentNewsEvidence,
    importanceThreshold: "high",
    now,
  });
}
