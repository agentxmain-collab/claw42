"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Fragment, useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { ChatMessage } from "@/lib/types";
import { getFaction } from "@/lib/factionRegistry";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

const MERGE_WINDOW_MS = 10_000;

function dataAgeLabel(fetchedAt: number | undefined, now: number, locale: string) {
  if (!fetchedAt) return null;
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  return locale === "en_US" ? `data ${seconds}s ago` : `数据 ${seconds} 秒前`;
}

function shouldMergeWithPrevious(message: ChatMessage, previous?: ChatMessage) {
  if (!previous) return false;
  if (previous.threadId !== message.threadId) return false;
  if (previous.agentId !== message.agentId) return false;
  const delta = message.ts - previous.ts;
  return delta >= 0 && delta <= MERGE_WINDOW_MS;
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

function renderMentionHighlights(content: string, mentioning?: ChatMessage["agentId"]) {
  if (!mentioning) return content;
  const faction = getFaction(mentioning);
  const token = AGENT_COLOR_TOKEN[mentioning];
  const aliases = [
    AGENT_META[mentioning].name,
    faction.nickname,
    faction.nickname.replace(/\s+/g, ""),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const escaped = aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(@?(?:${escaped.join("|")}))`, "g");
  const parts = content.split(pattern).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        const normalized = part.replace(/^@/, "").replace(/\s+/g, "");
        const isMention = aliases.some((alias) => alias.replace(/\s+/g, "") === normalized);
        if (!isMention) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
        return (
          <span key={`${part}-${index}`} className="font-black" style={{ color: token.primary }}>
            @{part.replace(/^@/, "")}
          </span>
        );
      })}
    </>
  );
}

export function ChatMessageBubble({
  message,
  history,
  previousMessage,
}: {
  message: ChatMessage;
  history: ChatMessage[];
  previousMessage?: ChatMessage;
}) {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const isMerged = shouldMergeWithPrevious(message, previousMessage);
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
      {isMerged ? (
        <div className="w-12 shrink-0" aria-hidden="true" />
      ) : (
        <AgentAvatar agentId={message.agentId} size="typing" className="mt-6" />
      )}
      <div className="min-w-0 max-w-[min(100%,940px)]">
        {!isMerged && (
          <div className="flex min-h-5 flex-wrap items-center gap-2 px-1">
            <span className="text-sm font-bold" style={{ color: token.primary }}>
              {meta.name}
            </span>
            {message.mentioning && <MentionBadge agentId={message.mentioning} />}
            <span className="font-mono text-xs text-white/35">
              {formatAgentMessageTime(message.ts, locale)}
            </span>
            {age && <span className="text-xs font-semibold text-emerald-300/70">{age}</span>}
          </div>
        )}

        <div
          className={`relative mt-1 rounded-2xl border bg-[#111114]/95 px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur ${
            isMerged ? "rounded-tl-xl" : "rounded-tl-md"
          }`}
          style={{ borderColor: token.soft }}
        >
          {!isMerged && (
            <span
              aria-hidden="true"
              className="absolute -left-[5px] top-5 h-3 w-3 rotate-45 border-b border-l bg-[#111114]"
              style={{ borderColor: token.soft }}
            />
          )}
          {isMerged && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {message.mentioning && <MentionBadge agentId={message.mentioning} />}
              <span className="font-mono text-xs text-white/30">
                {formatAgentMessageTime(message.ts, locale)}
              </span>
            </div>
          )}
          {cited && (
            <div className="text-white/48 mb-2 border-l-2 border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-relaxed">
              <span className="mr-1 text-white/30">↘</span>
              {AGENT_META[cited.agentId].name}：{message.citedQuote || cited.content.slice(0, 42)}
            </div>
          )}
          <p className="text-white/88 text-sm font-semibold leading-relaxed">
            {renderMentionHighlights(message.content, message.mentioning)}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
