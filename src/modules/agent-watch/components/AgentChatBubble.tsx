"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentChatMessage } from "../utils/streamChatMessages";
import { formatAgentMessageTime } from "../utils/formatTime";
import { formatCoinSymbol } from "../utils/symbolFormat";
import { AgentAvatar } from "./AgentAvatar";

export function AgentChatBubble({ message }: { message: AgentChatMessage }) {
  const { locale } = useI18n();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const timeLabel = formatAgentMessageTime(message.ts, locale);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="animate-stream-in flex gap-3 rounded-2xl border bg-black/22 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)]"
      style={{
        borderColor: token.soft,
        boxShadow: `inset 3px 0 0 ${token.primary}, 0 18px 42px rgba(0,0,0,0.18)`,
      }}
    >
      <AgentAvatar agentId={message.agentId} size="typing" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold" style={{ color: token.primary }}>
            {meta.name}
          </span>
          {message.tag && (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                borderColor: token.soft,
                color: token.primary,
                backgroundColor: token.soft,
              }}
            >
              {message.tag}
            </span>
          )}
          {message.symbols.slice(0, 3).map((symbol) => (
            <span
              key={symbol}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-white/78"
            >
              {formatCoinSymbol(symbol)}
            </span>
          ))}
          <span className="font-mono text-xs text-white/35">{timeLabel}</span>
        </div>

        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/84">
          {message.content}
        </p>

        {message.points.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {message.points.map((point) => (
              <div
                key={`${point.label}-${point.value}`}
                className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2"
              >
                <div className="text-[11px] font-semibold text-white/42">{point.label}</div>
                <div className="mt-0.5 font-mono text-xs font-semibold text-white/78">
                  {point.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
