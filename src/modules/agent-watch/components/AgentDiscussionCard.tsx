"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentDiscussionEntry } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { formatCoinSymbol } from "../utils/symbolFormat";
import { AgentAvatar } from "./AgentAvatar";

export function AgentDiscussionCard({ entry }: { entry: AgentDiscussionEntry }) {
  const { locale } = useI18n();
  const timeLabel = formatAgentMessageTime(entry.ts, locale);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="animate-stream-in rounded-2xl border border-[#7c5cff]/20 bg-[#0f0f15] p-4 shadow-[0_0_30px_rgba(124,92,255,0.08)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#7c5cff]/25 bg-[#7c5cff]/10 px-2 py-1 text-xs font-semibold text-[#c8b7ff]">
          三方会诊
        </span>
        {entry.symbols.slice(0, 3).map((symbol) => (
          <span
            key={symbol}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs font-semibold text-white/80"
          >
            {formatCoinSymbol(symbol)}
          </span>
        ))}
        <span className="font-mono text-xs text-white/35">{timeLabel}</span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-relaxed text-white/72">{entry.summary}</p>

      <div className="mt-4 grid gap-3">
        {entry.responses.map((response) => {
          const meta = AGENT_META[response.agentId];
          const token = AGENT_COLOR_TOKEN[response.agentId];
          return (
            <div
              key={response.agentId}
              className="flex gap-3 rounded-xl border bg-black/20 p-3"
              style={{
                borderColor: token.soft,
                boxShadow: `inset 3px 0 0 ${token.primary}`,
              }}
            >
              <AgentAvatar agentId={response.agentId} size="message" className="mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-bold" style={{ color: token.primary }}>
                  {meta.name}
                </div>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-white/82">
                  {response.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}
