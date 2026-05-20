import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";
import type { DecisionOutcome, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { CoinPoolPayload, CoinTickerEntry, SignalRecord } from "@/modules/agent-watch/types";

type TopicReasonKind =
  | "marketCap"
  | "volume"
  | "news"
  | "executable"
  | "market"
  | "momentum"
  | "pool"
  | "memory";

export type TopicScoreBreakdown = Record<TopicReasonKind, number> & {
  total: number;
};

export interface TopicSelectionReason {
  kind: TopicReasonKind;
  label: string;
  detail: string;
  score: number;
}

export interface PmDecisionTopicCandidate {
  symbol: string;
  execution: {
    executable: boolean;
    coinwPair: string | null;
    watchOnly: boolean;
    watchOnlyReason?: "not_listed_on_coinw" | "mapping_unknown";
  };
  score: number;
  scoreBreakdown: TopicScoreBreakdown;
  reasons: TopicSelectionReason[];
  marketSignalIds: string[];
  newsEvidenceIds: string[];
}

interface SelectPmDecisionTopicsInput {
  pool?: CoinPoolPayload;
  marketSignals?: SignalRecord[];
  newsEvidence?: NewsEvidence[];
  recentDecisionRecords?: StrategyDecisionRecord[];
  recentTimelineEvents?: PublicTimelineEvent[];
  symbol?: string;
  now?: number;
}

export const USER_VISIT_SYMBOL_CANDIDATE_CAP = 3;

const RECENT_TOPIC_SUPPRESSION_MS = 170 * 60_000;
const DECISION_MEMORY_WINDOW_MS = 48 * 60 * 60_000;
const NEWS_HEAT_WINDOW_MS = 7 * 24 * 60 * 60_000;
const TOPIC_SELECTION_CACHE_TTL_MS = 5 * 60_000;
const SELECTOR_TOP_N = 12;
const STATIC_FALLBACK_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE"];

const topicSelectionCache = new Map<
  string,
  { expiresAt: number; value: PmDecisionTopicCandidate[] }
>();

const NEWS_SCORES = {
  high: 60,
  medium: 28,
  low: 8,
} satisfies Record<NewsEvidence["impactSeverity"], number>;

const SIGNAL_SCORES = {
  alert: 40,
  watch: 5,
  info: 1,
} satisfies Record<SignalRecord["severity"], number>;

const POOL_SCORES = {
  majors: 1,
  trending: 3,
  opportunity: 2,
} satisfies Record<CoinTickerEntry["category"], number>;

const POOL_DETAILS = {
  majors: "主流高流动性池",
  trending: "趋势加速池",
  opportunity: "机会观察池",
} satisfies Record<CoinTickerEntry["category"], string>;

const MEMORY_SCORES = {
  hit_tp: 6,
  hit_sl: -10,
  expired: -4,
  manual_close: 0,
} satisfies Record<Exclude<DecisionOutcome, null>, number>;

const MEMORY_DETAILS = {
  hit_tp: "上一轮命中止盈，保留趋势延续跟踪",
  hit_sl: "上一轮触发止损，本轮降低追单优先级",
  expired: "上一轮到期未触发，本轮降低追单优先级",
  manual_close: "上一轮人工关闭，进入观察",
} satisfies Record<Exclude<DecisionOutcome, null>, string>;

const PUBLIC_REASON_LABELS = {
  marketCap: "市值权重",
  volume: "24h成交量",
  news: "新闻热度",
  executable: "可执行性",
  market: "市场信号",
  momentum: "24h波动",
  pool: "候选池",
  memory: "复盘记忆",
} satisfies Record<TopicReasonKind, string>;

const PUBLIC_REASON_ORDER: TopicReasonKind[] = [
  "marketCap",
  "volume",
  "news",
  "executable",
  "market",
  "momentum",
  "pool",
  "memory",
];
const MARKET_NEWS_ANCHOR_SYMBOL = "BTC";

export function clearTopicSelectionCacheForTests() {
  topicSelectionCache.clear();
}

function normalizeSymbol(symbol: string | undefined) {
  return symbol?.trim().replace(/^\$+/, "").toUpperCase() ?? "";
}

function usableSymbol(symbol: unknown) {
  if (typeof symbol !== "string") return null;
  const normalized = normalizeSymbol(symbol);
  return normalized && normalized !== "UNKNOWN" ? normalized : null;
}

function memoryRecordSymbol(record: StrategyDecisionRecord) {
  return usableSymbol(record.symbol) ?? usableSymbol(record.tradeDecision?.symbol);
}

function dedupeSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
}

