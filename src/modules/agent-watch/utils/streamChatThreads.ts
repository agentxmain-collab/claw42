import type { ChatAction, ChatMessage, ChatThread, ConversationSeed } from "../../../lib/types";
import { sanitizeChatContent } from "../../../lib/chatGuardrails";
import type { AgentId, CoinPoolPayload, StreamEntry } from "../types";
import type { AgentWatchLocale } from "../locale";
import { AGENT_META, AGENT_ORDER } from "../agents";
import { buildStreamChatMessages, type AgentChatMessage } from "./streamChatMessages";
import { formatCoinSymbol } from "./symbolFormat";

const ACTION_SEQUENCE: ChatAction[] = ["open", "question", "rebut", "agree", "refocus", "comment"];
const BREAKOUT_AGENT = AGENT_ORDER[0]!;
const TREND_AGENT = AGENT_ORDER[1]!;
const EXTREME_AGENT = AGENT_ORDER[2]!;

const BOOT_COPY: Record<AgentWatchLocale, Array<{ agentId: AgentId; content: string }>> = {
  zh_CN: [
    { agentId: TREND_AGENT, content: "我先接行情源，主流币价格出来前先看队列。" },
    { agentId: BREAKOUT_AGENT, content: "我盯突破和放量，数据一到先筛可确认信号。" },
    { agentId: EXTREME_AGENT, content: "我盯极端波动，先把异常币池排出来。" },
  ],
  en_US: [
    { agentId: TREND_AGENT, content: "I am connecting the market feed before calling trend." },
    {
      agentId: BREAKOUT_AGENT,
      content: "I will screen breakout volume once the first tick lands.",
    },
    { agentId: EXTREME_AGENT, content: "I am sorting extreme movers while fresh prices load." },
  ],
};

