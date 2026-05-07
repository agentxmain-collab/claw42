import { checkAgentSpeech, recordAgentSpoke } from "@/lib/agentSpeechGuard";
import { pickAction, pickNextSpeaker } from "@/lib/chatActions";
import { getFaction, getFactionIds, isFactionId } from "@/lib/factionRegistry";
import { fakeFollowCount } from "@/lib/fakeFollowCount";
import { generateLlmText, hasMechanicalOutput } from "@/lib/llmFallbackChain";
import {
  buildChatMessagePrompt,
  buildChatStrategyPrompt,
  seedFromNews,
} from "@/lib/llmPromptBuilder";
import { fetchLivePriceSnapshot, type TickerSnapshot } from "@/lib/news/livePriceFetch";
import { validatePlainSpeech, plainSpeechRetryInstruction } from "@/lib/plainSpeechGuard";
import { buildCoinwDeeplink } from "@/lib/strategyDeeplink";
import { strategyRetryInstruction, validateStrategyAgainstSnapshot } from "@/lib/strategyValidator";
import type { SignalRecord } from "@/modules/agent-watch/types";
import type {
  ChatAction,
  ChatMessage,
  ChatMood,
  ChatThread,
  ConsensusRatio,
  ConversationSeed,
  DebateDirection,
  FactionId,
  FinalStrategy,
  NewsItem,
} from "@/lib/types";

const MAX_TURNS = 20;
const QUIET_STREAK_FOR_END = 3;
const MAX_RETRY_TOTAL = 5;
const MAX_CONTENT_CHARS = 80;

const BANNED_CHAT_PATTERNS = [
  /突破视角[:：]/,
  /趋势视角[:：]/,
  /回归视角[:：]/,
  /(?:Alpha|Beta|Gamma)\s*派认为[:：]?/i,
  /基于(?:派别)?分析/,
  /首先/,
  /其次/,
  /最后/,
  /综上/,
  /值得注意的是/,
];

function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return JSON.parse(jsonText) as Record<string, unknown>;
}

function normalizeDirection(value: unknown): DebateDirection {
  return value === "long" || value === "short" || value === "wait" ? value : "wait";
}

function normalizeConsensusRatio(value: unknown): ConsensusRatio {
  return value === "3:0" || value === "2:1" || value === "1:2" || value === "0:3" ? value : "1:2";
}

function normalizeMood(value: unknown): ChatMood {
  return value === "aggressive" ||
    value === "agreeable" ||
    value === "neutral" ||
    value === "sarcastic" ||
    value === "curious"
    ? value
    : "neutral";
}

function primarySymbol(seed: ConversationSeed): string {
  return seed.symbols[0]?.replace(/^\$/, "").toUpperCase() || "BTC";
}

function prefixSymbols(content: string, seed: ConversationSeed): string {
  const symbols = Array.from(new Set(["BTC", "ETH", "SOL", ...seed.symbols]));
  return symbols.reduce((text, symbol) => {
    const normalized = symbol.replace(/^\$/, "").toUpperCase();
    return text.replace(
      new RegExp(`(^|[^$A-Z0-9])${normalized}(?=[^A-Z0-9]|$)`, "g"),
      `$1$${normalized}`,
    );
  }, content);
}

function pricePoint(snapshot: TickerSnapshot | null, seed: ConversationSeed) {
  const symbol = primarySymbol(seed);
  return snapshot?.prices[symbol] ?? snapshot?.prices.BTC ?? null;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
  });
}

function fallbackContent(
  agentId: FactionId,
  seed: ConversationSeed,
  snapshot: TickerSnapshot | null,
) {
  const faction = getFaction(agentId);
  const symbol = primarySymbol(seed);
  const point = pricePoint(snapshot, seed);
  if (!point) return `${faction.nickname} 数据源 10 秒内没回，所以先等下一轮价格。`;

  const current = formatNumber(point.current);
  const high = formatNumber(point.high24h);
  const low = formatNumber(point.low24h);
  if (faction.role === "breakout") {
    return `$${symbol} 现价 ${current}，上沿在 ${high} 附近，所以站稳 ${high} 再追。`;
  }
  if (faction.role === "trend") {
    return `$${symbol} 现价 ${current}，24h 低点 ${low} 没破，所以跌回 ${low} 前先看延续。`;
  }
  return `$${symbol} 现价 ${current}，离 24h 高低 ${high}/${low} 都不远，所以等失速再动。`;
}

