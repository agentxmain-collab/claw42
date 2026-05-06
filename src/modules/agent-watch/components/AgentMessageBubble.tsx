"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentMessage } from "../types";
import { formatAgentMessageTime } from "../utils/formatTime";
import { AgentAvatar } from "./AgentAvatar";

function splitMessageParts(content: string): string[] {
  const normalized = content
    .replace(/\s+/g, " ")
    .replace(/；/g, "。")
    .replace(/;/g, "。")
    .trim();
  const parts = normalized
    .split("。")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [content.trim()];
}

function stripLabel(content: string, label: string): string {
  return content.replace(new RegExp(`^${label}[：:]\\s*`), "").trim();
}

function AgentMessageContent({ message }: { message: AgentMessage }) {
  const token = AGENT_COLOR_TOKEN[message.agentId];
  const parts = splitMessageParts(message.content);

  if (message.agentId === "alpha") {
    const trigger = stripLabel(parts[0] ?? message.content, "触发");
    const fail = stripLabel(parts[1] ?? "", "失效");

    return (
      <div
        className="mt-1.5 rounded-xl border border-white/[0.08] bg-black/35 px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.22)]"
        style={{ borderLeft: `3px solid ${token.primary}` }}
      >
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: token.primary }}>
          Trigger
        </div>
        <p className="text-sm font-semibold leading-relaxed text-white/88">{trigger}</p>
        {fail && (
          <p className="mt-1.5 text-xs leading-relaxed text-white/48">
            失效：{fail}
          </p>
        )}
      </div>
    );
  }

  if (message.agentId === "beta") {
    const trend = stripLabel(parts[0] ?? message.content, "趋势");
    const action = stripLabel(parts[1] ?? "", "动作");

    return (
      <div className="mt-1.5 space-y-2 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
        <div className="grid grid-cols-[3.25rem_1fr] gap-2">
          <span
            className="rounded-md border border-white/[0.08] px-2 py-1 text-center text-[11px] font-bold"
            style={{ color: token.primary }}
          >
            趋势
          </span>
          <p className="text-sm leading-relaxed text-white/84">{trend}</p>
        </div>
        {action && (
          <div className="grid grid-cols-[3.25rem_1fr] gap-2 border-t border-white/[0.06] pt-2">
            <span className="rounded-md bg-white/[0.04] px-2 py-1 text-center text-[11px] font-bold text-white/45">
              动作
            </span>
            <p className="text-sm leading-relaxed text-white/70">{action}</p>
          </div>
        )}
      </div>
    );
  }

  const extreme = stripLabel(parts[0] ?? message.content, "极端");
  const boundary = stripLabel(parts[1] ?? "", "边界");

  return (
    <div className="mt-1.5 rounded-2xl border border-dashed border-white/[0.1] bg-[radial-gradient(circle_at_top_left,rgba(150,94,255,0.16),rgba(0,0,0,0.28)_52%)] p-3">
      <p className="text-xs font-bold tracking-[0.16em]" style={{ color: token.primary }}>
        EXTREME WINDOW
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/82">{extreme}</p>
      {boundary && (
        <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-white/58">
          边界：{boundary}
        </p>
      )}
    </div>
  );
}

export function AgentMessageBubble({ message }: { message: AgentMessage }) {
  const { locale } = useI18n();
  const meta = AGENT_META[message.agentId];
  const timeLabel = formatAgentMessageTime(message.ts, locale);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="animate-stream-in flex gap-2 py-2"
    >
      <AgentAvatar agentId={message.agentId} size="message" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{meta.name}</span>
          <span className="font-mono text-xs text-white/35">{timeLabel}</span>
        </div>
        <AgentMessageContent message={message} />
      </div>
    </motion.div>
  );
}
