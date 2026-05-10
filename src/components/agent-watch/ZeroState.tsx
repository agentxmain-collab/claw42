"use client";

import type { MarketTickerPayload } from "@/modules/agent-watch/types";

function formatPrice(price: number) {
  if (!Number.isFinite(price)) return "--";
  if (price >= 1_000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function formatChange(change: number) {
  if (!Number.isFinite(change)) return "--";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function ZeroState({
  title,
  subtitle,
  marketSnapshot,
}: {
  title: string;
  subtitle: string;
  marketSnapshot?: MarketTickerPayload | null;
}) {
  const majors = marketSnapshot?.pool?.majors.slice(0, 3) ?? [];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/[0.08] text-xl">
        ✦
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/55">{subtitle}</p>
      {majors.length > 0 && (
        <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
          {majors.map((item) => {
            const positive = item.change24h >= 0;
            return (
              <div
                key={item.symbol}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left"
              >
                <div className="font-mono text-xs font-bold text-white/50">
                  ${item.symbol.replace(/^\$/, "")}
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-white">
                  {formatPrice(item.price)}
                </div>
                <div
                  className={`mt-1 font-mono text-sm font-bold ${
                    positive ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {formatChange(item.change24h)} / 24h
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