function syntheticSignal(agentId: FactionId, seed: ConversationSeed, ts: number): SignalRecord {
  const faction = getFaction(agentId);
  return {
    id: `chat-${seed.id}-${agentId}-${ts}`,
    ts,
    symbol: primarySymbol(seed),
    type: faction.signalTypes[0] ?? "range_change",
    severity: "watch",
    payload: { description: seed.title },
  };
}

function relationshipDebt(
  agentId: FactionId,
  otherId: FactionId | undefined,
  pairs: Array<{ agentA: FactionId; agentB: FactionId; emotionalDebt: number }>,
): number {
  if (!otherId) return 0;
  const pair = pairs.find(
    (item) =>
      (item.agentA === agentId && item.agentB === otherId) ||
      (item.agentB === agentId && item.agentA === otherId),
  );
  return pair?.emotionalDebt ?? 0;
}

function relationshipPromptLine(
  agentId: FactionId,
  pairs: Array<{ agentA: FactionId; agentB: FactionId; emotionalDebt: number }>,
) {
  const lines = pairs
    .filter((pair) => pair.agentA === agentId || pair.agentB === agentId)
    .map((pair) => {
      const otherId = pair.agentA === agentId ? pair.agentB : pair.agentA;
      const other = getFaction(otherId);
      return `- 对 ${other.nickname} 的 debt=${pair.emotionalDebt.toFixed(1)}`;
    });
  return lines.length ? `## 关系 debt 上下文\n${lines.join("\n")}` : "";
}

function isValidReplyTo(value: unknown, history: ChatMessage[]): string | undefined {
  if (typeof value !== "string" || value === "null" || value.trim() === "") return undefined;
  return history.some((message) => message.id === value) ? value : undefined;
}

function isValidMention(value: unknown, agentId: FactionId): FactionId | undefined {
  if (typeof value !== "string" || value === "null" || value.trim() === "") return undefined;
  const normalized = value.trim();
  return isFactionId(normalized) && normalized !== agentId ? normalized : undefined;
}

function validateChatContent(content: string) {
  const reasons: string[] = [];
  const text = content.trim();
  if (Array.from(text).length > MAX_CONTENT_CHARS) reasons.push("超过 80 字");
  if (BANNED_CHAT_PATTERNS.some((pattern) => pattern.test(text))) reasons.push("含报告前缀或套话");
  if (hasMechanicalOutput(text)) reasons.push("输出机械套话");
  reasons.push(...validatePlainSpeech(text).reasons);
  return { ok: reasons.length === 0, reasons };
}

function buildChatMessage({
  raw,
  fallback,
  agentId,
  action,
  threadId,
  ts,
  history,
  snapshot,
  seed,
}: {
  raw: Record<string, unknown> | null;
  fallback: string;
  agentId: FactionId;
  action: ChatAction;
  threadId: string;
  ts: number;
  history: ChatMessage[];
  snapshot: TickerSnapshot | null;
  seed: ConversationSeed;
}): { message: ChatMessage; valid: boolean; reasons: string[] } {
  const content = prefixSymbols(String(raw?.content ?? fallback).trim(), seed);
  const validation = validateChatContent(content);
  const replyTo = isValidReplyTo(raw?.replyTo, history);
  const mentioning = isValidMention(raw?.mentioning, agentId);
  const expectsReply =
    typeof raw?.expectsReply === "boolean"
      ? raw.expectsReply
      : action === "question" || action === "rebut" || action === "taunt";
  const message: ChatMessage = {
    id: `${threadId}:${agentId}:${history.length}:${ts}`,
    threadId,
    ts,
    agentId,
    content: content.slice(0, 120),
    replyTo,
    mentioning,
    action,
    expectsReply,
    mood: normalizeMood(raw?.mood),
    citedQuote: replyTo ? String(raw?.citedQuote ?? "").slice(0, 28) || undefined : undefined,
    isGoldenLine: action === "gloat" || action === "taunt",
    marketDataFetchedAt: snapshot?.fetchedAt,
  };

  const schemaReasons: string[] = [];
  if (typeof raw?.replyTo === "string" && raw.replyTo !== "null" && !replyTo) {
    schemaReasons.push("replyTo 不在最近历史");
  }
  if (typeof raw?.mentioning === "string" && raw.mentioning !== "null" && !mentioning) {
    schemaReasons.push("mentioning 无效或 @ 自己");
  }

  return {
    message,
    valid: validation.ok && schemaReasons.length === 0,
    reasons: [...validation.reasons, ...schemaReasons],
  };
}

