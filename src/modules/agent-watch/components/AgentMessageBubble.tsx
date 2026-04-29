"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentMessage } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

export function AgentMessageBubble({ message }: { message: AgentMessage }) {
  const { locale } = useI18n();
  const meta = AGENT_META[message.agentId];
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const timeLabel = formatAgentMessageTime(message.ts, locale);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="flex gap-2 py-2"
    >
      <AgentAvatar agentId={message.agentId} size="message" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{meta.name}</span>
          <span className="font-mono text-xs text-white/35">{timeLabel}</span>
        </div>
        <div
          className="mt-1.5 rounded-2xl rounded-tl-sm border border-l-2 border-white/[0.08] bg-black/30 px-4 py-3"
          style={{
            borderLeftColor: token.primary,
          }}
        >
          <p className="text-sm leading-relaxed text-white/82">{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}
