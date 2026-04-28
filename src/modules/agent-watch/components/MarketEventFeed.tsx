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

function ageLabel(ts: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function severityClass(severity: SignalRecord["severity"]) {
  if (severity === "alert") return "border-[#ff5f5f]/40 bg-[#ff5f5f]/10 text-[#ffb3b3]";
  if (severity === "watch") return "border-[#b49cff]/40 bg-[#7c5cff]/10 text-[#d8ccff]";
  return "border-white/10 bg-white/[0.04] text-white/55";
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
  const latest = [...signals].sort((a, b) => b.ts - a.ts).slice(0, 6);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0d0d10] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
          </span>
          <h2 className="text-sm font-bold text-white">{labels.title}</h2>
        </div>
        <span className="rounded-full border border-[#7c5cff]/40 bg-[#7c5cff]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d8ccff]">
          {labels.live}
        </span>
      </div>

      {latest.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-4 text-sm text-white/40">
          {labels.empty}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {latest.map((signal) => (
              <motion.div
                key={signal.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-white/[0.08] bg-black/25 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">
                      {signal.symbol}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityClass(
                        signal.severity,
                      )}`}
                    >
                      {SIGNAL_TYPE_LABEL[signal.type]}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-white/30">{ageLabel(signal.ts)}</span>
                </div>
                <p className="text-xs leading-relaxed text-white/65">
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