async function generateMessage({
  agentId,
  action,
  seed,
  history,
  threadId,
  ts,
  snapshot,
  relationshipLine,
  debt,
}: {
  agentId: FactionId;
  action: ChatAction;
  seed: ConversationSeed;
  history: ChatMessage[];
  threadId: string;
  ts: number;
  snapshot: TickerSnapshot | null;
  relationshipLine: string;
  debt: number;
}): Promise<{ message: ChatMessage | null; retries: number }> {
  const fallback = fallbackContent(agentId, seed, snapshot);
  const signal = syntheticSignal(agentId, seed, ts);
  const speech = checkAgentSpeech(agentId, [signal], ts);
  if (!snapshot || !speech.shouldSpeak) {
    return {
      message: buildChatMessage({
        raw: { content: fallback, expectsReply: false, mood: "neutral" },
        fallback,
        agentId,
        action,
        threadId,
        ts,
        history,
        snapshot,
        seed,
      }).message,
      retries: 0,
    };
  }

  const prompt = await buildChatMessagePrompt({
    agentId,
    action,
    seed,
    history,
    snapshot,
    relationshipDebt: relationshipLine,
  });
  const first = await generateLlmText(prompt);
  if (!first) {
    return {
      message: buildChatMessage({
        raw: { content: fallback, expectsReply: false, mood: "neutral" },
        fallback,
        agentId,
        action,
        threadId,
        ts,
        history,
        snapshot,
        seed,
      }).message,
      retries: 0,
    };
  }

  const firstRaw = parseObject(first.text);
  const firstResult = buildChatMessage({
    raw: firstRaw,
    fallback,
    agentId,
    action,
    threadId,
    ts,
    history,
    snapshot,
    seed,
  });
  if (firstResult.valid) return { message: firstResult.message, retries: 0 };

  const retry = await generateLlmText(
    `${prompt}\n\n${plainSpeechRetryInstruction(firstResult.reasons)}\nmention/reply 也必须按 schema；当前 relationship debt=${debt.toFixed(1)}。`,
  );
  if (!retry) return { message: null, retries: 1 };
  const retryRaw = parseObject(retry.text);
  const retryResult = buildChatMessage({
    raw: retryRaw,
    fallback,
    agentId,
    action,
    threadId,
    ts,
    history,
    snapshot,
    seed,
  });
  return { message: retryResult.valid ? retryResult.message : null, retries: 1 };
}

function buildStrategyFromRaw(
  seed: ConversationSeed,
  raw: Record<string, unknown>,
  ts: number,
): FinalStrategy {
  const symbol = primarySymbol(seed);
  const id = `${seed.id}:strategy:${ts}`;
  const counts = fakeFollowCount(id, ts);
  const strategy: FinalStrategy = {
    id,
    symbol: String(raw.symbol ?? symbol)
      .replace(/^\$/, "")
      .toUpperCase(),
    direction: normalizeDirection(raw.direction),
    entryCondition: String(raw.entryCondition ?? `${symbol} 等关键位确认`).slice(0, 100),
    stopLoss: Number(raw.stopLoss) || 0,
    takeProfit: Array.isArray(raw.takeProfit)
      ? raw.takeProfit.map(Number).filter((value) => Number.isFinite(value))
      : [],
    consensusRatio: normalizeConsensusRatio(raw.consensusRatio),
    consensusAgents: Array.isArray(raw.consensusAgents)
      ? raw.consensusAgents.map(String).filter(isFactionId)
      : [],
    dissentAgents: Array.isArray(raw.dissentAgents)
      ? raw.dissentAgents.map(String).filter(isFactionId)
      : [],
    dissentNote: String(raw.dissentNote ?? "").slice(0, 100),
    riskNote: String(raw.riskNote ?? "本页面内容均由 AI 生成，不构成投资建议。").slice(0, 120),
    followCount: counts.followCount,
    viewCount: counts.viewCount,
    createdAt: ts,
    expiresAt: ts + 30 * 60_000,
    deeplink: "",
  };
  strategy.deeplink = buildCoinwDeeplink(strategy);
  return strategy;
}

