"use client";

import type { TradeDecision } from "@/lib/team/tradeDecision";

const RATING_STYLES: Record<TradeDecision["rating"], string> = {
  1: "border-rose-300/30 bg-rose-400/[0.10] text-rose-100",
  2: "border-amber-300/30 bg-amber-400/[0.10] text-amber-100",
  3: "border-white/15 bg-white/[0.06] text-white/70",
  4: "border-emerald-300/30 bg-emerald-400/[0.10] text-emerald-100",
  5: "border-violet-300/30 bg-violet-400/[0.12] text-violet-100",
};

function formatPrice(value: number | null) {
  if (!Number.isFinite(value)) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: Number(value) >= 1000 ? 0 : Number(value) >= 1 ? 4 : 6,
  })}`;
}

function directionLabel(direction: TradeDecision["direction"]) {
  if (direction === "long") return "Long";
  if (direction === "short") return "Short";
  return "Wait";
}

export function TradeCardBlock({ decision }: { decision: TradeDecision | null | undefined }) {
  if (!decision) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/55">
        PM decision unavailable. No trade card is rendered when the pipeline fails.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300/25 bg-emerald-950/[0.12] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">🎯</span>
        <span className="font-mono text-sm font-bold text-white">${decision.symbol}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-bold text-white/80">
          {directionLabel(decision.direction)}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-bold ${RATING_STYLES[decision.rating]}`}
        >
          {decision.rating}/5
        </span>
        <span className="text-xs text-white/45">
          {(decision.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="rounded-xl bg-black/25 p-3">
          <div className="text-xs text-white/40">Entry</div>
          <div className="mt-1 font-mono font-bold text-white">
            {formatPrice(decision.entryPrice)}
          </div>
        </div>
        <div className="rounded-xl bg-black/25 p-3">
          <div className="text-xs text-white/40">Stop loss</div>
          <div className="mt-1 font-mono font-bold text-rose-200">
            {formatPrice(decision.stopLoss)}
          </div>
        </div>
        <div className="rounded-xl bg-black/25 p-3">
          <div className="text-xs text-white/40">Take profit</div>
          <div className="mt-1 font-mono font-bold text-emerald-200">
            {decision.takeProfit.map((target) => formatPrice(target)).join(" / ") || "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-relaxed text-white/55 md:grid-cols-2">
        <p>
          <span className="text-white/80">Risk: </span>
          {decision.riskNote}
        </p>
        <p>
          <span className="text-white/80">Invalidates if: </span>
          {decision.invalidatesIf}
        </p>
      </div>
    </div>
  );
}
