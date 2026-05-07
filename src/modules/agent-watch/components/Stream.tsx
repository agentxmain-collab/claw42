"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import type { Dict } from "@/i18n/types";
import type { AgentId, CoinPoolPayload, StreamEntry } from "../types";
import type { AgentWatchLocale } from "../locale";
import { buildStreamChatMessages } from "../utils/streamChatMessages";
import { AgentChatBubble } from "./AgentChatBubble";
import { ChatScrollContainer, type ChatScrollContainerHandle } from "./ChatScrollContainer";
import { ChatThreadRenderer } from "./ChatThreadRenderer";
import { NewsDebateCard } from "./NewsDebateCard";
import { TypingIndicator } from "./TypingIndicator";

export interface StreamHandle {
  scrollToLatest: () => void;
}

interface StreamProps {
  entries: StreamEntry[];
  typingAgent: AgentId | null;
  pool?: CoinPoolPayload;
  emptyLabel?: string;
  locale?: AgentWatchLocale;
  newsDebateLabels: Dict["agentWatch"]["newsDebate"];
}

function StreamEntryView({
  entry,
  pool,
  locale = "zh_CN",
  newsDebateLabels,
}: {
  entry: StreamEntry;
  pool?: CoinPoolPayload;
  locale?: AgentWatchLocale;
  newsDebateLabels: Dict["agentWatch"]["newsDebate"];
}) {
  if (entry.kind === "news_debate") {
    return <NewsDebateCard debate={entry.debate} labels={newsDebateLabels} />;
  }

  if (entry.kind === "chat_thread") {
    return <ChatThreadRenderer thread={entry.thread} labels={newsDebateLabels} />;
  }

  const messages = buildStreamChatMessages(entry, pool, locale);

  return (
    <div className="space-y-3 py-1">
      {messages.map((message) => (
        <AgentChatBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

function streamEntryScrollKey(entry: StreamEntry) {
  if (entry.kind === "chat_thread") {
    const lastMessage = entry.thread.messages[entry.thread.messages.length - 1];
    return `${entry.id}:${entry.thread.messages.length}:${lastMessage?.id ?? "empty"}:${entry.thread.strategy?.id ?? "no-strategy"}`;
  }
  if (entry.kind === "news_debate") {
    const messages = entry.debate.chatThread.messages;
    const lastMessage = messages[messages.length - 1];
    return `${entry.id}:${messages.length}:${lastMessage?.id ?? "empty"}:${entry.debate.chatThread.strategy?.id ?? "no-strategy"}`;
  }
  return entry.id;
}

export const Stream = forwardRef<StreamHandle, StreamProps>(function Stream(
  { entries, typingAgent, pool, emptyLabel, locale = "zh_CN", newsDebateLabels },
  forwardedRef,
) {
  const scrollRef = useRef<ChatScrollContainerHandle>(null);
  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] duplicate stream entry id in render", entry.id);
      }
      return false;
    });
  }, [entries]);
  const scrollDependencyKey = `${uniqueEntries.map(streamEntryScrollKey).join("|")}:${typingAgent ?? "idle"}`;

  useImperativeHandle(forwardedRef, () => ({
    scrollToLatest: () => scrollRef.current?.scrollToBottom("smooth"),
  }));

  return (
    <ChatScrollContainer
      ref={scrollRef}
      dependencyKey={scrollDependencyKey}
      newMessagesLabel={locale === "en_US" ? "New discussion" : "有新讨论"}
      className="min-h-[560px] w-full rounded-2xl border border-white/10 bg-[#111]"
      contentClassName="h-[560px] overflow-y-auto px-4 py-4 md:px-6"
    >
      {uniqueEntries.length === 0 && !typingAgent && (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          {emptyLabel ?? "等待 Agent 开口..."}
        </div>
      )}

      <AnimatePresence initial={false}>
        {uniqueEntries.map((entry) => (
          <StreamEntryView
            key={entry.id}
            entry={entry}
            pool={pool}
            locale={locale}
            newsDebateLabels={newsDebateLabels}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {typingAgent && (
          <TypingIndicator key={`typing-${typingAgent}`} agentId={typingAgent} locale={locale} />
        )}
      </AnimatePresence>
    </ChatScrollContainer>
  );
});
