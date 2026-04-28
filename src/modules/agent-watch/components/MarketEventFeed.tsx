"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SignalRecord } from "../types";

const SIGNAL_TYPE_LABEL: Record<SignalRecord["type"], string> = {
  volume_spike: "VOLUME",
  near_high: "NEAR HIGH",
  near_low: "NEAR LOW",
  breakout: "BREAKOUT",
  ema_cross: "EMA",
  range_change: "RANGE",
};

const SEVERITY_DOT: Record<SignalRecord["severity"], string> = {
  alert: "bg-[#ff5f5f] shadow-[0_0_8px_rgba(255,95,95,0.55)]",
  watch: "bg-[#b49cff] shadow-[0_0_8px_rgba(124,92,255,0.45)]",
  info: "bg-white/35",
};

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0",
  )}`;
}

export function MarketEventFeed({
  signals,
  labels,
}: {
  signals: SignalRecord[];
  labels: {
    title: string;
    empty: string;
  };
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const latest = [...signals].sort((a, b) => b.ts - a.ts).slice(0, 12);

  useEffect(() => {
    if (reduceMotion || isHovering || latest.length <= 4) return;
    const container = containerRef.current;
    if (!container) return;

    const timer = window.setInterval(() => {
      const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 4;
      if (atEnd) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: container.clientWidth * 0.4, behavior: "smooth" });
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isHovering, latest.length, reduceMotion]);

  if (latest.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        <span>{labels.title}：</span>
        <span>{labels.empty}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        {labels.title}
      </div>

      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="flex flex-1 items-center gap-3 overflow-x-auto scroll-smooth py-1"
      >
        <AnimatePresence initial={false}>
          {latest.map((signal) => (
            <motion.div
              key={signal.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`}
              />
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                {formatTime(signal.ts)}
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold text-white/65">
                {signal.symbol}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-[#b49cff]/80">
                {SIGNAL_TYPE_LABEL[signal.type]}
              </span>
              <span className="whitespace-nowrap text-xs text-white/85">
                {signal.payload.description ?? `${signal.symbol} ${signal.type}`}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
