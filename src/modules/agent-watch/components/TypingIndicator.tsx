"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AGENT_META } from "../agents";
import type { AgentId } from "../types";
import type { AgentWatchLocale } from "../locale";
import { AgentAvatar } from "./AgentAvatar";

export function TypingIndicator({
  agentId,
  locale = "zh_CN",
}: {
  agentId: AgentId;
  locale?: AgentWatchLocale;
}) {
  const reduceMotion = useReducedMotion();
  const meta = AGENT_META[agentId];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
      transition={
        reduceMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 360, damping: 30, mass: 0.8 }
      }
      className="flex origin-top-left items-start gap-3 py-1"
    >
      <AgentAvatar agentId={agentId} size="typing" className="mt-5 opacity-70" />
      <div className="min-w-0">
        <div className="min-h-5 px-1 text-sm font-bold text-white/45">{meta.name}</div>
        <div className="bg-[#19191c]/92 text-white/42 relative mt-1 inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-white/10 px-4 py-3 text-xs shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-4 h-3 w-3 rotate-45 border-b border-l border-white/10 bg-[#19191c]"
          />
          <span>{locale === "en_US" ? `${meta.name} is thinking` : `${meta.name} 正在思考`}</span>
          <span className="flex items-center gap-1">
            <span className="animate-typing-dot-1 h-1 w-1 rounded-full bg-white/45" />
            <span className="animate-typing-dot-2 h-1 w-1 rounded-full bg-white/45" />
            <span className="animate-typing-dot-3 h-1 w-1 rounded-full bg-white/45" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
