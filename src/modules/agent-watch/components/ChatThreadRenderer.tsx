"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import type { ChatThread, NewsDebate } from "@/lib/types";
import { resolveAgentWatchLocale } from "../locale";
import type { AgentId } from "../types";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { FinalStrategyBlock } from "./FinalStrategyBlock";
import { InsufficientConsensus } from "./InsufficientConsensus";
import { SeedChip } from "./SeedChip";
import { TypingIndicator } from "./TypingIndicator";

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function boundedDelay(key: string, min: number, max: number) {
  return min + (hashString(key) % (max - min + 1));
}

export function ChatThreadRenderer({
  thread,
  debate,
  labels,
  staged = true,
}: {
  thread: ChatThread;
  debate?: NewsDebate;
  labels: Dict["agentWatch"]["newsDebate"];
  staged?: boolean;
}) {
  const { locale } = useI18n();
  const agentWatchLocale = resolveAgentWatchLocale(locale);
  const [visibleCount, setVisibleCount] = useState(staged ? 0 : thread.messages.length);
  const [typingAgent, setTypingAgent] = useState<AgentId | null>(null);
  const threadMessages = thread.messages;

  useEffect(() => {
    trackEvent("chat_thread_view", {
      thread_id: thread.id,
      seed_type: thread.seed.type,
      message_count: thread.messages.length,
    });
  }, [thread.id, thread.messages.length, thread.seed.type]);

  useEffect(() => {
    if (!staged) {
      setVisibleCount(threadMessages.length);
      setTypingAgent(null);
      return;
    }

    const timers: number[] = [];
    let cursor = 0;
    setVisibleCount(0);
    setTypingAgent(null);

    threadMessages.forEach((message, index) => {
      const thinkDuration = boundedDelay(`${thread.id}:${message.id}:think`, 1700, 3400);
      const afterGap = boundedDelay(`${thread.id}:${message.id}:gap`, 650, 1300);
      timers.push(
        window.setTimeout(() => {
          setTypingAgent(message.agentId as AgentId);
        }, cursor),
      );
      cursor += thinkDuration;
      timers.push(
        window.setTimeout(() => {
          setTypingAgent(null);
          setVisibleCount(index + 1);
        }, cursor),
      );
      cursor += afterGap;
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [staged, thread.id, threadMessages]);

  const visibleMessages = staged ? threadMessages.slice(0, visibleCount) : threadMessages;

  return (
    <section className="space-y-2">
      <SeedChip thread={thread} />
      {visibleMessages.map((message, index) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          previousMessage={visibleMessages[index - 1]}
          history={visibleMessages}
        />
      ))}
      {typingAgent && <TypingIndicator agentId={typingAgent} locale={agentWatchLocale} />}

      {debate &&
        visibleCount >= threadMessages.length &&
        (thread.strategy ? (
          <FinalStrategyBlock strategy={thread.strategy} labels={labels} />
        ) : (
          <InsufficientConsensus debate={debate} labels={labels} />
        ))}
    </section>
  );
}
