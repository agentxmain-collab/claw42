"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { actionEmoji } from "@/lib/chatActions";
import { trackEvent } from "@/lib/analytics";
import type { ChatMessage } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

function dataAgeLabel(fetchedAt: number | undefined, now: number, locale: string) {
  if (!fetchedAt) return null;
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  return locale === "en_US" ? `data ${seconds}s ago` : `数据 ${seconds} 秒前`;
}

function MentionBadge({ agentId }: { agentId: ChatMessage["agentId"] }) {
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none"
      style={{ borderColor: token.soft, color: token.primary, backgroundColor: token.soft }}
    >
      @{meta.name}
    </span>
  );
}

export function ChatMessageBubble({
  message,
  history,
}: {
  message: ChatMessage;
  history: ChatMessage[];
}) {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const [now, setNow] = useState(Date.now());
  const cited = useMemo(
    () => history.find((item) => item.id === message.replyTo),
    [history, message.replyTo],
  );

  useEffect(() => {
    if (!message.marketDataFetchedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [message.marketDataFetchedAt]);

  useEffect(() => {
    trackEvent("chat_message_action", {
      message_id: message.id,
      thread_id: message.threadId,
      agent_id: message.agentId,
      action: message.action,
      expects_reply: message.expectsReply,
    });
  }, [message.action, message.agentId, message.expectsReply, message.id, message.threadId]);

  const age = dataAgeLabel(message.marketDataFetchedAt, now, locale);

  return (
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 360, damping: 26, mass: 0.8 }
      }
      className="flex items-start gap-3 py-1.5"
    >
      <AgentAvatar agentId={message.agentId} size="typing" className="mt-6" />
      <div className="min-w-0 max-w-[min(100%,940px)]">
        <div className="flex min-h-5 flex-wrap items-center gap-2 px-1">
          <span className="text-sm font-bold" style={{ color: token.primary }}>
            {meta.name}
          </span>
          {message.mentioning && <MentionBadge agentId={message.mentioning} />}
          <span
            className="rounded-md border px-1.5 py-0.5 text-[11px] font-bold leading-none"
            style={{ borderColor: token.soft, color: token.primary, backgroundColor: token.soft }}
          >
            {message.action}
          </span>
          <span className="font-mono text-xs text-white/35">
            {formatAgentMessageTime(message.ts, locale)}
          </span>
          {age && <span className="text-xs font-semibold text-emerald-300/70">{age}</span>}
        </div>

        <div
          className="relative mt-1 rounded-2xl rounded-tl-md border bg-[#111114]/95 px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur"
          style={{ borderColor: token.soft }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-5 h-3 w-3 rotate-45 border-b border-l bg-[#111114]"
            style={{ borderColor: token.soft }}
          />
          {cited && (
            <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-relaxed text-white/45">
              ↘ {AGENT_META[cited.agentId].name}：
              {message.citedQuote || cited.content.slice(0, 42)}
            </div>
          )}
          <p className="text-white/88 text-sm font-semibold leading-relaxed">
            <span className="mr-1.5" style={{ color: token.primary }}>
              {actionEmoji(message.action)}
            </span>
            {message.content}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