function tickerEntries(pool: CoinPoolPayload | undefined) {
  if (!pool) return [];
  return [...pool.majors, ...pool.trending, ...pool.opportunity];
}

function orderedCandidateSymbols({
  pool,
  marketSignals,
  newsEvidence,
  symbol,
}: Pick<SelectPmDecisionTopicsInput, "pool" | "marketSignals" | "newsEvidence" | "symbol">) {
  if (symbol) {
    const normalized = normalizeSymbol(symbol);
    return normalized ? [normalized] : [];
  }
  const poolSymbols = dedupeSymbols(tickerEntries(pool).map((item) => item.symbol));
  if (poolSymbols.length > 0) return poolSymbols;
  const fallbackSymbols = dedupeSymbols([
    ...(newsEvidence ?? []).flatMap((evidence) => evidence.symbol),
    ...(marketSignals ?? []).map((signal) => signal.symbol),
  ]);
  return fallbackSymbols.length > 0 ? fallbackSymbols.slice(0, 6) : STATIC_FALLBACK_SYMBOLS;
}

function recentPmDecisionSymbols(events: PublicTimelineEvent[] | undefined, now: number) {
  const cutoff = now - RECENT_TOPIC_SUPPRESSION_MS;
  const symbols = new Set<string>();
  for (const event of events ?? []) {
    if (event.payload.kind !== "pm_decision" || event.ts < cutoff) continue;
    const symbol = normalizeSymbol(event.payload.symbol);
    if (symbol) symbols.add(symbol);
  }
  return symbols;
}

function evidenceMatchesSymbol(evidence: NewsEvidence, symbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (evidence.symbol.length === 0) return normalizedSymbol === MARKET_NEWS_ANCHOR_SYMBOL;
  return evidence.symbol.map(normalizeSymbol).includes(normalizedSymbol);
}

function strongestNewsReason(evidences: NewsEvidence[]): TopicSelectionReason | null {
  if (evidences.length === 0) return null;
  const strongest = [...evidences].sort(
    (left, right) => NEWS_SCORES[right.impactSeverity] - NEWS_SCORES[left.impactSeverity],
  )[0];
  return {
    kind: "news",
    label: `${strongest.impactSeverity} impact news`,
    detail: strongest.summary || strongest.title,
    score: NEWS_SCORES[strongest.impactSeverity],
  };
}

function recentNewsEvidence(evidences: NewsEvidence[], now: number) {
  const cutoff = now - NEWS_HEAT_WINDOW_MS;
  return evidences.filter((evidence) => {
    const publishedAt = Date.parse(evidence.publishedAt);
    return Number.isFinite(publishedAt) && publishedAt >= cutoff && publishedAt <= now + 60_000;
  });
}

function newsHeatReason(evidences: NewsEvidence[], now: number): TopicSelectionReason | null {
  const recent = recentNewsEvidence(evidences, now);
  if (recent.length === 0) return null;
  const sources = new Set(
    recent
      .map((evidence) => evidence.sourceDomain ?? evidence.source)
      .map((source) => source.trim().toLowerCase())
      .filter(Boolean),
  );
  const highImpactCount = recent.filter((evidence) => evidence.impactSeverity === "high").length;
  const mediumImpactCount = recent.filter(
    (evidence) => evidence.impactSeverity === "medium",
  ).length;
  const strongest = strongestNewsReason(recent)?.score ?? 0;
  const aggregate = Math.min(
    90,
    Math.min(recent.length, 6) * 8 +
      Math.min(sources.size, 4) * 5 +
      highImpactCount * 24 +
      mediumImpactCount * 8,
  );
  const score = Math.max(strongest, aggregate);
  return {
    kind: "news",
    label: "7d news heat",
    detail: `7d ${recent.length}篇 / ${sources.size}源 / ${highImpactCount}高影响`,
    score,
  };
}

