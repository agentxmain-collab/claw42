import type {
  AgentFocus,
  AgentId,
  CoinPoolPayload,
  CoinTickerEntry,
  SignalRecord,
  StreamEntry,
  WatchUpdateEntry,
  WatchUpdateType,
} from "../types";
import { formatCoinSymbol, prefixLeadingCoinSymbol } from "./symbolFormat";

const HIGH_EVENT_SUPPRESS_MS = 90_000;
const WATCH_UPDATE_BUCKET_MS = 5 * 60_000;

const AGENT_NAME: Record<AgentId, string> = {
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
};

const UPDATE_ROTATION: WatchUpdateType[] = [
  "market_digest",
  "focus_update",
  "condition_update",
  "quiet_observation",
];

function isPriorityEvent(entry: StreamEntry): boolean {
  return entry.kind === "collective_event" || entry.kind === "focus_event" || entry.kind === "conflict_event";
}

function hasFreshPriorityEvent(entries: StreamEntry[], now: number): boolean {
  return entries.some((entry) => isPriorityEvent(entry) && Math.abs(now - entry.ts) <= HIGH_EVENT_SUPPRESS_MS);
}

function allTickers(pool: CoinPoolPayload): CoinTickerEntry[] {
  return [...pool.majors, ...pool.trending, ...pool.opportunity].filter(
    (ticker) => ticker.symbol && Number.isFinite(ticker.change24h),
  );
}

function formatChange(change: number): string {
  return `${change >= 0 ? "+" : ""}${change.toFixed(Math.abs(change) >= 10 ? 1 : 2)}%`;
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, "-").replace(/-+/g, "-");
}

function updateId(type: WatchUpdateType, semanticKey: string, now: number): string {
  const bucket = Math.floor(now / WATCH_UPDATE_BUCKET_MS);
  return `watch-${type}-${bucket}-${sanitizeKey(semanticKey)}`;
}

function firstSentence(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .split(/[。；;]/)
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? text.trim();
}

function focusByRotation(focus: AgentFocus[], now: number): AgentFocus | null {
  if (focus.length === 0) return null;
  const index = Math.abs(Math.floor(now / 60_000)) % focus.length;
  return focus[index] ?? focus[0] ?? null;
}

function entry(
  type: WatchUpdateType,
  now: number,
  semanticKey: string,
  title: string,
  content: string,
  extra: Partial<WatchUpdateEntry> = {},
): WatchUpdateEntry {
  return {
    kind: "watch_update",
    id: updateId(type, semanticKey, now),
    ts: now,
    updateType: type,
    title,
    content,
    dedupeKey: `${type}:${semanticKey}`,
    severity: "neutral",
    ...extra,
  };
}

