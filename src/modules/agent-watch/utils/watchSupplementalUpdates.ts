import type {
  AgentDiscussionEntry,
  AgentFocus,
  AgentId,
  CoinPoolPayload,
  CoinTickerEntry,
  SignalRecord,
  StreamResponse,
  StreamEntry,
  WatchUpdateEntry,
  WatchUpdateType,
} from "../types";
import type { AgentWatchLocale } from "../locale";
import { formatCoinSymbol, prefixLeadingCoinSymbol } from "./symbolFormat";

const HIGH_EVENT_SUPPRESS_MS = 90_000;
const WATCH_UPDATE_BUCKET_MS = 5 * 60_000;
const AGENT_DISCUSSION_KIND = "agent_discussion";
const AGENT_HEARTBEAT_KIND = "agent_heartbeat";
type SupplementalUpdateKind = WatchUpdateType | typeof AGENT_DISCUSSION_KIND;

const AGENT_NAME: Record<AgentId, string> = {
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
};

const DISCUSSION_AGENT_ORDER: AgentId[] = ["alpha", "beta", "gamma"];

const AGENT_DISCUSSION_LABEL: Record<AgentId, string> = {
  alpha: "突破视角",
  beta: "趋势视角",
  gamma: "回归视角",
};

const AGENT_DISCUSSION_LABEL_EN: Record<AgentId, string> = {
  alpha: "Breakout view",
  beta: "Trend view",
  gamma: "Mean-reversion view",
};

const AGENT_HEARTBEAT_LINES: Record<AgentId, string[]> = {
  alpha: [
    "巡检：复核 {symbol} 的关键位和放量条件，未确认前不追。",
    "扫描：{symbol} 还缺少量价同步，继续等待突破确认。",
    "复核：{symbol} 未触发突破条件，报警线继续贴近近期高点。",
  ],
  beta: [
    "巡检：重新检查 {symbol} 的 EMA12/13 结构，未共振前不升级。",
    "扫描：{symbol} 趋势仍需回撤质量确认，暂不把反弹当趋势。",
    "复核：{symbol} 顺势条件不足，继续观察高位能否重新抬升。",
  ],
  gamma: [
    "巡检：继续盯 {symbol} 的极端波动和高低位失速，未确认前不介入。",
    "扫描：{symbol} 还在极端区附近，先等价格停止扩散。",
    "复核：{symbol} 回归窗口未完全打开，继续等近期高低位失速。",
  ],
};

const AGENT_HEARTBEAT_LINES_EN: Record<AgentId, string[]> = {
  alpha: [
    "Scan: rechecking {symbol} key levels and volume; no confirmation, no chase.",
    "Review: {symbol} still lacks price-volume alignment; waiting for breakout confirmation.",
    "Check: {symbol} has not triggered breakout rules; alert line stays near the recent high.",
  ],
  beta: [
    "Scan: checking {symbol} EMA12/13 structure again; no upgrade before resonance.",
    "Review: {symbol} trend still needs pullback quality; a bounce is not a trend yet.",
    "Check: {symbol} trend conditions remain thin; wait for highs to lift again.",
  ],
  gamma: [
    "Scan: watching {symbol} extreme volatility and high-low exhaustion; no early entry.",
    "Review: {symbol} is still near an extreme area; wait for price expansion to stop.",
    "Check: {symbol} mean-reversion window is not fully open; wait for high-low exhaustion.",
  ],
};

const TITLE_COPY: Record<AgentWatchLocale, Record<WatchUpdateType, string>> = {
  zh_CN: {
    market_digest: "市场摘要",
    focus_update: "关注变化",
    condition_update: "等待条件",
    agent_heartbeat: "巡检心跳",
    quiet_observation: "观察状态",
  },
  en_US: {
    market_digest: "Market digest",
    focus_update: "Focus update",
    condition_update: "Condition watch",
    agent_heartbeat: "Agent check-in",
    quiet_observation: "Observation",
  },
};

const UPDATE_ROTATION: SupplementalUpdateKind[] = [
  AGENT_HEARTBEAT_KIND,
  "market_digest",
  "focus_update",
  "condition_update",
  AGENT_DISCUSSION_KIND,
  "quiet_observation",
];

function isPriorityEvent(entry: StreamEntry): boolean {
  return (
    entry.kind === "collective_event" ||
    entry.kind === "focus_event" ||
    entry.kind === "conflict_event"
  );
}

