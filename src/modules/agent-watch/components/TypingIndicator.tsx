"use client";

import { AGENT_META } from "../agents";
import type { AgentId } from "../types";
import { AgentAvatar } from "./AgentAvatar";

export function TypingIndicator({ agentId }: { agentId: AgentId }) {
  const meta = AGENT_META[agentId];

  return (
    <div className="flex items-center gap-3 py-2">
      <AgentAvatar agentId={agentId} size="typing" />
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45" />
      </div>
      <span className="text-xs text-white/35">{meta.name} 正在思考...</span>
    </div>
  );
}
