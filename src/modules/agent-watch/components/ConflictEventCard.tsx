"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { ConflictEvent, StreamResponse } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { formatCoinSymbol, prefixLeadingCoinSymbol } from "../utils/symbolFormat";
import { AgentAvatar } from "./AgentAvatar";

function ResponsePanel({
  response,
  symbol,
}: {
  response: StreamResponse;
  symbol: string;
}) {
  const meta = AGENT_META[response.agentId];
  const token = AGENT_COLOR_TOKEN[response.agentId];

  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-black/28 px-3 py-2">
      <AgentAvatar agentId={response.agentId} size="typing" className="mt-0.5" />
      <div className="min-w-0">
        <div className="text-xs font-semibold" style={{ color: token.primary }}>
          {meta.name}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/76">
          {prefixLeadingCoinSymbol(response.content, symbol)}
        </p>
      </div>
    </div>
  );
}

export function ConflictEventCard({ event }: { event: ConflictEvent }) {
  const { locale } = useI18n();
  const timeLabel = formatAgentMessageTime(event.ts, locale);
  const responses = event.responses.filter((response) => response.content.trim().length > 0);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="animate-stream-in rounded-2xl border border-[#f5c84b]/25 bg-[#f5c84b]/[0.055] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#f5c84b]/25 bg-[#f5c84b]/10 px-2 py-1 text-xs font-semibold text-[#ffe08a]">
          观点分歧
        </span>
        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs font-semibold text-white">
          {formatCoinSymbol(event.symbol)}
        </span>
        <span className="font-mono text-xs text-white/35">{timeLabel}</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/78">
        {prefixLeadingCoinSymbol(event.description, event.symbol)}
      </p>

      {responses.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {responses.map((response) => (
            <ResponsePanel key={response.agentId} response={response} symbol={event.symbol} />
          ))}
        </div>
      )}
    </motion.article>
  );
}
