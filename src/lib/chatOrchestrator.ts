import { checkAgentSpeech, recordAgentSpoke } from "@/lib/agentSpeechGuard";
import { noDataFallbackForAgent } from "@/lib/agentDialogueExamples";
import { pickAction, pickNextSpeaker } from "@/lib/chatActions";
import {
  sanitizeChatContent,
  shouldForceMentionForFloor,
  validateChatContent as validateChatGuardrails,
} from "@/lib/chatGuardrails";
import { getFaction, getFactionIds, isFactionId } from "@/lib/factionRegistry";
import { fakeFollowCount } from "@/lib/fakeFollowCount";
import { generateText } from "@/lib/llm/generateText";
import { hasMechanicalOutput } from "@/lib/llm/guardrails";
import {
  buildChatMessagePrompt,
  buildChatStrategyPrompt,
  seedFromNews,
} from "@/lib/llmPromptBuilder";
import { fetchLivePriceSnapshot, type TickerSnapshot } from "@/lib/news/livePriceFetch";
import { validatePlainSpeech, plainSpeechRetryInstruction } from "@/lib/plainSpeechGuard";
import { computeRating, confidenceFromConsensusRatio } from "@/lib/rating";
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
const QUIET_STREAK_FOR_END = 5;
const MIN_TOTAL_MESSAGES = 6;
const MAX_RETRY_TOTAL = 5;
const MENTION_ACTIONS: ChatAction[] = ["rebut", "question", "taunt", "agree"];
const CHAT_LLM_RESPONSE_CACHE_TTL_MS = 5_000;

export { sanitizeChatContent } from "@/lib/chatGuardrails";

type ChatLlmResponse = { text: string; source: "deepseek" } | null;
type ChatLlmCachePhase = "first" | "retry";

const chatLlmResponseCache = new Map<string, { expiresAt: number; value: ChatLlmResponse }>();

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

function hashNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function hashText(value: string): string {
  return hashNumber(value).toString(36);
}

function lastFiveMessagesHash(history: ChatMessage[]): string {
  const payload = history.slice(-5).map((message) => ({
    id: message.id,
    agentId: message.agentId,
    action: message.action,
    content: message.content,
    mentioning: message.mentioning ?? null,
    replyTo: message.replyTo ?? null,
  }));
  return hashText(JSON.stringify(payload));
}

function isChatCacheDisabled(): boolean {
  return process.env.CHAT_CACHE_DISABLED === "1";
}

function chatLlmCacheKey({
  threadId,
  messageIndex,
  agentId,
  history,
  phase,
  prompt,
}: {
  threadId: string;
  messageIndex: number;
  agentId: FactionId;
  history: ChatMessage[];
  phase: ChatLlmCachePhase;
  prompt: string;
}): string {
  return [
    "chat-llm",
    `thread_id=${threadId}`,
    `message_index=${messageIndex}`,
    `agent_id=${agentId}`,
    `last_5_messages_hash=${lastFiveMessagesHash(history)}`,
    `phase=${phase}`,
    `prompt_hash=${hashText(prompt)}`,
  ].join("|");
}

function pruneExpiredChatCache(now: number) {
  for (const [key, cached] of Array.from(chatLlmResponseCache.entries())) {
    if (cached.expiresAt <= now) chatLlmResponseCache.delete(key);
  }
}

async function generateCachedChatLlmText({
  prompt,
  threadId,
  messageIndex,
  agentId,
  history,
  phase,
}: {
  prompt: string;
  threadId: string;
  messageIndex: number;
  agentId: FactionId;
  history: ChatMessage[];
  phase: ChatLlmCachePhase;
}): Promise<ChatLlmResponse> {
  if (isChatCacheDisabled()) return generateChatLlmText(prompt, `chat:${agentId}:${phase}`);

  const now = Date.now();
  pruneExpiredChatCache(now);
  const key = chatLlmCacheKey({ threadId, messageIndex, agentId, history, phase, prompt });
  const cached = chatLlmResponseCache.get(key);
  if (cached && cached.expiresAt > now) {
    console.info(`[claw42] CACHE_HIT for key=${key}`);
    return cached.value;
  }

  const value = await generateChatLlmText(prompt, `chat:${agentId}:${phase}`);
  if (value) {
    chatLlmResponseCache.set(key, {
      value,
      expiresAt: now + CHAT_LLM_RESPONSE_CACHE_TTL_MS,
    });
  }
  return value;
}

async function generateChatLlmText(prompt: string, taskTag: string): Promise<ChatLlmResponse> {
  try {
    const text = await generateText(prompt, {
      taskTag,
      temperature: 0.75,
      maxTokens: 320,
      enableCache: false,
      enableGuardrails: false,
    });
    return { text, source: "deepseek" };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] chat LLM fallback", error);
    }
    return null;
  }
}

function shouldForceOpeningReply(messageIndex: number, seed: ConversationSeed): boolean {
  if (messageIndex >= 4) return false;
  if (messageIndex < 3) return true;
  return hashNumber(`${seed.id}:reply:${messageIndex}`) % 10 < 7;
}

