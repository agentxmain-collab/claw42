import React from "react";
import type { DispatchV10FollowTradeDict } from "@/i18n/types";
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

  return (
    <div className={["topic-strategy", latest ? "latest" : ""].filter(Boolean).join(" ")}>
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
      <StrategyValue label="入场" value={strategy.entry} tone={muted} />
      <StrategyValue label="止损" value={strategy.stopLoss} tone={muted ?? "warn"} />
      <StrategyValue label="止盈" value={strategy.takeProfit} tone={muted ?? "lime"} />
      <div className="strat-cta">
        <div className="cta-row">
          {watchOnly ? <span className="watch-only-pill">watch-only / 不可跟单</span> : null}
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
        <div className="cta-meta" id={followNoteId}>
          {watchOnly
            ? `该币种暂不支持 CoinW 跟单，仅展示观察分析。 · ${followStatus}`
            : `${followTradeDict.safety_copy} · ${followStatus}`}
        </div>
      </div>
    </div>
  );
}
