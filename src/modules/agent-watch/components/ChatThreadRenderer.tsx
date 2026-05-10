"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import type { ChatMessage, ChatThread, NewsDebate } from "@/lib/types";
import { resolveAgentWatchLocale } from "../locale";
import type { AgentId } from "../types";
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

function DevChatLine({ message }: { message: ChatMessage }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/45">
        <span>{message.agentId}</span>
        {message.mentioning && <span>@{message.mentioning}</span>}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-white/75">{message.content}</p>
    </div>
  );
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
  const threadMessagesRef = useRef(thread.messages);
  const visibleCountRef = useRef(visibleCount);
  const threadIdRef = useRef(thread.id);
  const messageKey = thread.messages.map((message) => message.id).join("|");

  useEffect(() => {
    threadMessagesRef.current = thread.messages;
  }, [messageKey, thread.messages]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    trackEvent("chat_thread_view", {
      thread_id: thread.id,
      seed_type: thread.seed.type,
      message_count: thread.messages.length,
    });
  }, [thread.id, thread.messages.length, thread.seed.type]);

  useEffect(() => {
    const threadMessages = threadMessagesRef.current;

    if (!staged) {
      setVisibleCount(threadMessages.length);
      visibleCountRef.current = threadMessages.length;
      setTypingAgent(null);
      return;
    }

    const timers: number[] = [];
    const isNewThread = threadIdRef.current !== thread.id;
    if (isNewThread) {
      threadIdRef.current = thread.id;
      visibleCountRef.current = 0;
      setVisibleCount(0);
    }

    const startIndex = isNewThread ? 0 : Math.min(visibleCountRef.current, threadMessages.length);

    if (startIndex >= threadMessages.length) {
      setVisibleCount(threadMessages.length);
      visibleCountRef.current = threadMessages.length;
      setTypingAgent(null);
      return;
    }

    let cursor = 0;
    setTypingAgent(null);

    threadMessages.slice(startIndex).forEach((message, offset) => {
      const index = startIndex + offset;
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
          visibleCountRef.current = index + 1;
          setVisibleCount(index + 1);
        }, cursor),
      );
      cursor += afterGap;
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [messageKey, staged, thread.id]);

  const threadMessages = thread.messages;

  const visibleMessages = staged ? threadMessages.slice(0, visibleCount) : threadMessages;

  return (
    <section className="space-y-2">
      <SeedChip thread={thread} />
      {visibleMessages.map((message, index) => (
        <DevChatLine key={`${message.id}-${index}`} message={message} />
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
