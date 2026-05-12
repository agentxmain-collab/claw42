"use client";

import { useMemo } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { MarketTickerPayload } from "./types";
import { dispatchConsoleStats, dispatchTickers, type DispatchTicker } from "./dispatchConsoleData";

interface DispatchConsoleProps {
  events: PublicTimelineEvent[];
  evidenceMap: Record<string, NewsEvidence>;
  loading: boolean;
  marketSnapshot: MarketTickerPayload | null;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  if (value >= 1) return value.toFixed(value >= 100 ? 1 : 2);
  return value.toFixed(4);
}

function formatChange(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function tickersFromMarketSnapshot(snapshot: MarketTickerPayload | null): DispatchTicker[] {
  if (!snapshot) return dispatchTickers;
  const poolEntries = snapshot.pool
    ? [...snapshot.pool.majors, ...snapshot.pool.trending, ...snapshot.pool.opportunity]
    : [];
  const seen = new Set<string>();
  const entries = poolEntries
    .filter((entry) => {
      const symbol = entry.symbol.toUpperCase();
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    })
    .slice(0, 10)
    .map((entry) => ({
      symbol: entry.symbol.toUpperCase(),
      price: formatPrice(entry.price),
      change: formatChange(entry.change24h),
      direction: entry.change24h >= 0 ? ("up" as const) : ("down" as const),
    }));
  return entries.length > 0 ? entries : dispatchTickers;
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1a1a1a]/92 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 md:px-8">
        <div className="flex items-center gap-3 text-xl font-black tracking-tight text-white">
          <span className="h-4 w-4 rounded-full border border-[#d1ff55] bg-[var(--coinw-brand-hex)] shadow-[0_0_24px_rgba(118,80,255,0.6)]" />
          claw42
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
            DISPATCH · 调度台
          </span>
        </div>
        <nav aria-label="Dispatch console mode" className="ml-auto flex flex-wrap gap-2">
          {["Live 实时", "History 历史", "Backtest"].map((item, index) => (
            <button
              key={item}
              type="button"
              className={cx(
                "rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition",
                index === 0
                  ? "border-[var(--coinw-brand-border-strong)] bg-white/[0.05] text-[#d1ff55]"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white",
              )}
            >
              {item}
            </button>
          ))}
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] font-bold text-white/50">
            live · UTC+8
          </div>
        </nav>
      </div>
    </header>
  );
}

function TickerStrip({ tickers }: { tickers: DispatchTicker[] }) {
  return (
    <div className="border-b border-white/10 bg-[#1a1a1a]">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 overflow-hidden px-4 py-3 md:px-8">
        <div className="shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#d1ff55]">
          live feed
        </div>
        <div
          aria-label="Live market ticker strip"
          role="region"
          tabIndex={0}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
        >
          {tickers.map((ticker) => (
            <div
              key={ticker.symbol}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-mono text-xs"
            >
              <span className="font-bold text-white">{ticker.symbol}</span>
              <span className="text-white/62">{ticker.price}</span>
              <span className={ticker.direction === "up" ? "text-[#3bd66f]" : "text-[#ff6f7d]"}>
                {ticker.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DispatchHeader({
  events,
  evidenceMap,
  loading,
}: {
  events: PublicTimelineEvent[];
  evidenceMap: Record<string, NewsEvidence>;
  loading: boolean;
}) {
  const pmDecisionCount = events.filter((event) => event.payload.kind === "pm_decision").length;
  const evidenceCount = Object.keys(evidenceMap).length;

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-white/50">
          AI team · watching SOL / USDT
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
          AI 团队 · 盯盘中
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/58 md:text-base">
          7 名 agent 正在把行情、新闻、链上和社交热点收敛为多策略输出。对话不是附属卡片，
          而是流水线里可见的工作产物。
        </p>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 font-mono text-xs text-white/58">
        <div>
          Session <span className="font-bold text-white">{dispatchConsoleStats.sessionId}</span>
        </div>
        <div>
          Heartbeat{" "}
          <span className="font-bold text-[#d1ff55]">{dispatchConsoleStats.heartbeat}</span> ·
          PM <span className="font-bold text-[#d1ff55]">{pmDecisionCount}</span> · Evidence{" "}
          <span className="font-bold text-[#d1ff55]">{evidenceCount}</span>
        </div>
        <div className="mt-1 text-white/42">{loading ? "syncing timeline..." : "timeline ready"}</div>
      </div>
    </section>
  );
}

export function DispatchConsole({
  events,
  evidenceMap,
  loading,
  marketSnapshot,
}: DispatchConsoleProps) {
  const tickers = useMemo(() => tickersFromMarketSnapshot(marketSnapshot), [marketSnapshot]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <TopBar />
      <TickerStrip tickers={tickers} />
      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 md:px-8">
        <DispatchHeader events={events} evidenceMap={evidenceMap} loading={loading} />
        <p className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3 text-xs leading-relaxed text-white/62">
          风险提示：本页面内容由 AI 根据公开行情数据自动生成，仅用于信息展示，不构成投资建议。
          多策略输出展示团队观点分歧与风险缓冲，不代表必须执行全部策略。
        </p>
      </main>
    </div>
  );
}
