import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { saveNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { runPmDecisionPipeline } from "@/lib/team/pmDecisionPipeline";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import type { Locale } from "@/i18n/types";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import type { CoinPoolPayload, CoinTickerEntry, SignalRecord } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const PM_DECISION_SYMBOL_LOCK_MS = 170 * 60_000;

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

export function marketSignalsFromPool(
  pool: CoinPoolPayload | undefined,
  now = Date.now(),
  symbol?: string,
): SignalRecord[] {
  if (!pool) return [];
  const normalizedSymbol = symbol?.replace(/^\$/, "").toUpperCase();
  return [...pool.majors, ...pool.trending, ...pool.opportunity]
    .filter(
      (item) =>
        !normalizedSymbol || item.symbol.replace(/^\$/, "").toUpperCase() === normalizedSymbol,
    )
    .map((item) => signalFromTicker(item, now))
    .filter((item): item is SignalRecord => Boolean(item));
}

function symbolsFromPool(pool: CoinPoolPayload | undefined) {
  if (!pool) return ["BTC"];
  return Array.from(
    new Set(
      [...pool.majors, ...pool.trending, ...pool.opportunity]
        .map((item) => item.symbol.replace(/^\$/, "").toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 6);
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
  locale = LEGACY_WATCH_LOCALE,
  symbol,
  now = Date.now(),
}: {
  triggerSource: "cron" | "user_visit_trigger";
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  locale?: Locale;
  symbol?: string;
  now?: number;
}) {
  const normalizedLocale = normalizeWatchLocale(locale);
  const recentNewsEvidence = await evidenceFromNewsItems(newsItems);
  const candidates = symbol ? [symbol.replace(/^\$/, "").toUpperCase()] : symbolsFromPool(pool);

  for (const candidate of candidates) {
    const recentMarketSignals = marketSignalsFromPool(pool, now, candidate);
    const scopedNewsEvidence = recentNewsEvidence.filter(
      (evidence) => evidence.symbol.length === 0 || evidence.symbol.includes(candidate),
    );
    const hasTrigger =
      recentMarketSignals.some((signal) => signal.severity === "alert") ||
      scopedNewsEvidence.some((evidence) => evidence.impactSeverity === "high");
    if (!hasTrigger) continue;

    const lock = await tryAcquireLock(`watch:pm-decision:${normalizedLocale}:${candidate}`, {
      ttlMs: PM_DECISION_SYMBOL_LOCK_MS,
      waitMs: 0,
    });
    if (!lock) {
      console.info("[claw42] PM decision pipeline locked skip", {
        locale: normalizedLocale,
        symbol: candidate,
        triggerSource,
        ttlMs: PM_DECISION_SYMBOL_LOCK_MS,
      });
      continue;
    }

    const result = await runPmDecisionPipeline({
      triggerSource,
      recentMarketSignals,
      recentNewsEvidence: scopedNewsEvidence,
      importanceThreshold: "high",
      locale: normalizedLocale,
      now,
    });
    if (result) return result;
  }

  return null;
}

export async function triggerPmDecisionPipelineBatch({
  triggerSource,
  pool,
  newsItems = [],
  locale = LEGACY_WATCH_LOCALE,
  now = Date.now(),
}: {
  triggerSource: "cron" | "user_visit_trigger";
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  locale?: Locale;
  now?: number;
}) {
  const outputs = [];
  for (const symbol of symbolsFromPool(pool)) {
    const output = await triggerPmDecisionPipelineOnce({
      triggerSource,
      pool,
      newsItems,
      locale,
      symbol,
      now,
    });
    if (output) outputs.push(output);
  }
  return outputs;
}
