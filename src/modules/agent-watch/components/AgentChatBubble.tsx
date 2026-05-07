"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentChatMessage } from "../utils/streamChatMessages";
import { formatAgentMessageTime } from "../utils/formatTime";
import { formatCoinSymbol } from "../utils/symbolFormat";
import { AgentAvatar } from "./AgentAvatar";

export function AgentChatBubble({ message }: { message: AgentChatMessage }) {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const timeLabel = formatAgentMessageTime(message.ts, locale);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!message.marketDataFetchedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [message.marketDataFetchedAt]);

  const dataAgeLabel = message.marketDataFetchedAt
    ? locale === "en_US"
      ? `data ${Math.max(0, Math.round((now - message.marketDataFetchedAt) / 1000))}s ago`
      : `数据 ${Math.max(0, Math.round((now - message.marketDataFetchedAt) / 1000))} 秒前`
    : null;

  return (
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
      transition={
        reduceMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 420, damping: 28, mass: 0.8 }
      }
      className="flex origin-top-left items-start gap-3 py-1"
    >
      <AgentAvatar agentId={message.agentId} size="typing" className="mt-5" />
      <div className="min-w-0 max-w-[min(100%,980px)]">
        <div className="flex min-h-5 flex-wrap items-center gap-2 px-1">
          <span className="text-sm font-bold" style={{ color: token.primary }}>
            {meta.name}
          </span>
          {message.symbols.slice(0, 3).map((symbol) => (
            <span
              key={symbol}
              className="text-white/72 rounded-md border border-white/10 bg-white/[0.045] px-2 py-0.5 font-mono text-[11px] font-semibold leading-none"
            >
              {formatCoinSymbol(symbol)}
            </span>
          ))}
          <span className="font-mono text-xs text-white/35">{timeLabel}</span>
          {dataAgeLabel && (
            <span className="text-xs font-semibold text-emerald-300/70">{dataAgeLabel}</span>
          )}
        </div>

        <div
          className="bg-[#19191c]/92 relative mt-1 rounded-2xl rounded-tl-md border px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur"
          style={{ borderColor: token.soft }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-4 h-3 w-3 rotate-45 border-b border-l bg-[#19191c]"
            style={{ borderColor: token.soft }}
          />

          <p className="text-white/86 text-sm font-semibold leading-relaxed">{message.content}</p>
        </div>
      </div>
    </motion.article>
  );
}