export function shouldForceMentionInOpening(messageIndex: number, seedId: string): boolean {
  if (messageIndex < 1 || messageIndex > 5) return false;
  if (messageIndex === 1 || messageIndex === 3) return true;
  return hashNumber(`${seedId}:mention:${messageIndex}`) % 10 < 7;
}

function actionForOpeningMention(action: ChatAction, messageIndex: number, seed: ConversationSeed) {
  if (!shouldForceMentionInOpening(messageIndex, seed.id)) return action;
  const index =
    hashNumber(`${seed.id}:mention-action:${messageIndex}:${action}`) % MENTION_ACTIONS.length;
  return MENTION_ACTIONS[index] ?? "question";
}

function mentionTargetFor(history: ChatMessage[], agentId: FactionId): FactionId | undefined {
  const recent = [...history].reverse().find((message) => message.agentId !== agentId);
  if (recent) return recent.agentId;
  return getFactionIds().find((id) => id !== agentId);
}

function lastMessageByAgent(history: ChatMessage[], agentId: FactionId | undefined) {
  if (!agentId) return undefined;
  return [...history].reverse().find((message) => message.agentId === agentId);
}

function pricePoint(snapshot: TickerSnapshot | null, seed: ConversationSeed) {
  const symbol = primarySymbol(seed);
  return snapshot?.prices[symbol] ?? null;
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
  if (!point) return noDataFallbackForAgent(agentId, `${seed.id}:${seed.createdAt}`);

  const current = formatNumber(point.current);
  const high = formatNumber(point.high24h);
  const low = formatNumber(point.low24h);
  if (faction.role === "breakout") {
    return `$${symbol} 现价 ${current}，上沿在 ${high} 附近，所以站稳 ${high} 再追多。`;
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

export function validateChatContent(content: string) {
  const reasons: string[] = [];
  const text = content.trim();
  const guardrails = validateChatGuardrails(text);
  reasons.push(...guardrails.reasons);
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
  forcedMention,
  forceExpectsReply,
  sanitizeContent = false,
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
  forcedMention?: FactionId;
  forceExpectsReply?: boolean;
  sanitizeContent?: boolean;
}): { message: ChatMessage; valid: boolean; reasons: string[] } {
  const baseContent = String(raw?.content ?? fallback).trim();
  const content = prefixSymbols(
    sanitizeContent ? sanitizeChatContent(baseContent) : baseContent,
    seed,
  );
  const contentZh =
    typeof raw?.contentZh === "string"
      ? prefixSymbols(sanitizeContent ? sanitizeChatContent(raw.contentZh) : raw.contentZh, seed)
      : content;
  const contentEn = typeof raw?.contentEn === "string" ? raw.contentEn.trim() : undefined;
  const validation = validateChatContent(content);
  const rawReplyTo = isValidReplyTo(raw?.replyTo, history);
  const rawMentioning = isValidMention(raw?.mentioning, agentId);
  const forcedMentionMessage = lastMessageByAgent(history, forcedMention);
  const mentioning = forcedMention ?? rawMentioning;
  const replyTo = rawReplyTo ?? forcedMentionMessage?.id;
  const citedSource =
    history.find((message) => message.id === replyTo) ?? lastMessageByAgent(history, mentioning);
  const rawCitedQuote = typeof raw?.citedQuote === "string" ? raw.citedQuote.trim() : "";
  const citedQuote =
    rawCitedQuote.length >= 5
      ? rawCitedQuote.slice(0, 28)
      : mentioning
        ? citedSource?.content.slice(0, 28)
        : undefined;
  const expectsReply =
    typeof forceExpectsReply === "boolean"
      ? forceExpectsReply
      : typeof raw?.expectsReply === "boolean"
        ? raw.expectsReply
        : action === "question" || action === "rebut" || action === "taunt";
  const message: ChatMessage = {
    id: `${threadId}:${agentId}:${history.length}:${ts}`,
    threadId,
    ts,
    agentId,
    content: content.slice(0, 120),
    contentZh: contentZh.slice(0, 120),
    contentEn: contentEn?.slice(0, 180),
    replyTo,
    mentioning,
    action,
    expectsReply,
    mood: normalizeMood(raw?.mood),
    citedQuote,
    isGoldenLine: action === "gloat" || action === "taunt",
    marketDataFetchedAt: snapshot?.fetchedAt,
    dataSource: snapshot ? "coingecko" : "fallback",
    snapshotAt: snapshot?.fetchedAt ?? ts,
    fetchedAt: snapshot?.fetchedAt ?? ts,
    failureFallback: !snapshot,
  };

  const schemaReasons: string[] = [];
  if (typeof raw?.replyTo === "string" && raw.replyTo !== "null" && !replyTo) {
    schemaReasons.push("replyTo 不在最近历史");
  }
  if (typeof raw?.mentioning === "string" && raw.mentioning !== "null" && !mentioning) {
    schemaReasons.push("mentioning 无效或 @ 自己");
  }
  if (mentioning && (!message.citedQuote || Array.from(message.citedQuote).length < 5)) {
    schemaReasons.push("mentioning 必须带 citedQuote");
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
  forcedMention,
  forceExpectsReply,
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
  forcedMention?: FactionId;
  forceExpectsReply?: boolean;
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
        forcedMention,
        forceExpectsReply,
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
    forcedMention,
  });
  const messageIndex = history.length;
  const first = await generateCachedChatLlmText({
    prompt,
    threadId,
    messageIndex,
    agentId,
    history,
    phase: "first",
  });
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
        forcedMention,
        forceExpectsReply,
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
    forcedMention,
    forceExpectsReply,
  });
  if (firstResult.valid) return { message: firstResult.message, retries: 0 };

  const retryPrompt = `${prompt}\n\n${plainSpeechRetryInstruction(firstResult.reasons)}\nmention/reply 也必须按 schema；当前 relationship debt=${debt.toFixed(1)}。`;
  const retry = await generateCachedChatLlmText({
    prompt: retryPrompt,
    threadId,
    messageIndex,
    agentId,
    history,
    phase: "retry",
  });
  if (!retry) {
    return {
      message: buildChatMessage({
        raw: { content: fallback, expectsReply: Boolean(forceExpectsReply), mood: "neutral" },
        fallback,
        agentId,
        action,
        threadId,
        ts,
        history,
        snapshot,
        seed,
        forcedMention,
        forceExpectsReply,
        sanitizeContent: true,
      }).message,
      retries: 1,
    };
  }
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
    forcedMention,
    forceExpectsReply,
  });
  if (retryResult.valid) return { message: retryResult.message, retries: 1 };

  const sanitizedRetryResult = buildChatMessage({
    raw: retryRaw,
    fallback,
    agentId,
    action,
    threadId,
    ts,
    history,
    snapshot,
    seed,
    forcedMention,
    forceExpectsReply,
    sanitizeContent: true,
  });
  if (sanitizedRetryResult.valid) return { message: sanitizedRetryResult.message, retries: 1 };

  return {
    message: buildChatMessage({
      raw: { content: fallback, expectsReply: Boolean(forceExpectsReply), mood: "neutral" },
      fallback,
      agentId,
      action,
      threadId,
      ts,
      history,
      snapshot,
      seed,
      forcedMention,
      forceExpectsReply,
      sanitizeContent: true,
    }).message,
    retries: 1,
  };
}

