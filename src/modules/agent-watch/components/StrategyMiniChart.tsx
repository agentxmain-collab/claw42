"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function StrategyMiniChart({
  entry,
  stop,
  targets,
}: {
  entry: number;
  stop: number;
  targets: number[];
}) {
  const fallbackEntry = entry || 100;
  const points = [
    { name: "now", price: fallbackEntry * 0.992 },
    { name: "entry", price: fallbackEntry },
    { name: "mid", price: targets[0] ?? fallbackEntry * 1.012 },
    { name: "tp", price: targets[1] ?? targets[0] ?? fallbackEntry * 1.024 },
  ];

  return (
    <div className="h-20 min-w-[140px] rounded-xl border border-white/10 bg-black/25 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <defs>
            <linearGradient id="strategyMiniChart" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#strategyMiniChart)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <span className="sr-only">{stop}</span>
    </div>
  );
}