function buildMarketDigest(now: number, pool: CoinPoolPayload): WatchUpdateEntry | null {
  const topMover = allTickers(pool).sort(
    (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
  )[0];
  if (!topMover) return null;

  const symbol = formatCoinSymbol(topMover.symbol);
  const direction = topMover.change24h >= 0 ? "走强" : "走弱";
  const content = `市场摘要：${symbol} 24h ${formatChange(topMover.change24h)}，是当前波动最大的观察点，先看是否扩散到同组币种。`;

  return entry("market_digest", now, `mover:${topMover.symbol}:${Math.round(topMover.change24h * 10)}`, "市场摘要", content, {
    symbol: topMover.symbol,
    symbols: [topMover.symbol],
    severity: Math.abs(topMover.change24h) >= 12 ? "watch" : "neutral",
    title: `${symbol} ${direction}`,
  });
}

function buildFocusUpdate(now: number, focus: AgentFocus[]): WatchUpdateEntry | null {
  const item = focusByRotation(focus, now);
  if (!item) return null;

  const symbol = formatCoinSymbol(item.symbol);
  const judgment = prefixLeadingCoinSymbol(firstSentence(item.judgment), item.symbol);
  const content = `${AGENT_NAME[item.agentId]} 当前盯防 ${symbol}：${judgment}`;

  return entry("focus_update", now, `focus:${item.agentId}:${item.symbol}:${judgment}`, "关注变化", content, {
    agentId: item.agentId,
    symbol: item.symbol,
    symbols: [item.symbol],
  });
}

function buildConditionUpdate(now: number, focus: AgentFocus[]): WatchUpdateEntry | null {
  const item = focusByRotation(focus, now + 60_000);
  if (!item) return null;

  const symbol = formatCoinSymbol(item.symbol);
  const trigger = prefixLeadingCoinSymbol(firstSentence(item.trigger.description), item.symbol);
  const fail = prefixLeadingCoinSymbol(firstSentence(item.fail.description), item.symbol);
  const content = `等待条件：${symbol} 触发看「${trigger}」；失效看「${fail}」。`;

  return entry("condition_update", now, `condition:${item.agentId}:${item.symbol}:${trigger}:${fail}`, "等待条件", content, {
    agentId: item.agentId,
    symbol: item.symbol,
    symbols: [item.symbol],
  });
}

function buildQuietObservation(
  now: number,
  focus: AgentFocus[],
  signals: SignalRecord[],
): WatchUpdateEntry | null {
  const latestSignal = [...signals].sort((a, b) => b.ts - a.ts)[0];
  if (latestSignal) {
    const symbol = formatCoinSymbol(latestSignal.symbol);
    const description = latestSignal.payload.description
      ? prefixLeadingCoinSymbol(latestSignal.payload.description, latestSignal.symbol)
      : `${symbol} 出现 ${latestSignal.type}`;
    return entry(
      "quiet_observation",
      now,
      `signal:${latestSignal.symbol}:${latestSignal.type}:${latestSignal.severity}`,
      "观察状态",
      `观察状态：最新市场信号在 ${symbol}，${description}，未升级时先等待确认。`,
      {
        symbol: latestSignal.symbol,
        symbols: [latestSignal.symbol],
      },
    );
  }

  const symbols = focus.map((item) => item.symbol).filter(Boolean);
  const displaySymbols = symbols.slice(0, 3).map(formatCoinSymbol).join(" / ");
  const content = displaySymbols
    ? `观察状态：暂无新的高优触发，3 个 Agent 继续盯防 ${displaySymbols} 的条件变化。`
    : "观察状态：暂无新的高优触发，3 个 Agent 继续等待可确认的市场信号。";

  return entry("quiet_observation", now, `quiet:${symbols.join(":") || "empty"}`, "观察状态", content, {
    symbols,
  });
}

function buildByKind(
  kind: WatchUpdateType,
  now: number,
  pool: CoinPoolPayload,
  focus: AgentFocus[],
  signals: SignalRecord[],
): WatchUpdateEntry | null {
  if (kind === "market_digest") return buildMarketDigest(now, pool);
  if (kind === "focus_update") return buildFocusUpdate(now, focus);
  if (kind === "condition_update") return buildConditionUpdate(now, focus);
  return buildQuietObservation(now, focus, signals);
}

export function buildWatchSupplementalEntry({
  now,
  pool,
  focus,
  signals,
  existingEntries,
  preferredKind,
}: {
  now: number;
  pool?: CoinPoolPayload;
  focus?: AgentFocus[];
  signals: SignalRecord[];
  existingEntries: StreamEntry[];
  preferredKind?: WatchUpdateType;
}): WatchUpdateEntry | null {
  if (!pool || hasFreshPriorityEvent(existingEntries, now)) return null;

  const safeFocus = focus ?? [];
  const rotatedKind = preferredKind ?? UPDATE_ROTATION[Math.abs(Math.floor(now / 60_000)) % UPDATE_ROTATION.length];
  const orderedKinds = [
    rotatedKind,
    ...UPDATE_ROTATION.filter((kind) => kind !== rotatedKind),
  ];

  for (const kind of orderedKinds) {
    const update = buildByKind(kind, now, pool, safeFocus, signals);
    if (update) return update;
  }

  return null;
}
