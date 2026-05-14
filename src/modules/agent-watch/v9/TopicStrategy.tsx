import React from "react";
import type { DispatchTopic, DispatchTopicAction } from "./types";

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
}: {
  topic: DispatchTopic;
  latest?: boolean;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const { strategy } = topic;
  const muted = strategy.action === "wait" || strategy.action === "pending" ? "muted" : undefined;
  const ctaMeta =
    topic.status === "pending"
      ? `${strategy.follow.watchCount} 人订阅提醒`
      : `${strategy.follow.watchCount} 人在看 · `;

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
          <button
            className="cta-btn"
            type="button"
            disabled={strategy.follow.primaryDisabled}
            onClick={() => onPlaceholder(topic, strategy.follow.primaryLabel, "primary")}
          >
            {strategy.follow.primaryLabel}
          </button>
          <button
            className="cta-btn secondary"
            type="button"
            onClick={() => onPlaceholder(topic, strategy.follow.secondaryLabel, "secondary")}
          >
            {strategy.follow.secondaryLabel}
          </button>
        </div>
        <div className="cta-meta">
          {ctaMeta}
          {topic.status === "pending" ? null : (
            <b>{strategy.follow.expiryNote ?? `${strategy.follow.followCount} 已跟单`}</b>
          )}
        </div>
      </div>
    </div>
  );
}
