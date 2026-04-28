"use client";

import { AGENT_META, AGENT_ORDER } from "../agents";
import type { AgentId, AgentStatus } from "../types";

function StatusDot({ status }: { status: AgentStatus }) {
  const cls =
    status === "thinking"
      ? "bg-yellow-300 animate-pulse"
      : status === "speaking"
        ? "bg-cw-green"
        : "bg-white/25";
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
            className="card-glow flex items-start gap-3 rounded-2xl border border-white/10 bg-[#111] p-4"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-black"
              style={{ backgroundColor: meta.color }}
            >
              {meta.avatar}
            </span>
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
