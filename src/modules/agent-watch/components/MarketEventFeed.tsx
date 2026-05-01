"use client";

import { useReducedMotion } from "framer-motion";
import type { SignalRecord } from "../types";
import type { AgentWatchLocale } from "../locale";
import { priceDeltaColor } from "../utils/priceDeltaColor";
import { formatCoinSymbol, prefixLeadingCoinSymbol } from "../utils/symbolFormat";

const SIGNAL_TYPE_LABEL: Record<SignalRecord["type"], string> = {
  volume_spike: "VOLUME",
  near_high: "NEAR HIGH",
  near_low: "NEAR LOW",
  breakout: "BREAKOUT",
  ema_cross: "EMA",
  range_change: "RANGE",
};

const SIGNAL_DESCRIPTION_EN: Record<SignalRecord["type"], string> = {
  volume_spike: "5m volume spike",
  near_high: "testing recent high",
  near_low: "testing recent low",
  breakout: "breakout move",
  ema_cross: "EMA structure changed",
  range_change: "24h range change",
};

const SEVERITY_DOT: Record<SignalRecord["severity"], string> = {
  alert: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]",
  watch: "bg-white/65 shadow-[0_0_8px_rgba(255,255,255,0.22)]",
  info: "bg-white/35",
};

const SEVERITY_CHIP: Record<SignalRecord["severity"], string> = {
  alert: "border-l-2 border-l-amber-400/70 bg-white/[0.06]",
  watch: "",
  info: "bg-white/[0.025]",
};

const SEVERITY_TEXT: Record<SignalRecord["severity"], string> = {
  alert: "text-white/85",
  watch: "text-white/55",
  info: "text-white/40",
};

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0",
  )}`;
}

function signalDescription(signal: SignalRecord, locale: AgentWatchLocale): string {
  if (locale === "en_US") {
    const symbol = formatCoinSymbol(signal.symbol);
    if (typeof signal.payload.change24h === "number") {
      return `${symbol} 24h ${signal.payload.change24h >= 0 ? "+" : ""}${signal.payload.change24h.toFixed(1)}%`;
    }
    if (typeof signal.payload.volumeRatio === "number") {
      return `${symbol} ${SIGNAL_DESCRIPTION_EN[signal.type]} ${signal.payload.volumeRatio.toFixed(1)}x`;
    }
    if (typeof signal.payload.distancePct === "number") {
      return `${symbol} ${SIGNAL_DESCRIPTION_EN[signal.type]} ${signal.payload.distancePct.toFixed(2)}% away`;
    }
    return `${symbol} ${SIGNAL_DESCRIPTION_EN[signal.type]}`;
  }

  return signal.payload.description
    ? prefixLeadingCoinSymbol(signal.payload.description, signal.symbol)
    : `${formatCoinSymbol(signal.symbol)} ${signal.type}`;
}

function SignalChip({
  signal,
  locale,
}: {
  signal: SignalRecord;
  locale: AgentWatchLocale;
}) {
  const descriptionClass =
    typeof signal.payload.change24h === "number"
      ? priceDeltaColor(signal.payload.change24h)
      : SEVERITY_TEXT[signal.severity];
  const description = signalDescription(signal, locale);

  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06] ${SEVERITY_CHIP[signal.severity]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
      <span className="shrink-0 font-mono text-[10px] text-white/40">
        {formatTime(signal.ts)}
      </span>
      <span className="shrink-0 font-mono text-[10px] font-bold text-white/65">
        {formatCoinSymbol(signal.symbol)}
      </span>
      <span className="shrink-0 text-[10px] font-bold text-white/58">
        {SIGNAL_TYPE_LABEL[signal.type]}
      </span>
      <span className={`whitespace-nowrap text-xs ${descriptionClass}`}>
        {description}
      </span>
    </div>
  );
}

export function MarketEventFeed({
  signals,
  labels,
  locale = "zh_CN",
}: {
  signals: SignalRecord[];
  labels: {
    title: string;
    empty: string;
  };
  locale?: AgentWatchLocale;
}) {
  const reduceMotion = useReducedMotion();
  const latest = [...signals].sort((a, b) => b.ts - a.ts).slice(0, 12);
  const marqueeSignals = reduceMotion || latest.length <= 1 ? latest : [...latest, ...latest];
  const animation = reduceMotion || latest.length <= 1 ? "none" : "claw42-marquee 60s linear infinite";

  if (latest.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-35" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
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
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-35" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
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
              locale={locale}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
