"use client";

import { AGENT_COLOR_TOKEN, AGENT_META, AGENT_ORDER } from "../agents";
import type { AgentFocus, AgentId, AgentStatus } from "../types";
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
  focusByAgent,
  focusLabels,
}: {
  activeAgent: AgentId | null;
  speakingAgent: AgentId | null;
  labels: { thinking: string; speaking: string; idle: string };
  focusByAgent: Map<AgentId, AgentFocus>;
  focusLabels: {
    watching: string;
    trigger: string;
    fail: string;
    expandFail: string;
    evidenceCount: string;
    warmup: string;
  };
}) {
  return (
    <aside className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:w-[340px] lg:shrink-0 lg:overflow-visible lg:pb-0">
      {AGENT_ORDER.map((id) => {
        const meta = AGENT_META[id];
        const token = AGENT_COLOR_TOKEN[id];
        const focus = focusByAgent.get(id);
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
            className="flex min-w-[280px] flex-1 flex-col gap-3 rounded-2xl border border-l-2 bg-[#0e0e10] p-4 transition-colors hover:bg-white/[0.03] lg:min-w-0"
            style={{
              borderColor: token.soft,
              borderLeftColor: token.primary,
            }}
          >
            <div className="flex items-start gap-3">
              <AgentAvatar agentId={id} size="sidebar" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-white">{meta.name}</span>
                  <StatusDot status={status} />
                </div>
                <p className="mt-1 truncate text-xs leading-snug text-white/50">{meta.tagline}</p>
                <p className="mt-2 text-[11px] font-medium text-white/35">{label}</p>
              </div>
            </div>

            {focus ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                    {focusLabels.watching}
                  </span>
                  <span className="font-mono text-sm font-bold text-white">{focus.symbol}</span>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-white/85">
                  {focus.judgment}
                </p>
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 font-semibold text-[#b49cff]">
                    {focusLabels.trigger}
                  </span>
                  <span className="flex-1 leading-relaxed text-white/70">
                    {focus.trigger.description}
                  </span>
                </div>
                <details className="text-xs">
                  <summary className="flex cursor-pointer select-none items-center gap-1 text-white/40 hover:text-white/60">
                    <span className="text-[10px]">▸</span>
                    {focusLabels.expandFail}
                  </summary>
                  <div className="mt-1 flex items-start gap-2">
                    <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 font-semibold text-[#ff8a8a]">
                      {focusLabels.fail}
                    </span>
                    <span className="flex-1 leading-relaxed text-white/70">
                      {focus.fail.description}
                    </span>
                  </div>
                </details>
                <div className="border-t border-white/[0.06] pt-2 text-[10px] text-white/35">
                  {focusLabels.evidenceCount.replace("{count}", String(focus.evidenceCount))}
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-white/[0.03] px-3 py-4 text-center text-xs text-white/40">
                {focusLabels.warmup}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
