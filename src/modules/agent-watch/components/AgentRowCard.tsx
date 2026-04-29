"use client";

import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentFocus, AgentId, AgentStatus } from "../types";
import { AgentAvatar } from "./AgentAvatar";

function StatusDot({ status, label }: { status: AgentStatus; label: string }) {
  const cls =
    status === "thinking"
      ? "bg-amber-400 animate-pulse"
      : status === "speaking"
        ? "animate-pulse bg-[#3a7bff] shadow-[0_0_8px_rgba(58,123,255,0.45)]"
        : "bg-white/20";
  return <span aria-label={label} title={label} className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
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
      className="flex min-h-[188px] flex-col gap-4 overflow-hidden rounded-2xl bg-[#111] p-5 transition-colors hover:bg-white/[0.03]"
      style={{
        border: `1px solid ${token.soft}`,
        borderLeft: `2px solid ${token.primary}`,
      }}
    >
      <div className="flex items-center gap-3">
        <AgentAvatar agentId={agentId} size="card" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-base font-bold text-white">{meta.name}</span>
            <StatusDot status={status} label={statusLabel} />
          </div>
        </div>
        {focus && (
          <button
            type="button"
            title={`${focusLabels.focusLabel}: ${focus.symbol}`}
            className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-left transition-colors hover:bg-white/[0.08]"
          >
            <span className="mr-1 text-xs font-bold text-white/45">
              {focusLabels.focusLabel}
            </span>
            <span className="font-mono text-sm font-bold text-white">{focus.symbol}</span>
          </button>
        )}
      </div>

      {focus ? (
        <>
          <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-white/86">
            {focus.judgment}
          </p>
          <details className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-white/45 hover:text-white/65">
              {focusLabels.expandFail}
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-white/65">
              <div>
                <span className="mr-2 rounded bg-white/[0.06] px-2 py-0.5 font-semibold text-white/60">
                  {focusLabels.trigger}
                </span>
                {focus.trigger.description}
              </div>
              <div>
                <span className="mr-2 rounded bg-[#ff5f5f]/15 px-2 py-0.5 font-semibold text-[#ff8a8a]">
                  {focusLabels.fail}
                </span>
                {focus.fail.description}
              </div>
            </div>
          </details>
        </>
      ) : (
        <div className="flex flex-1 items-center rounded-xl bg-white/[0.03] px-3 text-sm text-white/40">
          {focusLabels.warmup}
        </div>
      )}
    </div>
  );
}
