"use client";

import { AGENT_META } from "../agents";
import type { AgentId } from "../types";
import { AgentAvatar } from "./AgentAvatar";

export function TypingIndicator({ agentId }: { agentId: AgentId }) {
  const meta = AGENT_META[agentId];

  return (
    <div className="flex items-center gap-2 py-2 text-xs text-white/40">
      <AgentAvatar agentId={agentId} size="message" className="opacity-60" />
      <span>{meta.name} 正在思考</span>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5">
        <span className="h-1 w-1 animate-typing-dot-1 rounded-full bg-white/45" />
        <span className="h-1 w-1 animate-typing-dot-2 rounded-full bg-white/45" />
        <span className="h-1 w-1 animate-typing-dot-3 rounded-full bg-white/45" />
      </div>
    </div>
  );
}
