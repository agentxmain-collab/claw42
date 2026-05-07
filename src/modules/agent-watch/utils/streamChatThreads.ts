import type { ChatAction, ChatMessage, ChatThread, ConversationSeed } from "../../../lib/types";
import { sanitizeChatContent } from "../../../lib/chatGuardrails";
import type { AgentId, CoinPoolPayload, StreamEntry } from "../types";
import type { AgentWatchLocale } from "../locale";
import { AGENT_META } from "../agents";
import { buildStreamChatMessages, type AgentChatMessage } from "./streamChatMessages";

const ACTION_SEQUENCE: ChatAction[] = ["open", "question", "rebut", "agree", "refocus", "comment"];

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

  const legacyMessages = buildStreamChatMessages(entry, pool, locale);
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
