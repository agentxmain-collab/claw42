"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_META } from "../agents";
import type { AgentWatchMessage } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

export function MessageBubble({ message }: { message: AgentWatchMessage }) {
  const { locale } = useI18n();
  const [liked, setLiked] = useState(false);
  const meta = AGENT_META[message.agentId];
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
        <div className="mt-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-black/35 px-4 py-3 transition-shadow hover:shadow-[0_0_24px_rgba(124,92,255,0.18)]">
          <p className="text-sm leading-relaxed text-white/82">{message.content}</p>
        </div>
        <button
          type="button"
          onClick={() => setLiked((next) => !next)}
          className={`mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
            liked
              ? "border-[#ff5f5f]/50 bg-[#ff5f5f]/15 text-[#ff9a9a]"
              : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70"
          }`}
        >
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
          <span>{liked ? 43 : 42}</span>
        </button>
      </div>
    </motion.div>
  );
}
