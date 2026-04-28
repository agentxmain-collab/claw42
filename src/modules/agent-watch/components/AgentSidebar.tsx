"use client";

import { AGENT_META, AGENT_ORDER } from "../agents";
import type { AgentId, AgentStatus } from "../types";
import { AgentAvatar } from "./AgentAvatar";

function StatusDot({ status }: { status: AgentStatus }) {
  const cls =
    status === "thinking"
      ? "bg-amber-400 animate-pulse"
      : status === "speaking"
        ? "animate-pulse bg-[#b49cff] shadow-[0_0_8px_rgba(124,92,255,0.6)]"
        : "bg-white/20";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

export function AgentSidebar({
  activeAgent,
  speakingAgent,
  labels,
}: {
  activeAgent: AgentId | null;
  speakingAgent: AgentId | null;
  labels: { thinking: string; speaking: string; idle: string };
}) {
  return (
    <aside className="grid gap-3 md:w-72 md:shrink-0">
      {AGENT_ORDER.map((id) => {
        const meta = AGENT_META[id];
        const status: AgentStatus =
          activeAgent === id ? "thinking" : speakingAgent === id ? "speaking" : "idle";
        const label =
          status === "thinking"
            ? labels.thinking
            : status === "speaking"
              ? labels.speaking
              : labels.idle;

        return (
          <div
            key={id}
            className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0e0e10] p-4 transition-colors hover:bg-white/[0.03]"
          >
            <AgentAvatar agentId={id} size="sidebar" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-white">{meta.name}</span>
                <StatusDot status={status} />
              </div>
              <p className="mt-1 text-xs leading-snug text-white/50">{meta.tagline}</p>
              <p className="mt-2 text-[11px] font-medium text-white/35">{label}</p>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