function uniqueSymbols(symbols: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  symbols.forEach((symbol) => {
    const normalized = symbol.replace(/^\$/, "").trim().toUpperCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function symbolsForEntry(entry: StreamEntry) {
  if (entry.kind === "chat_thread") return entry.thread.seed.symbols;
  if (entry.kind === "news_debate") return entry.debate.chatThread.seed.symbols;
  if ("symbols" in entry && Array.isArray(entry.symbols)) return entry.symbols;
  if ("symbol" in entry && typeof entry.symbol === "string") return [entry.symbol];
  return [];
}

function nextAgentAfter(agentId: AgentId, offset: number): AgentId {
  const index = AGENT_ORDER.indexOf(agentId);
  const safeIndex = index >= 0 ? index : 0;
  return AGENT_ORDER[(safeIndex + offset) % AGENT_ORDER.length] ?? AGENT_ORDER[0]!;
}

function primarySymbol(messages: AgentChatMessage[], entry: StreamEntry) {
  return (
    messages.flatMap((message) => message.symbols)[0] ??
    uniqueSymbols(symbolsForEntry(entry))[0] ??
    "BTC"
  );
}

function followUpContent({
  agentId,
  symbol,
  locale,
}: {
  agentId: AgentId;
  symbol: string;
  locale: AgentWatchLocale;
}) {
  const formattedSymbol = formatCoinSymbol(symbol);
  if (locale === "en_US") {
    if (agentId === BREAKOUT_AGENT) {
      return `${formattedSymbol} still needs level and volume confirmation; no clean trigger yet.`;
    }
    if (agentId === TREND_AGENT) {
      return `${formattedSymbol} trend is not aligned yet; wait for the next confirmation tick.`;
    }
    return `${formattedSymbol} is not extreme enough yet; watch the recent high-low boundary.`;
  }

  if (agentId === BREAKOUT_AGENT) {
    return `${formattedSymbol} 先看关键位和放量确认，没信号就不追。`;
  }
  if (agentId === TREND_AGENT) {
    return `${formattedSymbol} 趋势还没完全接上，先等下一根确认。`;
  }
  return `${formattedSymbol} 位置还没到足够极端，先看近期高低位失速。`;
}

function withConversationFollowUps(
  messages: AgentChatMessage[],
  entry: StreamEntry,
  locale: AgentWatchLocale,
): AgentChatMessage[] {
  if (messages.length >= 3) return messages;

  const first = messages[0];
  if (!first) return messages;

  const symbol = primarySymbol(messages, entry);
  const symbols = uniqueSymbols([symbol, ...first.symbols]).slice(0, 2);
  const result = [...messages];

  while (result.length < 3) {
    const agentId = nextAgentAfter(first.agentId, result.length);
    const id = `${entry.id}-reply-${result.length}-${agentId}`;
    result.push({
      id,
      ts: first.ts + result.length * 1000,
      agentId,
      content: followUpContent({ agentId, symbol, locale }),
      symbols,
      tag: first.tag,
      marketDataFetchedAt: first.marketDataFetchedAt,
    });
  }

  return result;
}

function titleForEntry(entry: StreamEntry, locale: AgentWatchLocale) {
  if (entry.kind === "chat_thread") return entry.thread.seed.title;
  if (entry.kind === "news_debate") return entry.debate.chatThread.seed.title;
  if (entry.kind === "agent_discussion") {
    return locale === "en_US" ? "Agent huddle" : "三方会诊";
  }
  if (entry.kind === "watch_update") return entry.title;
  if (entry.kind === "focus_event") return locale === "en_US" ? "High-priority signal" : "高优信号";
  if (entry.kind === "collective_event")
    return locale === "en_US" ? "Collective signal" : "集体信号";
  if (entry.kind === "conflict_event") return locale === "en_US" ? "View conflict" : "观点分歧";
  return locale === "en_US" ? "Agent update" : "Agent 更新";
}

function seedForEntry(entry: StreamEntry, locale: AgentWatchLocale): ConversationSeed {
  const symbols = uniqueSymbols(symbolsForEntry(entry));
  const title = titleForEntry(entry, locale);
  return {
    id: `stream-seed:${entry.id}`,
    type: "market",
    title,
    description: title,
    symbols,
    sentiment: "neutral",
    createdAt: entry.ts,
  };
}

function clipText(text: string, max = 96) {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return text.trim();
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trim()}…`;
}

function firstUsefulSentence(content: string) {
  const cleaned = sanitizeChatContent(content)
    .replace(/\s+/g, " ")
    .replace(/^[-—:：]\s*/, "")
    .trim();
  const sentences = cleaned
    .split(/(?<=[。！？!?；;])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return clipText(sentences[0] ?? cleaned);
}

function conversationalContent({
  message,
  previous,
  action,
  locale,
}: {
  message: AgentChatMessage;
  previous?: ChatMessage;
  action: ChatAction;
  locale: AgentWatchLocale;
}) {
  const base = firstUsefulSentence(message.content);
  if (!previous || previous.agentId === message.agentId) return base;

  const previousName = AGENT_META[previous.agentId as AgentId].name;
  if (locale === "en_US") {
    const prefix =
      action === "agree"
        ? `${previousName}, I buy that.`
        : action === "question"
          ? `${previousName}, wait for one more tick.`
          : action === "rebut"
            ? `${previousName}, not convinced yet.`
            : `${previousName}, I will add one condition.`;
    return clipText(`${prefix} ${base}`, 110);
  }

  const prefix =
    action === "agree"
      ? `${previousName}，这点我认。`
      : action === "question"
        ? `${previousName}，这点先别急。`
        : action === "rebut"
          ? `${previousName}，我不完全认。`
          : `${previousName}，我补一个条件。`;
  return clipText(`${prefix}${base}`, 110);
}

function chatMessageFromLegacy({
  threadId,
  source,
  index,
  previous,
  locale,
}: {
  threadId: string;
  source: AgentChatMessage;
  index: number;
  previous?: ChatMessage;
  locale: AgentWatchLocale;
}): ChatMessage {
  const action = ACTION_SEQUENCE[index] ?? "comment";
  const mentioning = previous && previous.agentId !== source.agentId ? previous.agentId : undefined;
  const content = conversationalContent({ message: source, previous, action, locale });
  return {
    id: `${threadId}:legacy:${index}:${source.id}`,
    threadId,
    ts: source.ts + index * 1000,
    agentId: source.agentId,
    content,
    contentZh: content,
    replyTo: previous?.id,
    mentioning,
    action,
    expectsReply: index < 2,
    mood: action === "question" ? "curious" : action === "rebut" ? "aggressive" : "neutral",
    citedQuote: mentioning ? previous?.content.slice(0, 28) : undefined,
    marketDataFetchedAt: source.marketDataFetchedAt,
    dataSource: source.marketDataFetchedAt ? "coinw" : "fallback",
    snapshotAt: source.marketDataFetchedAt ?? source.ts,
    fetchedAt: source.marketDataFetchedAt ?? source.ts,
    failureFallback: !source.marketDataFetchedAt,
  };
}

export function buildStreamChatThread(
  entry: StreamEntry,
  pool?: CoinPoolPayload,
  locale: AgentWatchLocale = "zh_CN",
): ChatThread | null {
  if (entry.kind === "chat_thread") return entry.thread;
  if (entry.kind === "news_debate") return entry.debate.chatThread;

  const legacyMessages = withConversationFollowUps(
    buildStreamChatMessages(entry, pool, locale),
    entry,
    locale,
  );
  if (legacyMessages.length === 0) return null;

  const threadId = `stream-thread:${entry.id}`;
  const messages: ChatMessage[] = [];
  legacyMessages.forEach((legacy, index) => {
    messages.push(
      chatMessageFromLegacy({
        threadId,
        source: legacy,
        index,
        previous: messages[index - 1],
        locale,
      }),
    );
  });

  return {
    id: threadId,
    seed: seedForEntry(entry, locale),
    messages,
    strategy: null,
    status: "completed",
    createdAt: entry.ts,
    completedAt: entry.ts + messages.length * 1000,
    symbol: uniqueSymbols(symbolsForEntry(entry))[0],
  };
}

export function buildLoadingChatThread(
  locale: AgentWatchLocale,
  now: number = Date.now(),
): ChatThread {
  const threadId = `boot:${locale}`;
  const seed: ConversationSeed = {
    id: `boot-seed:${locale}`,
    type: "market",
    title: locale === "en_US" ? "Connecting market feed" : "连接行情",
    description:
      locale === "en_US"
        ? "Agents are preparing the live market context."
        : "Agent 正在准备实时行情上下文。",
    symbols: ["BTC", "ETH", "SOL"],
    sentiment: "neutral",
    createdAt: now,
  };
  const messages = BOOT_COPY[locale].map(
    (item, index): ChatMessage => ({
      id: `${threadId}:boot:${index}:${item.agentId}`,
      threadId,
      ts: now + index * 1000,
      agentId: item.agentId,
      content: item.content,
      contentZh: item.content,
      action: index === 0 ? "open" : index === 1 ? "agree" : "refocus",
      expectsReply: index < 2,
      mood: index === 0 ? "neutral" : index === 1 ? "agreeable" : "curious",
      dataSource: "fallback",
      snapshotAt: now,
      fetchedAt: now,
      failureFallback: true,
    }),
  );

  return {
    id: threadId,
    seed,
    messages,
    strategy: null,
    status: "active",
    createdAt: now,
    symbol: "BTC",
  };
}
