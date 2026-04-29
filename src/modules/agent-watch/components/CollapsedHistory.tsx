"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META, AGENT_ORDER } from "../agents";
import type { AgentId, HistoryMessageEntry } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

const HISTORY_COUNT_WINDOW_MS = 30 * 60_000;

type CollapsedHistoryLabels = {
  expandLabel: string;
  collapseLabel: string;
  tabTimeline: string;
  tabFaction: string;
  emptyTimeline: string;
  emptyFaction: string;
};

type HistoryTab = "timeline" | "faction";

function recentHistoryCount(messages: HistoryMessageEntry[], now: number) {
  return messages.filter((message) => now - message.generatedAt <= HISTORY_COUNT_WINDOW_MS).length;
}

function sortedMessages(messages: HistoryMessageEntry[]) {
  return [...messages].sort((a, b) => b.generatedAt - a.generatedAt);
}

function HistoryTimelineItem({ message }: { message: HistoryMessageEntry }) {
  const { locale } = useI18n();
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const meta = AGENT_META[message.agentId];

  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
      <AgentAvatar agentId={message.agentId} size="typing" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{meta.name}</span>
          <span className="font-mono text-[11px] text-white/35">
            {formatAgentMessageTime(message.generatedAt, locale)}
          </span>
        </div>
        <div
          className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2 text-sm leading-relaxed text-white/72"
          style={{ borderLeftColor: token.primary, borderLeftWidth: 2 }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function FactionColumn({
  agentId,
  messages,
  emptyLabel,
}: {
  agentId: AgentId;
  messages: HistoryMessageEntry[];
  emptyLabel: string;
}) {
  const { locale } = useI18n();
  const token = AGENT_COLOR_TOKEN[agentId];
  const meta = AGENT_META[agentId];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: token.primary }} />
        <span className="text-sm font-bold text-white">{meta.name}</span>
        <span className="text-xs text-white/38">{meta.tagline}</span>
      </div>
      <div className="space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-white/35">{emptyLabel}</p>
        ) : (
          messages.slice(0, 8).map((message) => (
            <div
              key={message.id}
              className="rounded-xl bg-black/25 px-3 py-2 text-xs leading-relaxed text-white/65"
            >
              <div className="mb-1 font-mono text-[10px] text-white/30">
                {formatAgentMessageTime(message.generatedAt, locale)}
              </div>
              <p>{message.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CollapsedHistory({
  messages,
  labels,
}: {
  messages: HistoryMessageEntry[];
  labels: CollapsedHistoryLabels;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<HistoryTab>("timeline");
  const now = Date.now();
  const count = recentHistoryCount(messages, now);
  const timelineMessages = useMemo(() => sortedMessages(messages), [messages]);
  const factionMessages = useMemo(
    () =>
      AGENT_ORDER.reduce(
        (groups, agentId) => {
          groups[agentId] = sortedMessages(messages.filter((message) => message.agentId === agentId));
          return groups;
        },
        {} as Record<AgentId, HistoryMessageEntry[]>,
      ),
    [messages],
  );

  return (
    <div className="border-t border-white/[0.06] pt-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="rounded-full border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm font-semibold text-white/55 transition-colors hover:border-white/[0.16] hover:text-white/78"
      >
        {expanded ? labels.collapseLabel : `${labels.expandLabel} (${count})`}
      </button>

      {expanded && (
        <div className="mt-4 max-h-[480px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0d0d0f]/85 p-3">
          <div className="mb-3 flex gap-2">
            {(["timeline", "faction"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === item
                    ? "bg-white text-black"
                    : "bg-white/[0.04] text-white/48 hover:text-white/72"
                }`}
              >
                {item === "timeline" ? labels.tabTimeline : labels.tabFaction}
              </button>
            ))}
          </div>

          {tab === "timeline" ? (
            timelineMessages.length === 0 ? (
              <p className="p-3 text-sm text-white/35">{labels.emptyTimeline}</p>
            ) : (
              <div className="space-y-3">
                {timelineMessages.map((message) => (
                  <HistoryTimelineItem key={message.id} message={message} />
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {AGENT_ORDER.map((agentId) => (
                <FactionColumn
                  key={agentId}
                  agentId={agentId}
                  messages={factionMessages[agentId]}
                  emptyLabel={labels.emptyFaction}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

