"use client";

import { motion } from "framer-motion";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { WatchUpdateEntry } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { formatCoinSymbol } from "../utils/symbolFormat";
import { useI18n } from "@/i18n/I18nProvider";

const UPDATE_LABEL: Record<WatchUpdateEntry["updateType"], string> = {
  market_digest: "市场摘要",
  focus_update: "关注变化",
  condition_update: "等待条件",
  quiet_observation: "观察状态",
};

const UPDATE_STYLE: Record<WatchUpdateEntry["updateType"], string> = {
  market_digest: "border-[#3a7bff]/22 bg-[#3a7bff]/[0.045]",
  focus_update: "border-[#965eff]/22 bg-[#965eff]/[0.045]",
  condition_update: "border-white/[0.09] bg-white/[0.035]",
  quiet_observation: "border-white/[0.07] bg-black/20",
};

export function WatchUpdateCard({ entry }: { entry: WatchUpdateEntry }) {
  const { locale } = useI18n();
  const timeLabel = formatAgentMessageTime(entry.ts, locale);
  const agent = entry.agentId ? AGENT_META[entry.agentId] : null;
  const token = entry.agentId ? AGENT_COLOR_TOKEN[entry.agentId] : null;
  const symbols = entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className={`animate-stream-in rounded-2xl border p-4 ${UPDATE_STYLE[entry.updateType]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-1 text-xs font-semibold text-white/72">
          {UPDATE_LABEL[entry.updateType]}
        </span>
        {agent && (
          <span
            className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-xs font-semibold"
            style={{ color: token?.primary }}
          >
            {agent.name}
          </span>
        )}
        {symbols.slice(0, 3).map((symbol) => (
          <span
            key={symbol}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs font-semibold text-white/80"
          >
            {formatCoinSymbol(symbol)}
          </span>
        ))}
        <span className="font-mono text-xs text-white/35">{timeLabel}</span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-relaxed text-white/78">{entry.content}</p>
    </motion.article>
  );
}
