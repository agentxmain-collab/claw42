"use client";

import { useReducedMotion } from "framer-motion";
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

function SignalChip({ signal }: { signal: SignalRecord }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
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
    </div>
  );
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
  const latest = [...signals].sort((a, b) => b.ts - a.ts).slice(0, 12);
  const marqueeSignals = reduceMotion || latest.length <= 1 ? latest : [...latest, ...latest];
  const animation = reduceMotion || latest.length <= 1 ? "none" : "claw42-marquee 60s linear infinite";

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

      <div className="flex-1 overflow-hidden py-1">
        <div
          className="claw42-marquee-track flex w-max items-center gap-3"
          style={{ animation, animationPlayState: "running" }}
          onMouseEnter={(event) => {
            event.currentTarget.style.animationPlayState = "paused";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.animationPlayState = "running";
          }}
        >
          {marqueeSignals.map((signal, index) => (
            <SignalChip
              key={`${signal.id}-${index < latest.length ? "a" : "b"}`}
              signal={signal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