function hasFreshPriorityEvent(entries: StreamEntry[], now: number): boolean {
  return entries.some(
    (entry) => isPriorityEvent(entry) && Math.abs(now - entry.ts) <= HIGH_EVENT_SUPPRESS_MS,
  );
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

function updateId(type: SupplementalUpdateKind, semanticKey: string, now: number): string {
  const bucket = Math.floor(now / WATCH_UPDATE_BUCKET_MS);
  return `watch-${type}-${bucket}-${sanitizeKey(semanticKey)}`;
}

function firstSentence(text: string): string {
  return (
    text
      .replace(/\s+/g, " ")
      .split(/[。；;]/)
      .map((part) => part.trim())
      .filter(Boolean)[0] ?? text.trim()
  );
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

function buildMarketDigest(
  now: number,
  pool: CoinPoolPayload,
  locale: AgentWatchLocale,
): WatchUpdateEntry | null {
  const topMover = allTickers(pool).sort(
    (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
  )[0];
  if (!topMover) return null;

  const symbol = formatCoinSymbol(topMover.symbol);
  const direction = topMover.change24h >= 0 ? "走强" : "走弱";
  const directionEn = topMover.change24h >= 0 ? "strengthening" : "weakening";
  const content =
    locale === "en_US"
      ? `Market digest: ${symbol} is ${formatChange(topMover.change24h)} over 24h, currently the largest volatility marker. Watch whether the move spreads to peers.`
      : `市场摘要：${symbol} 24h ${formatChange(topMover.change24h)}，是当前波动最大的观察点，先看是否扩散到同组币种。`;

  return entry(
    "market_digest",
    now,
    `mover:${topMover.symbol}:${Math.round(topMover.change24h * 10)}`,
    TITLE_COPY[locale].market_digest,
    content,
    {
      symbol: topMover.symbol,
      symbols: [topMover.symbol],
      severity: Math.abs(topMover.change24h) >= 12 ? "watch" : "neutral",
      title: locale === "en_US" ? `${symbol} ${directionEn}` : `${symbol} ${direction}`,
    },
  );
}

function buildFocusUpdate(
  now: number,
  focus: AgentFocus[],
  locale: AgentWatchLocale,
): WatchUpdateEntry | null {
  const item = focusByRotation(focus, now);
  if (!item) return null;

  const symbol = formatCoinSymbol(item.symbol);
  const judgment = prefixLeadingCoinSymbol(firstSentence(item.judgment), item.symbol);
  const content =
    locale === "en_US"
      ? `${AGENT_NAME[item.agentId]} is watching ${symbol}: ${judgment}`
      : `${AGENT_NAME[item.agentId]} 当前盯防 ${symbol}：${judgment}`;

  return entry(
    "focus_update",
    now,
    `focus:${item.agentId}:${item.symbol}:${judgment}`,
    TITLE_COPY[locale].focus_update,
    content,
    {
      agentId: item.agentId,
      symbol: item.symbol,
      symbols: [item.symbol],
    },
  );
}

function buildConditionUpdate(
  now: number,
  focus: AgentFocus[],
  locale: AgentWatchLocale,
): WatchUpdateEntry | null {
  const item = focusByRotation(focus, now + 60_000);
  if (!item) return null;

  const symbol = formatCoinSymbol(item.symbol);
  const trigger = prefixLeadingCoinSymbol(firstSentence(item.trigger.description), item.symbol);
  const fail = prefixLeadingCoinSymbol(firstSentence(item.fail.description), item.symbol);
  const content =
    locale === "en_US"
      ? `Condition watch: ${symbol} trigger is "${trigger}"; invalidation is "${fail}".`
      : `等待条件：${symbol} 触发看「${trigger}」；失效看「${fail}」。`;

  return entry(
    "condition_update",
    now,
    `condition:${item.agentId}:${item.symbol}:${trigger}:${fail}`,
    TITLE_COPY[locale].condition_update,
    content,
    {
      agentId: item.agentId,
      symbol: item.symbol,
      symbols: [item.symbol],
    },
  );
}

function buildQuietObservation(
  now: number,
  focus: AgentFocus[],
  signals: SignalRecord[],
  locale: AgentWatchLocale,
): WatchUpdateEntry | null {
  const latestSignal = [...signals].sort((a, b) => b.ts - a.ts)[0];
  if (latestSignal) {
    const symbol = formatCoinSymbol(latestSignal.symbol);
    const description = latestSignal.payload.description
      ? prefixLeadingCoinSymbol(latestSignal.payload.description, latestSignal.symbol)
      : `${symbol} 出现 ${latestSignal.type}`;
    const content =
      locale === "en_US"
        ? `Observation: latest signal is on ${symbol}; wait for confirmation before upgrading.`
        : `观察状态：最新市场信号在 ${symbol}，${description}，未升级时先等待确认。`;
    return entry(
      "quiet_observation",
      now,
      `signal:${latestSignal.symbol}:${latestSignal.type}:${latestSignal.severity}`,
      TITLE_COPY[locale].quiet_observation,
      content,
      {
        symbol: latestSignal.symbol,
        symbols: [latestSignal.symbol],
      },
    );
  }

  const symbols = focus.map((item) => item.symbol).filter(Boolean);
  const displaySymbols = symbols.slice(0, 3).map(formatCoinSymbol).join(" / ");
  const content =
    locale === "en_US"
      ? displaySymbols
        ? `Observation: no new high-priority trigger. The 3 Agents keep watching ${displaySymbols} for condition changes.`
        : "Observation: no new high-priority trigger. The 3 Agents are waiting for confirmable market signals."
      : displaySymbols
        ? `观察状态：暂无新的高优触发，3 个 Agent 继续盯防 ${displaySymbols} 的条件变化。`
        : "观察状态：暂无新的高优触发，3 个 Agent 继续等待可确认的市场信号。";

  return entry(
    "quiet_observation",
    now,
    `quiet:${symbols.join(":") || "empty"}`,
    TITLE_COPY[locale].quiet_observation,
    content,
    {
      symbols,
    },
  );
}

function buildAgentHeartbeat(
  now: number,
  pool: CoinPoolPayload,
  focus: AgentFocus[],
  locale: AgentWatchLocale,
): WatchUpdateEntry | null {
  const tickers = allTickers(pool);
  const fallbackTicker =
    tickers.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0] ?? null;
  const focusIndex = Math.abs(Math.floor(now / 30_000)) % Math.max(focus.length, 1);
  const item = focus[focusIndex] ?? null;
  const agentId =
    item?.agentId ?? DISCUSSION_AGENT_ORDER[focusIndex % DISCUSSION_AGENT_ORDER.length] ?? "alpha";
  const symbol = item?.symbol ?? fallbackTicker?.symbol;
  if (!symbol) return null;

  const phraseIndex = Math.abs(Math.floor(now / 30_000)) % AGENT_HEARTBEAT_LINES[agentId].length;
  const displaySymbol = formatCoinSymbol(symbol);
  const lineSet = locale === "en_US" ? AGENT_HEARTBEAT_LINES_EN : AGENT_HEARTBEAT_LINES;
  const content = `${AGENT_NAME[agentId]} ${lineSet[agentId][phraseIndex].replace("{symbol}", displaySymbol)}`;

  return entry(
    AGENT_HEARTBEAT_KIND,
    now,
    `heartbeat:${agentId}:${symbol}:${phraseIndex}`,
    TITLE_COPY[locale].agent_heartbeat,
    content,
    {
      agentId,
      symbol,
      symbols: [symbol],
    },
  );
}

function uniqueSymbols(symbols: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const symbol of symbols) {
    const normalized = symbol?.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function topMover(pool: CoinPoolPayload): CoinTickerEntry | null {
  return allTickers(pool).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0] ?? null;
}

function fallbackAgentLine(agentId: AgentId, symbol: string, change24h?: number): string {
  const displaySymbol = formatCoinSymbol(symbol);
  if (agentId === "alpha") {
    return `${displaySymbol} 先看关键位和放量是否同步，没确认不追。`;
  }
  if (agentId === "beta") {
    return `${displaySymbol} 趋势要看 EMA12/13 能否同向，回撤不破才算强。`;
  }
  const moveText = Number.isFinite(change24h)
    ? `24h ${formatChange(change24h ?? 0)} 后`
    : "波动放大后";
  return `${displaySymbol} ${moveText}先看高低位是否失速，极端区不接第一刀。`;
}

function fallbackAgentLineEn(agentId: AgentId, symbol: string, change24h?: number): string {
  const displaySymbol = formatCoinSymbol(symbol);
  if (agentId === "alpha") {
    return `${displaySymbol} needs key-level and volume confirmation; no signal, no chase.`;
  }
  if (agentId === "beta") {
    return `${displaySymbol} needs EMA12/13 alignment; only a clean pullback keeps the trend valid.`;
  }
  const moveText = Number.isFinite(change24h)
    ? `after a 24h ${formatChange(change24h ?? 0)} move`
    : "after volatility expands";
  return `${displaySymbol} ${moveText}, watch whether the high-low range stalls before mean reversion.`;
}

function buildAgentDiscussion(
  now: number,
  pool: CoinPoolPayload,
  focus: AgentFocus[],
  signals: SignalRecord[],
  locale: AgentWatchLocale,
): AgentDiscussionEntry | null {
  const focusByAgent = new Map(focus.map((item) => [item.agentId, item]));
  const latestSignal = [...signals].sort((a, b) => b.ts - a.ts)[0] ?? null;
  const mover = topMover(pool);
  const fallbackSymbol = latestSignal?.symbol ?? mover?.symbol ?? focus[0]?.symbol;
  if (!fallbackSymbol) return null;

  const symbols = uniqueSymbols([
    ...DISCUSSION_AGENT_ORDER.map((agentId) => focusByAgent.get(agentId)?.symbol),
    fallbackSymbol,
  ]).slice(0, 3);
  const topic = symbols.map(formatCoinSymbol).join(" / ");
  const tickerBySymbol = new Map(
    allTickers(pool).map((ticker) => [ticker.symbol.toUpperCase(), ticker]),
  );

  const responses: StreamResponse[] = DISCUSSION_AGENT_ORDER.map((agentId) => {
    const item = focusByAgent.get(agentId);
    const symbol = item?.symbol ?? fallbackSymbol;
    const ticker = tickerBySymbol.get(symbol.toUpperCase());
    const source =
      locale === "en_US"
        ? fallbackAgentLineEn(agentId, symbol, ticker?.change24h)
        : item
          ? firstSentence(item.judgment || item.trigger.description)
          : fallbackAgentLine(agentId, symbol, ticker?.change24h);
    const label =
      locale === "en_US" ? AGENT_DISCUSSION_LABEL_EN[agentId] : AGENT_DISCUSSION_LABEL[agentId];
    const separator = locale === "en_US" ? ": " : "：";
    const content = `${label}${separator}${prefixLeadingCoinSymbol(source, symbol)}`;
    return { agentId, content, symbol };
  });

  const semanticKey = [
    symbols.join(":"),
    ...responses.map((response) => `${response.agentId}:${firstSentence(response.content)}`),
  ].join("|");
  const hasWatchMove = mover ? Math.abs(mover.change24h) >= 12 : false;
  const hasWatchSignal = signals.some(
    (signal) => signal.severity === "alert" || signal.severity === "watch",
  );

  return {
    kind: "agent_discussion",
    id: updateId(AGENT_DISCUSSION_KIND, semanticKey, now),
    ts: now,
    topic,
    summary:
      locale === "en_US"
        ? `Agent huddle: Alpha watches breakouts, Beta watches trends, Gamma watches extremes; current checks focus on ${topic}.`
        : `三方会诊：Alpha 看突破，Beta 看趋势，Gamma 看极端；当前围绕 ${topic} 等确认。`,
    dedupeKey: `agent_discussion:${semanticKey}`,
    symbol: symbols[0],
    symbols,
    responses,
    severity: hasWatchMove || hasWatchSignal ? "watch" : "neutral",
  };
}

function buildByKind(
  kind: SupplementalUpdateKind,
  now: number,
  pool: CoinPoolPayload,
  focus: AgentFocus[],
  signals: SignalRecord[],
  locale: AgentWatchLocale,
): WatchUpdateEntry | AgentDiscussionEntry | null {
  if (kind === "market_digest") return buildMarketDigest(now, pool, locale);
  if (kind === "focus_update") return buildFocusUpdate(now, focus, locale);
  if (kind === "condition_update") return buildConditionUpdate(now, focus, locale);
  if (kind === AGENT_HEARTBEAT_KIND) return buildAgentHeartbeat(now, pool, focus, locale);
  if (kind === AGENT_DISCUSSION_KIND)
    return buildAgentDiscussion(now, pool, focus, signals, locale);
  return buildQuietObservation(now, focus, signals, locale);
}

export function buildWatchSupplementalEntry({
  now,
  pool,
  focus,
  signals,
  existingEntries,
  preferredKind,
  locale = "zh_CN",
}: {
  now: number;
  pool?: CoinPoolPayload;
  focus?: AgentFocus[];
  signals: SignalRecord[];
  existingEntries: StreamEntry[];
  preferredKind?: SupplementalUpdateKind;
  locale?: AgentWatchLocale;
}): WatchUpdateEntry | AgentDiscussionEntry | null {
  if (!pool) return null;
  if (
    hasFreshPriorityEvent(existingEntries, now) &&
    preferredKind !== AGENT_DISCUSSION_KIND &&
    preferredKind !== AGENT_HEARTBEAT_KIND
  ) {
    return null;
  }

  const safeFocus = focus ?? [];
  const rotatedKind =
    preferredKind ?? UPDATE_ROTATION[Math.abs(Math.floor(now / 60_000)) % UPDATE_ROTATION.length];
  const orderedKinds = [rotatedKind, ...UPDATE_ROTATION.filter((kind) => kind !== rotatedKind)];

  for (const kind of orderedKinds) {
    const update = buildByKind(kind, now, pool, safeFocus, signals, locale);
    if (update) return update;
  }

  return null;
}
