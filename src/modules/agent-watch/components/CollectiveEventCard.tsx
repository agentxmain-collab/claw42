"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { CollectiveEvent, StreamResponse } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

const SIGNAL_LABEL: Record<CollectiveEvent["signalType"], string> = {
  volume_spike: "放量",
  near_high: "近高",
  near_low: "近低",
  breakout: "突破",
  ema_cross: "EMA",
  range_change: "异动",
};

function ResponseRow({ response }: { response: StreamResponse }) {
  const meta = AGENT_META[response.agentId];
  const token = AGENT_COLOR_TOKEN[response.agentId];

  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2">
      <AgentAvatar agentId={response.agentId} size="typing" className="mt-0.5" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white" style={{ color: token.primary }}>
          {meta.name}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/76">{response.content}</p>
      </div>
    </div>
  );
}

export function CollectiveEventCard({ event }: { event: CollectiveEvent }) {
  const { locale } = useI18n();
  const timeLabel = formatAgentMessageTime(event.ts, locale);
  const directionClass = event.direction === "up" ? "text-[#27d980]" : "text-[#ff5f5f]";
  const responses = [event.primaryResponse, ...event.echoResponses].filter(
    (response) => response.content.trim().length > 0,
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/82">
          集体信号
        </span>
        <span className={`text-xs font-semibold ${directionClass}`}>
          {event.direction === "up" ? "同步向上" : "同步向下"}
        </span>
        <span className="font-mono text-xs text-white/35">{timeLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {event.symbols.map((symbol) => (
          <span
            key={symbol}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs font-semibold text-white"
          >
            {symbol}
          </span>
        ))}
        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/62">
          {SIGNAL_LABEL[event.signalType]}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/76">{event.description}</p>

      {responses.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {responses.map((response) => (
            <ResponseRow key={response.agentId} response={response} />
          ))}
        </div>
      )}
    </motion.article>
  );
}
