"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { AgentId, AgentWatchMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export interface MessageStreamHandle {
  scrollToLatest: () => void;
}

interface MessageStreamProps {
  messages: AgentWatchMessage[];
  typingAgent: AgentId | null;
  emptyLabel?: string;
}

export const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(function MessageStream(
  { messages, typingAgent, emptyLabel },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((message) => {
      if (!seen.has(message.id)) {
        seen.add(message.id);
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] duplicate message id in stream render", message.id);
      }
      return false;
    });
  }, [messages]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [uniqueMessages, typingAgent, autoScroll]);

  useImperativeHandle(forwardedRef, () => ({
    scrollToLatest: () => {
      const el = containerRef.current;
      if (!el) return;
      setAutoScroll(true);
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    },
  }));

  return (
    <div className="card-glow relative min-h-[560px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
      <div
        ref={containerRef}
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
        }}
        className="h-[560px] overflow-y-auto px-4 py-4 md:px-6"
      >
        {uniqueMessages.length === 0 && !typingAgent && (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            {emptyLabel ?? "等待 Agent 开口..."}
          </div>
        )}

        <AnimatePresence initial={false}>
          {uniqueMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {typingAgent && <TypingIndicator agentId={typingAgent} />}
      </div>

      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#7c5cff] px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          回到最新
        </button>
      )}
    </div>
  );
});
