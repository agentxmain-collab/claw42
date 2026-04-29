"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { AgentId, StreamEntry } from "../types";
import { AgentMessageBubble } from "./AgentMessageBubble";
import { CollectiveEventCard } from "./CollectiveEventCard";
import { ConflictEventCard } from "./ConflictEventCard";
import { FocusEventCard } from "./FocusEventCard";
import { TypingIndicator } from "./TypingIndicator";

export interface StreamHandle {
  scrollToLatest: () => void;
}

interface StreamProps {
  entries: StreamEntry[];
  typingAgent: AgentId | null;
  emptyLabel?: string;
}

function StreamEntryView({ entry }: { entry: StreamEntry }) {
  if (entry.kind === "agent_message") return <AgentMessageBubble message={entry} />;
  if (entry.kind === "collective_event") return <CollectiveEventCard event={entry} />;
  if (entry.kind === "focus_event") return <FocusEventCard event={entry} />;
  return <ConflictEventCard event={entry} />;
}

export const Stream = forwardRef<StreamHandle, StreamProps>(function Stream(
  { entries, typingAgent, emptyLabel },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] duplicate stream entry id in render", entry.id);
      }
      return false;
    });
  }, [entries]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [uniqueEntries, typingAgent, autoScroll]);

  useImperativeHandle(forwardedRef, () => ({
    scrollToLatest: () => {
      const el = containerRef.current;
      if (!el) return;
      setAutoScroll(true);
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    },
  }));

  return (
    <div className="relative min-h-[560px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
      <div
        ref={containerRef}
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
        }}
        className="h-[560px] overflow-y-auto px-4 py-4 md:px-6"
      >
        {uniqueEntries.length === 0 && !typingAgent && (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            {emptyLabel ?? "等待 Agent 开口..."}
          </div>
        )}

        <AnimatePresence initial={false}>
          {uniqueEntries.map((entry) => (
            <StreamEntryView key={entry.id} entry={entry} />
          ))}
        </AnimatePresence>

        {typingAgent && <TypingIndicator agentId={typingAgent} />}
      </div>

      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md"
        >
          回到最新
        </button>
      )}
    </div>
  );
});
