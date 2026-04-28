"use client";

import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentFocus, AgentId } from "../types";
import { AgentAvatar } from "./AgentAvatar";

function formatUpdatedAt(ts?: number) {
  if (!ts) return "--";
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (minutes <= 0) return "now";
  return `${minutes}m`;
}

function formatEvidence(template: string, count?: number) {
  return template.replace("{count}", String(count ?? 0));
}

export function AgentFocusCard({
  agentId,
  focus,
  labels,
}: {
  agentId: AgentId;
  focus?: AgentFocus;
  labels: {
    title: string;
    warmingUp: string;
    trigger: string;
    fail: string;
    evidenceCount: string;
    updated: string;
  };
}) {
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d10] p-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${token.primary}, transparent)` }}
      />
      <div className="flex items-start gap-3">
        <AgentAvatar agentId={agentId} size="typing" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-white">{meta.name}</h3>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: `${token.primary}66`,
                color: token.primary,
                backgroundColor: token.soft,
              }}
            >
              {focus?.symbol ?? labels.title}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-white/45">{meta.tagline}</p>
        </div>
        <span className="font-mono text-[11px] text-white/30">
          {labels.updated} {formatUpdatedAt(focus?.generatedAt)}
        </span>
      </div>

      <p className="mt-4 min-h-[3rem] text-sm font-semibold leading-relaxed text-white">
        {focus?.judgment ?? labels.warmingUp}
      </p>

      <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <p className="font-bold text-white/45">{labels.trigger}</p>
          <p className="mt-1 leading-relaxed text-white/75">
            {focus?.trigger.description ?? labels.warmingUp}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <p className="font-bold text-white/45">{labels.fail}</p>
          <p className="mt-1 leading-relaxed text-white/75">
            {focus?.fail.description ?? labels.warmingUp}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-white/35">
        <span>{formatEvidence(labels.evidenceCount, focus?.evidenceCount)}</span>
        <span className="font-mono">{focus?.trigger.type ?? "warming-up"}</span>
      </div>
    </article>
  );
}
