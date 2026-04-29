"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { FocusEvent } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

const SIGNAL_LABEL: Record<FocusEvent["signalType"], string> = {
  volume_spike: "放量异动",
  near_high: "接近近期高位",
  near_low: "接近近期低位",
  breakout: "突破信号",
  ema_cross: "EMA 共振",
  range_change: "波动区间变化",
};

export function FocusEventCard({ event }: { event: FocusEvent }) {
  const { locale } = useI18n();
  const timeLabel = formatAgentMessageTime(event.ts, locale);
  const agentId = event.primaryResponse.agentId;
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="rounded-2xl border border-[#ff5f5f]/25 bg-[#ff5f5f]/[0.055] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#ff5f5f]/25 bg-[#ff5f5f]/10 px-2 py-1 text-xs font-semibold text-[#ffb4b4]">
          高优信号
        </span>
        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs font-semibold text-white">
          {event.symbol}
        </span>
        <span className="text-xs text-white/55">{SIGNAL_LABEL[event.signalType]}</span>
        <span className="font-mono text-xs text-white/35">{timeLabel}</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/80">{event.description}</p>

      {event.primaryResponse.content.trim().length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.08] bg-black/28 px-3 py-2">
          <AgentAvatar agentId={agentId} size="typing" className="mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-semibold" style={{ color: token.primary }}>
              {meta.name}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/76">
              {event.primaryResponse.content}
            </p>
          </div>
        </div>
      )}
    </motion.article>
  );
}