function strongestSignalReason(signals: SignalRecord[]): TopicSelectionReason | null {
  if (signals.length === 0) return null;
  const strongest = [...signals].sort(
    (left, right) => SIGNAL_SCORES[right.severity] - SIGNAL_SCORES[left.severity],
  )[0];
  return {
    kind: "market",
    label: `${strongest.severity} signal`,
    detail:
      strongest.payload.description ?? `${strongest.symbol} ${strongest.type.replace(/_/g, " ")}`,
    score: SIGNAL_SCORES[strongest.severity],
  };
}

function tickerReason(ticker: CoinTickerEntry | undefined): TopicSelectionReason | null {
  if (!ticker || !Number.isFinite(ticker.change24h)) return null;
  const absChange = Math.abs(ticker.change24h);
  if (absChange < 1) return null;
  return {
    kind: "momentum",
    label: "24h move",
    detail: `24h ${ticker.change24h.toFixed(2)}%`,
    score: Math.min(absChange * 2, 20),
  };
}

function poolReason(ticker: CoinTickerEntry | undefined): TopicSelectionReason | null {
  if (!ticker) return null;
  return {
    kind: "pool",
    label: `${ticker.category} pool`,
    detail: POOL_DETAILS[ticker.category],
    score: POOL_SCORES[ticker.category],
  };
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function logScore({
  value,
  peerValues,
  maxScore,
  neutralScore,
}: {
  value: unknown;
  peerValues: unknown[];
  maxScore: number;
  neutralScore: number;
}) {
  const parsed = positiveNumber(value);
  if (parsed === null) return neutralScore;
  const logs = peerValues
    .map(positiveNumber)
    .filter((item): item is number => item !== null)
    .map((item) => Math.log10(item));
  if (logs.length === 0) return neutralScore;
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  if (Math.abs(max - min) < 0.0001) return neutralScore;
  return ((Math.log10(parsed) - min) / (max - min)) * maxScore;
}

function marketCapReason(
  ticker: CoinTickerEntry | undefined,
  entries: CoinTickerEntry[],
): TopicSelectionReason {
  const score = logScore({
    value: ticker?.marketCapUsd,
    peerValues: entries.map((entry) => entry.marketCapUsd),
    maxScore: 30,
    neutralScore: 15,
  });
  return {
    kind: "marketCap",
    label: "market cap rank",
    detail: ticker?.marketCapUsd ? "市值档位参与排序" : "基础市值权重",
    score,
  };
}

function volumeReason(
  ticker: CoinTickerEntry | undefined,
  entries: CoinTickerEntry[],
): TopicSelectionReason {
  const score = logScore({
    value: ticker?.totalVolumeUsd24h,
    peerValues: entries.map((entry) => entry.totalVolumeUsd24h),
    maxScore: 25,
    neutralScore: 12.5,
  });
  return {
    kind: "volume",
    label: "24h volume rank",
    detail: ticker?.totalVolumeUsd24h ? "24h成交量参与排序" : "基础成交量权重",
    score,
  };
}

function executableReason(symbol: string): TopicSelectionReason {
  const mapping = resolveSymbolMapping(symbol);
  const score = mapping.execution.executable
    ? 18
    : mapping.execution.watchOnlyReason === "not_listed_on_coinw"
      ? 6
      : 2;
  return {
    kind: "executable",
    label: mapping.execution.executable ? "CoinW executable" : "watch-only",
    detail: mapping.execution.executable ? "CoinW可执行标的" : "仅观察标的",
    score,
  };
}

function decisionMemoryReason(
  records: StrategyDecisionRecord[] | undefined,
  symbol: string,
  now: number,
): TopicSelectionReason | null {
  const cutoff = now - DECISION_MEMORY_WINDOW_MS;
  const latest = (records ?? [])
    .filter((record) => {
      if (memoryRecordSymbol(record) !== normalizeSymbol(symbol)) return false;
      if (!record.resolvedOutcome || !record.resolvedAt) return false;
      const resolvedAt = Date.parse(record.resolvedAt);
      return Number.isFinite(resolvedAt) && resolvedAt >= cutoff;
    })
    .sort(
      (left, right) => Date.parse(right.resolvedAt ?? "") - Date.parse(left.resolvedAt ?? ""),
    )[0];
  const outcome = latest?.resolvedOutcome;
  if (!outcome) return null;
  return {
    kind: "memory",
    label: `${outcome} memory`,
    detail: MEMORY_DETAILS[outcome],
    score: MEMORY_SCORES[outcome],
  };
}

function scoreBreakdown(reasons: TopicSelectionReason[]): TopicScoreBreakdown {
  const breakdown: TopicScoreBreakdown = {
    marketCap: 0,
    volume: 0,
    news: 0,
    executable: 0,
    market: 0,
    momentum: 0,
    pool: 0,
    memory: 0,
    total: 0,
  };
  for (const reason of reasons) {
    breakdown[reason.kind] += reason.score;
    breakdown.total += reason.score;
  }
  return breakdown;
}

function selectionCacheKey({
  pool,
  marketSignals,
  newsEvidence,
  recentDecisionRecords,
  recentTimelineEvents,
  now,
}: Required<
  Pick<
    SelectPmDecisionTopicsInput,
    "marketSignals" | "newsEvidence" | "recentDecisionRecords" | "recentTimelineEvents" | "now"
  >
> &
  Pick<SelectPmDecisionTopicsInput, "pool">) {
  return JSON.stringify({
    cacheBucket: Math.floor(now / TOPIC_SELECTION_CACHE_TTL_MS),
    pool: tickerEntries(pool).map((entry) => [
      normalizeSymbol(entry.symbol),
      entry.price,
      entry.change24h,
      entry.marketCapUsd ?? null,
      entry.totalVolumeUsd24h ?? null,
      entry.category,
    ]),
    marketSignals: marketSignals.map((signal) => [
      signal.id,
      normalizeSymbol(signal.symbol),
      signal.severity,
    ]),
    newsEvidence: newsEvidence.map((evidence) => [
      evidence.id,
      evidence.publishedAt,
      evidence.impactSeverity,
      evidence.sourceDomain ?? evidence.source,
      evidence.symbol.map(normalizeSymbol).sort().join(","),
    ]),
    recentDecisionRecords: recentDecisionRecords.map((record) => [
      record.id,
      memoryRecordSymbol(record),
      record.resolvedOutcome,
      record.resolvedAt,
    ]),
    recentTimelineEvents: recentTimelineEvents.map((event) => [
      event.id,
      event.ts,
      event.payload.kind === "pm_decision" ? event.payload.symbol : "",
    ]),
  });
}

function selectPmDecisionTopicsUncached({
  pool,
  marketSignals,
  newsEvidence,
  recentDecisionRecords,
  recentTimelineEvents,
  symbol,
  now,
}: Required<Omit<SelectPmDecisionTopicsInput, "pool" | "symbol">> &
  Pick<SelectPmDecisionTopicsInput, "pool" | "symbol">): PmDecisionTopicCandidate[] {
  const entries = tickerEntries(pool);
  const suppressedSymbols = symbol
    ? new Set<string>()
    : recentPmDecisionSymbols(recentTimelineEvents, now);
  const symbols = orderedCandidateSymbols({ pool, marketSignals, newsEvidence, symbol }).filter(
    (candidateSymbol) => !suppressedSymbols.has(normalizeSymbol(candidateSymbol)),
  );

  return symbols
    .map((candidateSymbol, index) => {
      const normalizedSymbol = normalizeSymbol(candidateSymbol);
      const symbolMapping = resolveSymbolMapping(normalizedSymbol);
      const ticker = entries.find((item) => normalizeSymbol(item.symbol) === normalizedSymbol);
      const scopedSignals = marketSignals.filter(
        (signal) => normalizeSymbol(signal.symbol) === normalizedSymbol,
      );
      const scopedEvidence = newsEvidence.filter((evidence) =>
        evidenceMatchesSymbol(evidence, normalizedSymbol),
      );
      const reasons = [
        marketCapReason(ticker, entries),
        volumeReason(ticker, entries),
        newsHeatReason(scopedEvidence, now) ?? strongestNewsReason(scopedEvidence),
        executableReason(normalizedSymbol),
        strongestSignalReason(scopedSignals),
        tickerReason(ticker),
        poolReason(ticker),
        decisionMemoryReason(recentDecisionRecords, normalizedSymbol, now),
      ].filter((reason): reason is TopicSelectionReason => Boolean(reason));
      const breakdown = scoreBreakdown(reasons);
      const score = breakdown.total - index * Number.EPSILON;

      return {
        symbol: normalizedSymbol,
        execution: {
          executable: symbolMapping.execution.executable,
          coinwPair: symbolMapping.execution.coinwPair,
          watchOnly: !symbolMapping.execution.executable,
          watchOnlyReason: symbolMapping.execution.watchOnlyReason,
        },
        score,
        scoreBreakdown: breakdown,
        reasons,
        marketSignalIds: scopedSignals.map((signal) => signal.id),
        newsEvidenceIds: scopedEvidence.map((evidence) => evidence.id),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, symbol ? 1 : SELECTOR_TOP_N);
}

export function selectPmDecisionTopics({
  pool,
  marketSignals = [],
  newsEvidence = [],
  recentDecisionRecords = [],
  recentTimelineEvents = [],
  symbol,
  now = Date.now(),
}: SelectPmDecisionTopicsInput): PmDecisionTopicCandidate[] {
  if (!symbol) {
    const cacheKey = selectionCacheKey({
      pool,
      marketSignals,
      newsEvidence,
      recentDecisionRecords,
      recentTimelineEvents,
      now,
    });
    const cached = topicSelectionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;
    const selected = selectPmDecisionTopicsUncached({
      pool,
      marketSignals,
      newsEvidence,
      recentDecisionRecords,
      recentTimelineEvents,
      symbol,
      now,
    });
    topicSelectionCache.set(cacheKey, {
      expiresAt: now + TOPIC_SELECTION_CACHE_TTL_MS,
      value: selected,
    });
    return selected;
  }

  return selectPmDecisionTopicsUncached({
    pool,
    marketSignals,
    newsEvidence,
    recentDecisionRecords,
    recentTimelineEvents,
    symbol,
    now,
  });
}

function formatPublicReason(reason: TopicSelectionReason) {
  return `${PUBLIC_REASON_LABELS[reason.kind]}：${reason.detail}`;
}

function formatReasonLabelList(kinds: TopicReasonKind[]) {
  return kinds.map((kind) => PUBLIC_REASON_LABELS[kind]).join("、");
}

function formatPublicDriverSummary(breakdown: TopicScoreBreakdown) {
  const positiveDrivers = PUBLIC_REASON_ORDER.filter((kind) => breakdown[kind] > 0).sort(
    (left, right) => breakdown[right] - breakdown[left],
  );
  const constraintDrivers = PUBLIC_REASON_ORDER.filter((kind) => breakdown[kind] < 0).sort(
    (left, right) => breakdown[left] - breakdown[right],
  );
  const parts = [
    positiveDrivers.length > 0
      ? `${formatReasonLabelList(positiveDrivers.slice(0, 2))}是主因`
      : null,
    positiveDrivers.length > 2
      ? `${formatReasonLabelList(positiveDrivers.slice(2, 4))}提供辅助`
      : null,
    constraintDrivers.length > 0 ? `${formatReasonLabelList(constraintDrivers)}是约束` : null,
  ].filter(Boolean);
  return parts.join("；");
}

export function buildTopicSelectionEvidence(
  topic: PmDecisionTopicCandidate,
  now = Date.now(),
): NewsEvidence {
  const timestamp = new Date(now).toISOString();
  const reasonText =
    topic.reasons.length > 0
      ? topic.reasons.map(formatPublicReason).join("；")
      : "默认高流动性观察标的";
  const driverText = formatPublicDriverSummary(topic.scoreBreakdown);
  const summary = driverText
    ? `本轮优先分析 ${topic.symbol}：${driverText}。依据：${reasonText}。`
    : `本轮优先分析 ${topic.symbol}：${reasonText}。`;

  return {
    id: `topic_selection:${topic.symbol}:${now}`,
    source: "Claw42 Topic Selector",
    title: `${topic.symbol} 实时交易决策选题`,
    url: "#",
    publishedAt: timestamp,
    fetchedAt: timestamp,
    symbol: [topic.symbol],
    impactSeverity: "medium",
    summary,
  };
}
