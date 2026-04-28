"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentWatchMessage } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

export function MessageBubble({ message }: { message: AgentWatchMessage }) {
  const { locale } = useI18n();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const timeLabel = formatAgentMessageTime(message.timestamp, locale);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="flex gap-3 py-2"
    >
      <AgentAvatar agentId={message.agentId} size="message" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{meta.name}</span>
          <span className="rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/12 px-2 py-0.5 text-[10px] font-semibold text-[#b49cff]">
            LIVE
          </span>
          <span className="font-mono text-[11px] text-white/35">{timeLabel}</span>
        </div>
        <div
          className="mt-1.5 rounded-2xl rounded-tl-sm border border-l-2 bg-black/35 px-4 py-3 transition-shadow"
          style={{
            borderColor: token.soft,
            borderLeftColor: token.primary,
            boxShadow: `0 0 0 1px ${token.soft}, 0 8px 24px ${token.glow}`,
          }}
        >
          <p className="text-sm leading-relaxed text-white/82">{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}
