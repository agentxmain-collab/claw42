"use client";

import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

function formatNumber(value: number | undefined) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(Number(value)) >= 100 ? 2 : 4,
  });
}

export function SignalCard({ event }: { event: PublicTimelineEvent }) {
  if (event.payload.kind !== "market_signal") return null;
  const payload = event.payload;
  const isCritical = event.importance === "critical" || payload.severity === "critical";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isCritical
          ? "border-rose-300/35 bg-rose-950/[0.18]"
          : "border-amber-300/25 bg-amber-950/[0.10]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
          {payload.signalType}
        </span>
        <span className="font-mono text-sm font-bold text-white">${payload.symbol}</span>
        <span className={isCritical ? "text-xs font-bold text-rose-200" : "text-xs font-bold text-amber-200"}>
          {payload.severity}
        </span>
      </div>
      {payload.description && (
        <p className="mt-3 text-sm leading-relaxed text-white/78">{payload.description}</p>
      )}
      {(payload.threshold !== undefined || payload.observedValue !== undefined) && (
        <div className="mt-3 grid gap-2 text-xs text-white/55 md:grid-cols-2">
          <div className="rounded-xl bg-black/20 p-3">
            <div>Observed</div>
            <div className="mt-1 font-mono font-bold text-white">{formatNumber(payload.observedValue)}</div>
          </div>
          <div className="rounded-xl bg-black/20 p-3">
            <div>Threshold</div>
            <div className="mt-1 font-mono font-bold text-white">{formatNumber(payload.threshold)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
