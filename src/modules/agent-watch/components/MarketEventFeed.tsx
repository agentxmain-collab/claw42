"use client";

import { AnimatePresence, motion } from "framer-motion";
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

function ageLabel(ts: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

export function MarketEventFeed({
  signals,
  labels,
}: {
  signals: SignalRecord[];
  labels: {
    title: string;
    empty: string;
    live: string;
  };
}) {
  const latest = [...signals].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0d0d10] p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            {labels.title}
          </h2>
        </div>
        <span className="rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d8ccff]">
          {labels.live}
        </span>
      </div>

      {latest.length === 0 ? (
        <div className="px-2 py-1.5 text-xs text-white/30">
          {labels.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {latest.map((signal) => (
              <motion.div
                key={signal.id}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-7 items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.03]"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
                <span className="w-9 shrink-0 font-mono text-[10px] text-white/35">
                  {ageLabel(signal.ts)}
                </span>
                <span className="w-14 shrink-0 font-mono text-[10px] font-bold text-white/65">
                  {signal.symbol}
                </span>
                <span className="w-16 shrink-0 text-[10px] font-bold text-[#b49cff]/80">
                  {SIGNAL_TYPE_LABEL[signal.type]}
                </span>
                <p className="min-w-0 flex-1 truncate text-xs text-white/70">
                  {signal.payload.description ?? `${signal.symbol} ${signal.type}`}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
