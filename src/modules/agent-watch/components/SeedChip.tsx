"use client";

import type { ChatThread } from "@/lib/types";
import { formatCoinSymbol } from "../utils/symbolFormat";

export function SeedChip({ thread }: { thread: ChatThread }) {
  const symbols = thread.seed.symbols.slice(0, 4);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/55">
      <span className="rounded-full border border-violet-300/35 bg-violet-300/[0.10] px-2.5 py-1 font-bold text-violet-200">
        {thread.seed.type === "news" ? "触发" : thread.seed.type === "market" ? "行情" : "会诊"}
      </span>
      {symbols.map((symbol) => (
        <span
          key={symbol}
          className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono font-bold text-white/70"
        >
          {formatCoinSymbol(symbol)}
        </span>
      ))}
      <span className="min-w-0 truncate text-[#8b8b8b]">{thread.seed.title}</span>
    </div>
  );
}
