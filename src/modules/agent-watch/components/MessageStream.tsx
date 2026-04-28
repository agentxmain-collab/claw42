"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { AgentId, AgentWatchMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export function MessageStream({
  messages,
  typingAgent,
}: {
  messages: AgentWatchMessage[];
  typingAgent: AgentId | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typingAgent, autoScroll]);

  return (
    <div className="card-glow relative min-h-[560px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (!el) return;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
        }}
        className="h-[560px] overflow-y-auto px-4 py-4 md:px-6"
      >
        {messages.length === 0 && !typingAgent && (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            等待 Agent 开口...
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
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
            ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#7c5cff] px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          回到最新
        </button>
      )}
    </div>
  );
}
