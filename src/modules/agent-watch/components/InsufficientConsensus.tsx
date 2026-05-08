"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import type { NewsDebate } from "@/lib/types";
import type { Dict } from "@/i18n/types";

function isEnglish(labels: Dict["agentWatch"]["newsDebate"]) {
  return labels.waitSignal.toLowerCase().includes("wait");
}

export function InsufficientConsensus({
  debate,
  labels,
}: {
  debate: NewsDebate;
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  const english = isEnglish(labels);
  const symbols = debate.newsCurrencies.map((symbol) => `$${symbol}`).join(" / ");
  const agentSummary = debate.messages
    .slice(-3)
    .map((message) => message.content)
    .join(" · ");

  useEffect(() => {
    trackEvent("strategy_synthesis_failed", {
      debate_id: debate.id,
      symbol: debate.newsCurrencies[0] ?? null,
      reason: "strategy_validation_failed_after_retry",
    });
  }, [debate.id, debate.newsCurrencies]);

  return (
    <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-950/[0.12] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs font-bold text-amber-200">
              {labels.waitSignal}
            </span>
            <span className="font-bold text-white">
              {english ? "No clean strategy yet" : "暂不输出策略"}
            </span>
            {symbols && <span className="font-mono text-sm text-white/50">{symbols}</span>}
          </div>
          <p className="text-white/62 mt-2 text-sm leading-relaxed">
            {english
              ? "The agents found a live setup, but the price levels failed validation. Claw42 is holding the strategy card until the entry, stop, and targets line up with live data."
              : "Agent 已发现行情线索，但入场、止损、止盈点位未通过实时价格校验。Claw42 会先隐藏策略卡，等待下一轮更可靠的共识。"}
          </p>
          {agentSummary && (
            <p className="mt-2 text-xs leading-relaxed text-white/45">
              {english ? "Current notes: " : "当前摘要："}
              {agentSummary}
            </p>
          )}
        </div>
        <a
          href="#market-feed"
          className="text-white/72 inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-bold transition hover:border-amber-300/45 hover:text-white"
        >
          {english ? "Keep watching" : "继续观察"}
        </a>
      </div>
    </div>
  );
}
