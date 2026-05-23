import React from "react";
import type { DispatchV10FollowTradeDict } from "@/i18n/types";
import type { TradingReadinessFailureKind } from "@/lib/coinw/tradeReadinessState";
import type { DispatchTopic, DispatchTopicAction } from "./types";

const DEFAULT_FOLLOW_TRADE_DICT: DispatchV10FollowTradeDict = {
  disabled_label: "演示模式",
  disabled_tooltip: "演示模式：当前不会真实下单",
  safety_copy: "不真实下单 · 后续接入授权和风险确认",
  mock_label: "模拟跟单",
  mock_success: "模拟跟单已成交",
  mock_fail: "模拟跟单失败",
  real_label_future: "跟单",
};

function StrategyValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted" | "warn" | "lime";
}) {
  return (
    <div className="strat-field">
      <span className="lbl">{label}</span>
      <span className={`val${tone ? ` ${tone}` : ""}`}>{value}</span>
    </div>
  );
}

function inferredTradeReadinessKind(
  topic: DispatchTopic,
  canRenderFollowTrade: boolean,
): TradingReadinessFailureKind | null {
  const explicitKind = topic.execution?.tradeReadiness?.states[0]?.kind;
  if (explicitKind) return explicitKind;
  if (canRenderFollowTrade) return null;
  if (topic.execution?.watchOnlyReason) return "instrument_unavailable";
  if ((topic.candidateType ?? "symbol") !== "symbol") return "submission_mode_blocked";
  return "submission_mode_blocked";
}

function looksTruncated(value: string | undefined) {
  if (!value) return false;
  return /(?:…|\.\.\.)\s*$/.test(value.trim());
}

function looksIncompleteSummary(value: string | undefined) {
  if (!value) return false;
  const text = value.trim();
  return (
    looksTruncated(text) ||
    /(?:[0-9]+\.?|[A-Za-z]+|[，,、（(]|若|当|但|而|且|并|将|会|可|为|与|或|对|于)$/.test(text)
  );
}

function normalizedLead(value: string) {
  return value
    .replace(/[，。,.；;：:\s]+$/g, "")
    .replace(/\s+/g, "")
    .slice(0, 24);
}

function fullerObservationCandidate(summary: string, candidates: string[]) {
  const lead = normalizedLead(summary);
  if (lead.length < 8) return null;
  return candidates.find((candidate) => {
    if (candidate.length <= summary.length + 40) return false;
    return candidate.replace(/\s+/g, "").includes(lead);
  });
}

function observationSummaryText(topic: DispatchTopic) {
  const summary = topic.strategy.observationSummary?.trim();
  const candidates = [
    topic.explanation,
    ...topic.messages.map((message) => message.detailedRationale ?? message.content),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const sortedCandidates = [...candidates].sort((a, b) => b.length - a.length);

  if (summary) {
    if (!looksIncompleteSummary(summary)) return summary;
    const fuller = fullerObservationCandidate(summary, sortedCandidates);
    if (fuller) return fuller;
  }

  return sortedCandidates[0] ?? topic.strategy.meta;
}

export function TopicStrategy({
  topic,
  latest = false,
  onPlaceholder,
  followTradeDict = DEFAULT_FOLLOW_TRADE_DICT,
}: {
  topic: DispatchTopic;
  latest?: boolean;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  followTradeDict?: DispatchV10FollowTradeDict;
}) {
  const { strategy } = topic;
  const canRenderFollowTrade =
    (topic.candidateType ?? "symbol") === "symbol" &&
    topic.execution?.watchOnly !== true &&
    topic.execution?.executable !== false;
  const watchOnly = !canRenderFollowTrade;
  const muted = strategy.action === "wait" || strategy.action === "pending" ? "muted" : undefined;
  const followStatus =
    topic.status === "pending"
      ? `${strategy.follow.watchCount} 人订阅提醒`
      : `${strategy.follow.watchCount} 人在看 · ${strategy.follow.followCount} 已跟单`;
  const followNoteId = `${topic.id}-follow-trade-disabled-note`;
  const tradeReadinessKind = inferredTradeReadinessKind(topic, canRenderFollowTrade);
  const isObservationMode = strategy.mode === "observation";

  return (
    <div
      className={["topic-strategy", latest ? "latest" : "", isObservationMode && "observation"]
        .filter(Boolean)
        .join(" ")}
      data-trade-readiness-slot={tradeReadinessKind ? "card-status" : undefined}
      data-trade-readiness-kind={tradeReadinessKind ?? undefined}
    >
      <div className="strat-head">
        <div className="row1">
          {latest ? <span className="strategy-latest-badge">最新策略</span> : null}
          <span className="name">{strategy.name}</span>
          <span className="ticker">{strategy.ticker}</span>
          <span className={`action ${strategy.action}`}>{strategy.actionLabel}</span>
        </div>
        <div className="meta">
          {strategy.meta}
          {strategy.metaHighlight ? (
            <>
              {" "}
              <b className={strategy.metaHighlight.tone}>{strategy.metaHighlight.text}</b>
            </>
          ) : null}
        </div>
      </div>
      {isObservationMode ? (
        <div className="observation-summary">
          <span className="lbl">观察结论</span>
          <p>{observationSummaryText(topic)}</p>
        </div>
      ) : (
        <>
          <StrategyValue label="入场" value={strategy.entry} tone={muted} />
          <StrategyValue label="止损" value={strategy.stopLoss} tone={muted ?? "warn"} />
          <StrategyValue label="止盈" value={strategy.takeProfit} tone={muted ?? "lime"} />
        </>
      )}
      <div className="strat-cta">
        <div className="cta-row">
          {watchOnly ? <span className="watch-only-pill">仅分析 / 不自动下单</span> : null}
          {canRenderFollowTrade ? (
            <button
              className="cta-btn"
              type="button"
              disabled
              title={followTradeDict.disabled_tooltip}
              aria-describedby={followNoteId}
              onClick={() => onPlaceholder(topic, followTradeDict.disabled_label, "primary")}
            >
              {followTradeDict.disabled_label}
            </button>
          ) : null}
          <button
            className="cta-btn secondary"
            type="button"
            onClick={() => onPlaceholder(topic, strategy.follow.secondaryLabel, "secondary")}
          >
            {strategy.follow.secondaryLabel}
          </button>
        </div>
        {tradeReadinessKind ? (
          <span
            hidden
            data-trade-readiness-slot="cta-disabled-reason"
            data-trade-readiness-kind={tradeReadinessKind}
          />
        ) : null}
        <div className="cta-meta" id={followNoteId}>
          {watchOnly
            ? `该卡片用于公开分析和交易跳转，不自动下单。 · ${followStatus}`
            : `${followTradeDict.safety_copy} · ${followStatus}`}
        </div>
      </div>
    </div>
  );
}