async function synthesizeStrategy(
  seed: ConversationSeed,
  messages: ChatMessage[],
  ts: number,
  snapshot: TickerSnapshot | null,
): Promise<FinalStrategy | null> {
  if (messages.length < 3) return null;
  const fallbackRaw = {
    consensusReached: false,
    strategy: null,
  };
  const prompt = buildChatStrategyPrompt(seed, messages, snapshot);
  const first = await generateLlmText(prompt);
  const firstRaw = first ? parseObject(first.text) : fallbackRaw;
  if (firstRaw.consensusReached === false || firstRaw.strategy === null) return null;

  const firstStrategy = buildStrategyFromRaw(
    seed,
    (firstRaw.strategy ?? firstRaw) as Record<string, unknown>,
    ts,
  );
  const firstValidation = validateStrategyAgainstSnapshot(firstStrategy, snapshot);
  if (firstValidation.ok) return firstStrategy;

  const retry = await generateLlmText(`${prompt}\n\n${strategyRetryInstruction(firstValidation)}`);
  const retryRaw = retry ? parseObject(retry.text) : fallbackRaw;
  if (retryRaw.consensusReached === false || retryRaw.strategy === null) return null;
  const retryStrategy = buildStrategyFromRaw(
    seed,
    (retryRaw.strategy ?? retryRaw) as Record<string, unknown>,
    ts,
  );
  const retryValidation = validateStrategyAgainstSnapshot(retryStrategy, snapshot);
  if (retryValidation.ok) return retryStrategy;

  console.warn("[claw42] strategy synthesis failed", retryValidation.reasons);
  return null;
}

function pickOpener(seed: ConversationSeed): FactionId {
  const ids = getFactionIds();
  const symbol = primarySymbol(seed);
  const roleMatch = ids.find((agentId) => {
    const faction = getFaction(agentId);
    if (seed.sentiment === "bullish") return faction.role === "breakout";
    if (seed.sentiment === "bearish") return faction.role === "reversion";
    return faction.signalTypes.some((type) => seed.title.toLowerCase().includes(type));
  });
  return roleMatch ?? ids[Math.abs(symbol.length + seed.id.length) % ids.length] ?? ids[0]!;
}

function quietStreak(messages: ChatMessage[]): number {
  let count = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]!.expectsReply) break;
    count += 1;
  }
  return count;
}

export function intensityScoreFromMessages(messages: ChatMessage[]): 1 | 2 | 3 | 4 | 5 {
  const spicy = messages.filter((message) =>
    ["rebut", "taunt", "gloat", "question"].includes(message.action),
  ).length;
  return Math.min(5, Math.max(1, Math.ceil((spicy + messages.length / 4) / 2))) as
    | 1
    | 2
    | 3
    | 4
    | 5;
}

export async function runChatThread(news: NewsItem, now = Date.now()): Promise<ChatThread> {
  const seed = seedFromNews(news, now);
  const threadId = `chat:${seed.id}:${now}`;
  const relationshipSnapshot = await import("@/lib/agentRelationship")
    .then((module) => module.loadRelationshipStates(now))
    .catch(() => ({
      pairs: [] as Array<{ agentA: FactionId; agentB: FactionId; emotionalDebt: number }>,
    }));
  const snapshot = await fetchLivePriceSnapshot();
  const messages: ChatMessage[] = [];
  let retryTotal = 0;
  let nextAgent: FactionId | null = pickOpener(seed);

  while (nextAgent && messages.length < MAX_TURNS && retryTotal < MAX_RETRY_TOTAL) {
    if (messages.length >= QUIET_STREAK_FOR_END && quietStreak(messages) >= QUIET_STREAK_FOR_END) {
      break;
    }

    const last = messages[messages.length - 1];
    const debt = relationshipDebt(nextAgent, last?.agentId, relationshipSnapshot.pairs);
    const action: ChatAction =
      messages.length === 0 ? "open" : pickAction(nextAgent, messages, debt);
    const ts = now + messages.length * 1000;
    const result = await generateMessage({
      agentId: nextAgent,
      action,
      seed,
      history: messages,
      threadId,
      ts,
      snapshot,
      relationshipLine: relationshipPromptLine(nextAgent, relationshipSnapshot.pairs),
      debt,
    });

    retryTotal += result.retries;
    if (result.message) {
      messages.push(result.message);
      recordAgentSpoke(nextAgent, ts);
    }

    nextAgent = pickNextSpeaker(messages);
  }

  const strategy = await synthesizeStrategy(seed, messages, now + messages.length * 1000, snapshot);
  return {
    id: threadId,
    seed,
    messages,
    strategy,
    status: "completed",
    createdAt: now,
    completedAt: Date.now(),
  };
}
