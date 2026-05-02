"use client";

import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
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

export function AgentRowCard({
  agentId,
  focus,
  status,
  statusLabels,
  focusLabels,
}: {
  agentId: AgentId;
  focus: AgentFocus | null;
  status: AgentStatus;
  statusLabels: { thinking: string; speaking: string; idle: string };
  focusLabels: {
    watching: string;
    focusLabel: string;
    trigger: string;
    fail: string;
    expandFail: string;
    warmup: string;
  };
}) {
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];
  const statusLabel =
    status === "thinking"
      ? statusLabels.thinking
      : status === "speaking"
        ? statusLabels.speaking
        : statusLabels.idle;

  return (
    <div
      className="flex max-h-[220px] min-h-[180px] flex-col gap-2 overflow-hidden rounded-2xl bg-[#111] p-4 transition-colors hover:bg-white/[0.03]"
      style={{
        border: `1px solid ${token.soft}`,
        borderLeft: `2px solid ${token.primary}`,
        boxShadow: `0 12px 28px -22px ${token.glow}`,
      }}
    >
      <div className="flex items-center gap-2">
        <AgentAvatar agentId={agentId} size="card" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{meta.name}</span>
            <StatusDot status={status} />
          </div>
          <div className="truncate text-[11px] leading-snug text-white/45">{meta.tagline}</div>
          <div className="mt-0.5 text-[10px] font-medium text-white/30">{statusLabel}</div>
        </div>
        {focus && (
          <button
            type="button"
            className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 text-left transition-colors hover:bg-white/[0.08]"
          >
            <span className="mr-1 text-[10px] font-bold uppercase text-white/45">
              {focusLabels.focusLabel}
            </span>
            <span className="font-mono text-xs font-bold text-white">{focus.symbol}</span>
          </button>
        )}
      </div>

      {focus ? (
        <>
          <p className="line-clamp-2 flex-1 text-xs font-semibold leading-relaxed text-white/85">
            {focus.judgment}
          </p>
          <div className="flex items-start gap-1.5 text-[11px]">
            <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#b49cff]">
              {focusLabels.trigger}
            </span>
            <span className="truncate text-white/65">{focus.trigger.description}</span>
          </div>
          <details className="text-[11px]">
            <summary className="flex cursor-pointer select-none items-center gap-1 text-white/35 hover:text-white/55">
              <span className="text-[9px]">▸</span>
              {focusLabels.expandFail}
            </summary>
            <div className="mt-1 flex items-start gap-1.5 pl-3">
              <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#ff8a8a]">
                {focusLabels.fail}
              </span>
              <span className="line-clamp-2 text-white/65">{focus.fail.description}</span>
            </div>
          </details>
        </>
      ) : (
        <div className="flex flex-1 items-center rounded-lg bg-white/[0.03] px-3 text-xs text-white/40">
          {focusLabels.warmup}
        </div>
      )}
    </div>
  );
}
