"use client";

import { useMemo, useState } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { MarketTickerPayload } from "./types";
import {
  dispatchAgents,
  dispatchConsoleStats,
  dispatchSources,
  dispatchTickers,
  pipelineChatMessages,
  strategyVotes,
  type DispatchAgent,
  type DispatchAgentState,
  type DispatchSource,
  type DispatchTicker,
  type VoteDirection,
} from "./dispatchConsoleData";

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

const stateClasses: Record<DispatchAgentState, string> = {
  idle: "border-white/10 bg-white/[0.04] text-white/58",
  analyzing: "border-[var(--coinw-brand-border-strong)] bg-[var(--coinw-brand-glow-soft)] text-[#b7a4ff]",
  done: "border-[#d1ff55]/40 bg-[#d1ff55]/10 text-[#d1ff55]",
};

const voteLabel: Record<VoteDirection, string> = {
  long: "多",
  short: "空",
  wait: "观",
  agree: "同意",
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-white/62">
      {children}
    </p>
  );
}

function Panel({
  children,
  className,
  labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cx(
        "rounded-[24px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function StatusBadge({ state }: { state: DispatchAgentState }) {
  const label = state === "idle" ? "idle" : state === "analyzing" ? "analyzing" : "done";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
        stateClasses[state],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SourceCard({ source }: { source: DispatchSource }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--coinw-brand-border-soft)] bg-white/[0.05] font-mono text-xs font-black text-[#d1ff55]">
          {source.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-white">{source.label}</h3>
            <StatusBadge state={source.state} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/62">{source.meta}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-white/56">
        {source.packets.map((packet) => (
          <li key={packet} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#d1ff55]" />
            <span>{packet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AgentAvatar({ agent }: { agent: DispatchAgent }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--coinw-brand-border-soft)] bg-[radial-gradient(circle_at_30%_20%,rgba(209,255,85,0.18),rgba(118,80,255,0.22)_42%,rgba(255,255,255,0.05)_100%)] font-mono text-sm font-black text-white shadow-[0_0_30px_rgba(118,80,255,0.22)]">
      {agent.initials}
    </div>
  );
}

function AgentCard({
  agent,
  selectedStrategyId,
  selected,
  onSelect,
}: {
  agent: DispatchAgent;
  selectedStrategyId: string | null;
  selected: boolean;
  onSelect: (agentId: string) => void;
}) {
  const votes = selectedStrategyId
    ? strategyVotes.filter(
        (vote) => vote.strategyId === selectedStrategyId && vote.agentId === agent.id,
      )
    : [];

  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      aria-expanded={selected}
      className={cx(
        "w-full rounded-2xl border bg-[#1a1a1a] p-4 text-left transition duration-300",
        selected
          ? "border-[var(--coinw-brand-border-strong)] shadow-[0_0_0_1px_rgba(118,80,255,0.34),0_20px_70px_rgba(118,80,255,0.16)]"
          : votes.length > 0
            ? "border-[var(--coinw-brand-border-soft)]"
            : "border-white/10 hover:border-[var(--coinw-brand-border-soft)]",
      )}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar agent={agent} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white">{agent.name}</h3>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/62">
                {agent.role} · {agent.englishRole}
              </p>
            </div>
            <StatusBadge state={agent.state} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/58">{agent.capability}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
            当前任务
          </div>
          <p className="mt-1 text-xs text-white/56">{agent.task}</p>
        </div>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
            输出
          </div>
          <p className="mt-1 text-xs text-white/56">{agent.outputs.join(" / ")}</p>
        </div>
      </div>
      {votes.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--coinw-brand-border-soft)] bg-white/[0.05] p-3">
          {votes.map((vote) => (
            <p
              key={`${vote.strategyId}-${vote.agentId}`}
              className="text-xs leading-relaxed text-white/58"
            >
              <span className="font-mono font-bold text-[#d1ff55]">{voteLabel[vote.vote]}</span>{" "}
              {vote.view}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

function PipelineBus() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 1200 720" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dispatchBusLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(209,255,85,0.08)" />
            <stop offset="45%" stopColor="rgba(118,80,255,0.42)" />
            <stop offset="100%" stopColor="rgba(209,255,85,0.16)" />
          </linearGradient>
        </defs>
        <path
          d="M180 120 C360 120 360 170 520 170 C720 170 720 245 925 245"
          fill="none"
          stroke="url(#dispatchBusLine)"
          strokeWidth="1.5"
        />
        <path
          d="M180 360 C360 360 370 420 520 420 C720 420 725 475 925 475"
          fill="none"
          stroke="url(#dispatchBusLine)"
          strokeWidth="1.5"
        />
        <circle r="4" fill="#d1ff55">
          <animateMotion
            dur="5.2s"
            repeatCount="indefinite"
            path="M180 120 C360 120 360 170 520 170 C720 170 720 245 925 245"
          />
        </circle>
        <circle r="4" fill="var(--coinw-brand-hex)">
          <animateMotion
            dur="6.1s"
            repeatCount="indefinite"
            path="M180 360 C360 360 370 420 520 420 C720 420 725 475 925 475"
          />
        </circle>
      </svg>
    </div>
  );
}

function PipelineChat() {
  const names = useMemo(() => new Map(dispatchAgents.map((agent) => [agent.id, agent.name])), []);
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#1a1a1a] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionEyebrow>团队对话 · 节点之间</SectionEyebrow>
        <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#d1ff55]">
          live debate
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {pipelineChatMessages.slice(0, 4).map((message) => (
          <article
            key={message.id}
            className="rounded-2xl border border-white/10 bg-white/[0.05] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-[11px] font-bold text-[#d1ff55]">
                {names.get(message.who) ?? message.who}
                {message.to ? (
                  <span className="text-white/62"> → {names.get(message.to) ?? message.to}</span>
                ) : null}
              </div>
              <span className="font-mono text-[10px] uppercase text-white/42">
                {message.kind ?? "note"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{message.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function AgentDrawer({
  agent,
  onClose,
}: {
  agent: DispatchAgent;
  onClose: () => void;
}) {
  return (
    <aside className="rounded-[24px] border border-[var(--coinw-brand-border-soft)] bg-[#141414] p-5 shadow-[0_22px_90px_rgba(118,80,255,0.15)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AgentAvatar agent={agent} />
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#d1ff55]">
              selected node
            </p>
            <h3 className="mt-1 text-2xl font-black text-white">{agent.name}</h3>
            <p className="mt-1 text-sm text-white/58">
              {agent.role} · {agent.englishRole}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[11px] font-bold text-white/58 transition hover:text-white"
        >
          close
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DrawerBlock label="方法" items={agent.methods} />
        <DrawerBlock label="输入" items={agent.inputs} />
        <DrawerBlock label="输出" items={agent.outputs} />
      </div>
    </aside>
  );
}

function DrawerBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
        {label}
      </div>
      <ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/60">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--coinw-brand-hex)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkflowPipeline({ selectedStrategyId }: { selectedStrategyId: string | null }) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const analysts = dispatchAgents.filter((agent) => agent.stage === "analyst");
  const leads = dispatchAgents.filter((agent) => agent.stage === "lead");
  const pm = dispatchAgents.find((agent) => agent.stage === "pm");
  const selectedAgent = dispatchAgents.find((agent) => agent.id === selectedAgentId) ?? null;

  return (
    <Panel labelledBy="dispatch-workflow-title" className="relative overflow-hidden">
      <PipelineBus />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionEyebrow>7 协作流水线 · Workflow Bus</SectionEyebrow>
            <h2 id="dispatch-workflow-title" className="mt-2 text-2xl font-black text-white">
              输入 → 分析师 → 负责人 → PM
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {(["idle", "analyzing", "done"] as const).map((state) => (
              <StatusBadge key={state} state={state} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_1fr]">
          <div className="space-y-3">
            <SectionEyebrow>1 · Inputs</SectionEyebrow>
            {dispatchSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
          <div className="space-y-3">
            <SectionEyebrow>2 · Analysts</SectionEyebrow>
            {analysts.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selectedStrategyId={selectedStrategyId}
                selected={selectedAgentId === agent.id}
                onSelect={(agentId) =>
                  setSelectedAgentId((current) => (current === agentId ? null : agentId))
                }
              />
            ))}
          </div>
          <div className="space-y-3">
            <SectionEyebrow>3 · Leads / Decision</SectionEyebrow>
            {leads.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selectedStrategyId={selectedStrategyId}
                selected={selectedAgentId === agent.id}
                onSelect={(agentId) =>
                  setSelectedAgentId((current) => (current === agentId ? null : agentId))
                }
              />
            ))}
            {pm ? (
              <AgentCard
                agent={pm}
                selectedStrategyId={selectedStrategyId}
                selected={selectedAgentId === pm.id}
                onSelect={(agentId) =>
                  setSelectedAgentId((current) => (current === agentId ? null : agentId))
                }
              />
            ) : null}
          </div>
        </div>

        {selectedAgent ? (
          <AgentDrawer agent={selectedAgent} onClose={() => setSelectedAgentId(null)} />
        ) : null}
        <PipelineChat />
      </div>
    </Panel>
  );
}

export function DispatchConsole({
  events,
  evidenceMap,
  loading,
  marketSnapshot,
}: DispatchConsoleProps) {
  const tickers = useMemo(() => tickersFromMarketSnapshot(marketSnapshot), [marketSnapshot]);
  const [selectedStrategyId] = useState<string | null>("s2");

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <TopBar />
      <TickerStrip tickers={tickers} />
      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 md:px-8">
        <DispatchHeader events={events} evidenceMap={evidenceMap} loading={loading} />
        <WorkflowPipeline selectedStrategyId={selectedStrategyId} />
        <p className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3 text-xs leading-relaxed text-white/62">
          风险提示：本页面内容由 AI 根据公开行情数据自动生成，仅用于信息展示，不构成投资建议。
          多策略输出展示团队观点分歧与风险缓冲，不代表必须执行全部策略。
        </p>
      </main>
    </div>
  );
}
