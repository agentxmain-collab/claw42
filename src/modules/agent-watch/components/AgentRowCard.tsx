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
        : status === "alert"
          ? "animate-pulse bg-rose-400 shadow-[0_0_10px_rgba(255,95,95,0.55)]"
          : "bg-white/20";
  return (
    <span aria-label={label} title={label} className={`inline-block h-2 w-2 rounded-full ${cls}`} />
  );
}

function statusCopy(status: AgentStatus, statusLabels: AgentRowCardProps["statusLabels"]) {
  if (status === "thinking") return statusLabels.thinking;
  if (status === "speaking") return statusLabels.speaking;
  if (status === "alert") return statusLabels.alert ?? statusLabels.speaking;
  return statusLabels.idle;
}

interface AgentRowCardProps {
  agentId: AgentId;
  focus: AgentFocus | null;
  status: AgentStatus;
  statusLabels: { thinking: string; speaking: string; idle: string; alert?: string };
  focusLabels: {
    watching: string;
    focusLabel: string;
    trigger: string;
    fail: string;
    expandFail: string;
    warmup: string;
  };
}

export function AgentRowCard({ agentId, status, statusLabels, focusLabels }: AgentRowCardProps) {
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];
  const statusLabel = statusCopy(status, statusLabels);
  const isActive = status === "thinking" || status === "speaking" || status === "alert";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-[#111] transition-all duration-300 hover:bg-white/[0.03] ${
        isActive
          ? "min-h-[140px] gap-4 p-5 shadow-[0_18px_54px_rgba(0,0,0,0.28)]"
          : "min-h-[92px] gap-2 p-4"
      }`}
      style={{
        border: `1px solid ${token.soft}`,
        borderLeft: `2px solid ${token.primary}`,
        boxShadow: status === "alert" ? `0 0 28px ${token.soft}` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <AgentAvatar agentId={agentId} size="card" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-base font-bold text-white">{meta.name}</span>
            <StatusDot status={status} label={statusLabel} />
          </div>
          <div className="text-white/42 mt-1 text-xs font-semibold">{statusLabel}</div>
        </div>
      </div>

      {isActive && (
        <div className="text-white/58 flex flex-1 items-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm font-semibold">
          {status === "thinking"
            ? focusLabels.warmup
            : status === "alert"
              ? focusLabels.watching
              : focusLabels.focusLabel}
        </div>
      )}
    </div>
  );
}
