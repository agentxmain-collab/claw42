"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENT_ORDER, AGENT_META } from "../agents";
import type { AgentId, StreamEntry } from "../types";
import { formatCoinSymbol } from "../utils/symbolFormat";

function speakerTimes(entries: StreamEntry[]) {
  const map = new Map<AgentId, number>();
  for (const entry of entries) {
    if (entry.kind === "agent_message") map.set(entry.agentId, entry.ts);
    if (entry.kind === "watch_update" && entry.agentId) map.set(entry.agentId, entry.ts);
    if (entry.kind === "agent_discussion") {
      entry.responses.forEach((response) => map.set(response.agentId, entry.ts));
    }
    if (entry.kind === "news_debate") {
      entry.debate.messages.forEach((message) => map.set(message.agentId, message.ts));
    }
    if (entry.kind === "chat_thread") {
      entry.thread.messages.forEach((message) => map.set(message.agentId, message.ts));
    }
  }
  return map;
}

function relativeMinutes(ts: number | undefined, now: number, english: boolean) {
  if (!ts) return english ? "warming up" : "刚上线";
  const minutes = Math.max(0, Math.round((now - ts) / 60_000));
  if (minutes <= 0) return english ? "now" : "刚刚";
  return english ? `${minutes}min ago` : `${minutes}min 前`;
}

export function FactionPresenceBar({
  entries,
  focusSymbols,
  locale,
}: {
  entries: StreamEntry[];
  focusSymbols: string[];
  locale: string;
}) {
  const [now, setNow] = useState(Date.now());
  const english = locale === "en_US";
  const times = useMemo(() => speakerTimes(entries), [entries]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const focus = focusSymbols.slice(0, 3).map(formatCoinSymbol).join(" / ");

  return (
    <div className="text-white/66 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold text-emerald-300">
          ● {english ? "3 factions online" : "3 派在线"}
        </span>
        {AGENT_ORDER.map((agentId) => (
          <span key={agentId}>
            {AGENT_META[agentId].name} {relativeMinutes(times.get(agentId), now, english)}
          </span>
        ))}
        {focus && (
          <span className="text-white/42">
            {english ? "Watching" : "当前关注"} {focus}
          </span>
        )}
      </div>
    </div>
  );
}
