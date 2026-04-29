"use client";

import type { CSSProperties } from "react";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentCardStatus, AgentCardView } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";
import { useI18n } from "@/i18n/I18nProvider";

type AgentCardStageLabels = {
  statusSilent: string;
  statusObserving: string;
  statusSpeaking: string;
  statusAlert: string;
  focusLabel: string;
  triggerLabel: string;
  invalidationLabel: string;
  updateAtSuffix: string;
};

const STATUS_STYLE: Record<AgentCardStatus, string> = {
  silent: "border-white/10 bg-white/5 text-white/45",
  observing: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  speaking: "border-[var(--agent-color)] bg-white/[0.07] text-white",
  alert: "border-rose-400/45 bg-rose-500/12 text-rose-100",
};

function statusLabel(status: AgentCardStatus, labels: AgentCardStageLabels) {
  if (status === "silent") return labels.statusSilent;
  if (status === "observing") return labels.statusObserving;
  if (status === "speaking") return labels.statusSpeaking;
  return labels.statusAlert;
}

function StatusChip({
  status,
  labels,
}: {
  status: AgentCardStatus;
  labels: AgentCardStageLabels;
}) {
  const dot =
    status === "alert"
      ? "animate-pulse bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.65)]"
      : status === "speaking"
        ? "animate-pulse bg-[var(--agent-color)] shadow-[0_0_10px_var(--agent-color-glow)]"
        : status === "observing"
          ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.45)]"
          : "bg-white/25";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {statusLabel(status, labels)}
    </span>
  );
}

export function AgentCardStage({
  view,
  labels,
}: {
  view: AgentCardView;
  labels: AgentCardStageLabels;
}) {
  const { locale } = useI18n();
  const meta = AGENT_META[view.agentId];
  const token = AGENT_COLOR_TOKEN[view.agentId];
  const timeLabel = formatAgentMessageTime(view.lastUpdateAt, locale);

  return (
    <article
      className={`relative flex min-h-[220px] max-h-[240px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0f] p-4 transition-colors hover:border-[var(--agent-color-soft)] hover:bg-white/[0.035] ${
        view.status === "speaking" || view.status === "alert" ? "claw42-pulse-border" : ""
      }`}
      style={
        {
          "--agent-color": token.primary,
          "--agent-color-soft": token.soft,
          "--agent-color-glow": token.glow,
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-0 top-4 w-[2px] rounded-full"
        style={{ background: token.primary }}
      />

      <header className="mb-3 flex items-start gap-3">
        <AgentAvatar agentId={view.agentId} size="card" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold text-white">{meta.name}</span>
            <span className="text-xs text-white/40">{meta.tagline}</span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-white/42">
            <StatusChip status={view.status} labels={labels} />
            <span>
              {labels.focusLabel}{" "}
              <span className="font-mono font-bold text-white/85">{view.currentSymbol}</span>
            </span>
            <span className="font-mono text-white/35">
              {timeLabel} {labels.updateAtSuffix}
            </span>
          </div>
        </div>
      </header>

      <p className="line-clamp-3 min-h-[3.9rem] text-sm font-semibold leading-relaxed text-white/86">
        {view.judgment}
      </p>

      <div className="mt-auto space-y-2 pt-3 text-xs">
        <div className="flex gap-2">
          <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/55">
            {labels.triggerLabel}
          </span>
          <span className="line-clamp-2 leading-relaxed text-white/68">{view.trigger}</span>
        </div>
        <details className="group text-white/40">
          <summary className="cursor-pointer select-none text-[11px] hover:text-white/62">
            {labels.invalidationLabel}
          </summary>
          <p className="mt-1 line-clamp-2 pl-2 leading-relaxed text-white/58">
            {view.invalidation}
          </p>
        </details>
      </div>
    </article>
  );
}