function buildStrategyFromRaw(
  seed: ConversationSeed,
  raw: Record<string, unknown>,
  ts: number,
): FinalStrategy {
  const symbol = primarySymbol(seed);
  const id = `${seed.id}:strategy:${ts}`;
  const counts = fakeFollowCount(id, ts);
  const direction = normalizeDirection(raw.direction);
  const consensusRatio = normalizeConsensusRatio(raw.consensusRatio);
  const strategy: FinalStrategy = {
    id,
    symbol: String(raw.symbol ?? symbol)
      .replace(/^\$/, "")
      .toUpperCase(),
    direction,
    rating: computeRating(direction, confidenceFromConsensusRatio(consensusRatio)),
    entryCondition: String(raw.entryCondition ?? `${symbol} 等关键位确认`).slice(0, 100),
    stopLoss: Number(raw.stopLoss) || 0,
    takeProfit: Array.isArray(raw.takeProfit)
      ? raw.takeProfit.map(Number).filter((value) => Number.isFinite(value))
      : [],
    consensusRatio,
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
  const first = await generateChatLlmText(prompt, "chat:strategy:first");
  const firstRaw = first ? parseObject(first.text) : fallbackRaw;
  if (firstRaw.consensusReached === false || firstRaw.strategy === null) return null;

  const firstStrategy = buildStrategyFromRaw(
    seed,
    (firstRaw.strategy ?? firstRaw) as Record<string, unknown>,
    ts,
  );
  const firstValidation = validateStrategyAgainstSnapshot(firstStrategy, snapshot);
  if (firstValidation.ok) return firstStrategy;

  const retry = await generateChatLlmText(
    `${prompt}\n\n${strategyRetryInstruction(firstValidation)}`,
    "chat:strategy:retry",
  );
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
    if (messages.length >= MIN_TOTAL_MESSAGES && quietStreak(messages) >= QUIET_STREAK_FOR_END) {
      break;
    }

    const last = messages[messages.length - 1];
    const debt = relationshipDebt(nextAgent, last?.agentId, relationshipSnapshot.pairs);
    const messageIndex = messages.length;
    const pickedAction: ChatAction =
      messageIndex === 0 ? "open" : pickAction(nextAgent, messages, debt);
    const action = actionForOpeningMention(pickedAction, messageIndex, seed);
    const forcedMention = shouldForceMentionForFloor(messages, messageIndex, seed.id)
      ? mentionTargetFor(messages, nextAgent)
      : undefined;
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
      forcedMention,
      forceExpectsReply: shouldForceOpeningReply(messageIndex, seed),
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
    cooldownUntil: Date.now() + 5 * 60_000,
    symbol: primarySymbol(seed),
    llmCallsUsed: messages.length + retryTotal + (strategy ? 1 : 0),
    retryCount: retryTotal,
  };
}
