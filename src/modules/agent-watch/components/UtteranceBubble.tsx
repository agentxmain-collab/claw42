"use client";

import { motion } from "framer-motion";
import { getFaction } from "@/lib/factionRegistry";
import type { Utterance } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

const PREFIX_LABEL: Record<Exclude<Utterance["prefix"], null>, string> = {
  rebut: "怒怼",
  taunt: "阴阳",
  sneer: "嘲讽",
  mock: "反呛",
  cool: "冷怼",
  remind: "提点",
  agree: "附和",
  reflect: "反思",
};

export function UtteranceBubble({ utterance }: { utterance: Utterance }) {
  const faction = getFaction(utterance.agentId);
  const cited = utterance.citedAgentId ? getFaction(utterance.citedAgentId) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24 }}
      className="flex gap-2.5"
    >
      <AgentAvatar agentId={utterance.agentId} size="message" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold" style={{ color: faction.color }}>
            {faction.displayName}
          </span>
          <span className="text-white/35">{faction.title}</span>
        </div>
        <div
          className={`mt-1 rounded-2xl border bg-black/35 px-3 py-2 text-sm leading-relaxed shadow-[0_14px_34px_rgba(0,0,0,0.24)] ${
            utterance.isGoldenLine
              ? "border-amber-300/60 text-amber-100"
              : "text-white/84 border-white/10"
          }`}
          style={{ borderLeftColor: faction.color, borderLeftWidth: 3 }}
        >
          <span className="mr-1">{utterance.emoji}</span>
          {utterance.prefix && (
            <span className="mr-1 text-white/50">
              {faction.nickname} {PREFIX_LABEL[utterance.prefix]}
              {cited ? ` ${cited.nickname}` : ""}：
            </span>
          )}
          <span>{utterance.isGoldenLine ? `“${utterance.content}”` : utterance.content}</span>
          {utterance.citedQuote && (
            <div className="text-white/38 mt-2 border-t border-white/10 pt-1.5 text-xs">
              “{utterance.citedQuote}”
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
