"use client";

import type { Dict } from "@/i18n/types";
import type { FinalStrategy } from "@/lib/types";
import { StrategyMiniChart } from "./StrategyMiniChart";

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
  })}`;
}

function minutesLeft(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
}

export function FinalStrategyBlock({
  strategy,
  labels,
}: {
  strategy: FinalStrategy;
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  const isExpired = strategy.expiresAt <= Date.now();
  const directionClass =
    strategy.direction === "long"
      ? "text-emerald-300"
      : strategy.direction === "short"
        ? "text-rose-300"
        : "text-white/55";
  const cta =
    strategy.direction === "long"
      ? labels.followLong
      : strategy.direction === "short"
        ? labels.followShort
        : labels.waitSignal;

  return (
    <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-950/[0.13] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="font-bold text-white">{labels.finalStrategy}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs text-white/55">
              {labels.consensus} {strategy.consensusRatio}
            </span>
            <span className={`font-mono text-sm font-bold ${directionClass}`}>
              ${strategy.symbol} · {strategy.direction.toUpperCase()}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-black/25 p-3">
              <div className="text-xs text-white/40">{labels.entry}</div>
              <div className="text-white/86 mt-1 font-semibold">{strategy.entryCondition}</div>
            </div>
            <div className="rounded-xl bg-black/25 p-3">
              <div className="text-xs text-white/40">{labels.stopLoss}</div>
              <div className="mt-1 font-mono font-semibold text-rose-200">
                {formatPrice(strategy.stopLoss)}
              </div>
            </div>
            <div className="rounded-xl bg-black/25 p-3">
              <div className="text-xs text-white/40">{labels.takeProfit}</div>
              <div className="mt-1 font-mono font-semibold text-emerald-200">
                {strategy.takeProfit.map(formatPrice).join(" / ") || "—"}
              </div>
            </div>
          </div>

          {strategy.dissentNote && (
            <p className="mt-3 text-xs leading-relaxed text-white/50">
              <span className="text-violet-300">{labels.dissent}：</span>
              {strategy.dissentNote}
            </p>
          )}
          <p className="text-white/42 mt-2 text-xs leading-relaxed">
            <span>{labels.risk}：</span>
            {strategy.riskNote}
          </p>
        </div>

        <div className="w-full md:w-48">
          <StrategyMiniChart
            entry={
              strategy.stopLoss > 0 ? strategy.stopLoss * 1.01 : (strategy.takeProfit[0] ?? 100)
            }
            stop={strategy.stopLoss}
            targets={strategy.takeProfit}
          />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
            <span>
              👁 {strategy.viewCount} {labels.watching}
            </span>
            <span>
              👥 {strategy.followCount} {labels.follow}
            </span>
          </div>
          <div className={`mt-1 text-xs ${isExpired ? "text-rose-300" : "text-amber-300"}`}>
            {isExpired ? labels.expired : `${minutesLeft(strategy.expiresAt)}m ${labels.expiresIn}`}
          </div>
          <button
            type="button"
            disabled={isExpired || strategy.direction === "wait"}
            onClick={() => {
              if (strategy.deeplink)
                window.open(strategy.deeplink, "_blank", "noopener,noreferrer");
            }}
            className="mt-3 w-full rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
