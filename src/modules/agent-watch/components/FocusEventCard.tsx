"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentId, FocusEvent, FocusEventType } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { useI18n } from "@/i18n/I18nProvider";

type FocusEventCardLabels = {
  typeCollective: string;
  typeHighSeverity: string;
  typeFactionConflict: string;
  folded: string;
  primaryLabel: string;
  echoLabel: string;
};

function focusTypeLabel(type: FocusEventType, labels: FocusEventCardLabels) {
  if (type === "collective") return labels.typeCollective;
  if (type === "high_severity") return labels.typeHighSeverity;
  return labels.typeFactionConflict;
}

function replaceMinutes(template: string, minutes: number) {
  return template.replace("{minutes}", String(minutes));
}

function PrimaryResponse({
  agentId,
  content,
  label,
}: {
  agentId: AgentId;
  content: string;
  label: string;
}) {
  const token = AGENT_COLOR_TOKEN[agentId];
  const meta = AGENT_META[agentId];

  return (
    <div
      className="relative rounded-2xl border bg-black/40 px-4 py-3"
      style={{
        borderColor: token.soft,
        boxShadow: `0 12px 34px -24px ${token.glow}`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full"
        style={{ background: token.primary }}
      />
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/55">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: token.primary }} />
        <span>{meta.name}</span>
        <span>{label}</span>
      </div>
      <p className="text-sm leading-relaxed text-white/84">{content}</p>
    </div>
  );
}

function EchoResponse({ echo }: { echo: FocusEvent["echoes"][number] }) {
  const token = AGENT_COLOR_TOKEN[echo.agentId];
  const meta = AGENT_META[echo.agentId];

  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs leading-relaxed text-white/68"
      style={{ borderLeftColor: token.primary, borderLeftWidth: 2 }}
    >
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: token.primary }} />
      <span>
        <span className="font-semibold text-white/80">{meta.name}</span>
        <span className="px-1 text-white/35">·</span>
        {echo.content}
      </span>
    </div>
  );
}

export function FocusEventCard({
  event,
  labels,
  silentMinutes,
}: {
  event: FocusEvent | null;
  labels: FocusEventCardLabels;
  silentMinutes: number;
}) {
  const { locale } = useI18n();

  if (!event) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/35">
        {replaceMinutes(labels.folded, silentMinutes)}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={event.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
        className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.035] p-4 shadow-[0_18px_46px_-36px_rgba(251,191,36,0.55)]"
      >
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.65)]" />
          <span className="text-sm font-bold text-white">
            {focusTypeLabel(event.type, labels)}
          </span>
          <span className="font-mono text-xs text-white/38">
            {formatAgentMessageTime(event.ts, locale)}
          </span>
        </header>

        <p className="mb-3 text-sm leading-relaxed text-white/82">{event.summary}</p>

        <div className="space-y-2">
          <PrimaryResponse
            agentId={event.primaryAgent}
            content={event.primaryContent}
            label={labels.primaryLabel}
          />
          <div className="grid gap-2 md:grid-cols-2">
            {event.echoes.map((echo) => (
              <EchoResponse key={echo.agentId} echo={echo} />
            ))}
          </div>
        </div>
      </motion.article>
    </AnimatePresence>
  );
}

