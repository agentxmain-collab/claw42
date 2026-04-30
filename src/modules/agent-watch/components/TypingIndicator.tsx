"use client";

import { AGENT_META } from "../agents";
import type { AgentId } from "../types";
import { AgentAvatar } from "./AgentAvatar";

export function TypingIndicator({ agentId }: { agentId: AgentId }) {
  const meta = AGENT_META[agentId];

  return (
    <div className="flex items-start gap-3 py-1">
      <AgentAvatar agentId={agentId} size="typing" className="mt-5 opacity-70" />
      <div className="min-w-0">
        <div className="min-h-5 px-1 text-sm font-bold text-white/45">{meta.name}</div>
        <div className="relative mt-1 inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-white/10 bg-[#19191c]/92 px-4 py-3 text-xs text-white/42 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-4 h-3 w-3 rotate-45 border-b border-l border-white/10 bg-[#19191c]"
          />
          <span>{meta.name} 正在思考</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 animate-typing-dot-1 rounded-full bg-white/45" />
            <span className="h-1 w-1 animate-typing-dot-2 rounded-full bg-white/45" />
            <span className="h-1 w-1 animate-typing-dot-3 rounded-full bg-white/45" />
          </span>
        </div>
      </div>
    </div>
  );
}
