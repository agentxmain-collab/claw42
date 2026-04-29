"use client";

import type { SignalRecord } from "../types";

const SEVERITY_DOT: Record<SignalRecord["severity"], string> = {
  alert: "bg-[#ff5f5f]",
  watch: "bg-[#b49cff]",
  info: "bg-white/35",
};

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0",
  )}`;
}

export function SystemSignalBubble({ signal }: { signal: SignalRecord }) {
  return (
    <div className="my-2 flex justify-center">
      <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
        <span className="shrink-0 font-mono text-[10px] text-white/40">
          {formatTime(signal.ts)}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-white/55">
          {signal.payload.description ?? `${signal.symbol} ${signal.type}`}
        </span>
      </div>
    </div>
  );
}
