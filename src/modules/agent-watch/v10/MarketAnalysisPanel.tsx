"use client";

import React, { useMemo, useState } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { IntensityBar } from "../v9/IntensityBar";
import { TopicBody } from "../v9/TopicBody";
import type { DispatchTopic, DispatchTopicAction, DispatchStageStatus } from "../v9/types";
import v9Styles from "../v9/dispatchConsoleV9.module.css";
import { dispatchV10DemoTopics } from "./demoTopics";
import { v9AgentToV10Role } from "./staticContent";

function ChatShellStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cs-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function normalizeTopicNames(topic: DispatchTopic, roles: DispatchV10Dict["roles"]): DispatchTopic {
  return {
    ...topic,
    messages: topic.messages.map((message) => {
      const role = roles[v9AgentToV10Role[message.agentId]];
      return {
        ...message,
        agentName: role.name,
        quote: message.quote
          ? {
              ...message.quote,
              agentName:
                topic.messages.find(
                  (candidate) => candidate.quote?.agentName === message.quote?.agentName,
                )?.quote?.agentName ?? message.quote.agentName,
            }
          : undefined,
      };
    }),
  };
}

function progressStatus(topic: DispatchTopic, index: number): DispatchStageStatus {
  if (topic.status === "done") return "done";
  const explicitStage = topic.stages[index];
  if (explicitStage) return explicitStage.status;
  if (topic.status === "active" && index === 0) return "active";
  return "pending";
}

function TopicProgress({ topic, dict }: { topic: DispatchTopic; dict: DispatchV10Dict }) {
  return (
    <div className="topic-progress" aria-label={dict.market.progressAriaLabel}>
      {dict.market.progressLabels.map((label, index) => {
        const status = progressStatus(topic, index);
        return (
          <div className={`step ${status}`} key={label}>
            <span className="lbl">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function hasOriginalUrl(topic: DispatchTopic) {
  return Boolean(topic.originalUrl && topic.originalUrl !== "#");
}

function TopicHeadV10({
  topic,
  bodyId,
  collapsed,
  onToggle,
  dict,
}: {
  topic: DispatchTopic;
  bodyId: string;
  collapsed: boolean;
  onToggle: () => void;
  dict: DispatchV10Dict;
}) {
  const liveLabel =
    topic.status === "done"
      ? dict.market.statusDone
      : topic.status === "pending"
        ? dict.market.statusPending
        : dict.market.statusActive;

  return (
    <div
      className="topic-head"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        onToggle();
      }}
    >
      <button
        className="topic-toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        aria-label={`${collapsed ? dict.market.expand : dict.market.collapse} ${topic.symbol}`}
        onClick={onToggle}
      />
      <div className="topic-eyebrow" aria-live={topic.status === "active" ? "polite" : "off"}>
        <span className="live-tag">{liveLabel}</span>
        <span className="topic-source">
          · {topic.startedAt} · {topic.progress}
        </span>
      </div>
      <h2 id={`${bodyId}-title`} className="topic-title">
        {topic.title}
      </h2>
      {hasOriginalUrl(topic) ? (
        <a
          className="topic-original"
          href={topic.originalUrl}
          onClick={(event) => event.stopPropagation()}
        >
          {dict.market.original}
        </a>
      ) : null}
      <div className="topic-meta-row">
        <IntensityBar value={topic.intensity} />
        <div className="trigger">
          <span className="trigger-pill ticker">{topic.trigger.ticker}</span>
          <span className="trigger-text">{topic.trigger.text}</span>
        </div>
      </div>
      <TopicProgress topic={topic} dict={dict} />
    </div>
  );
}

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

function TopicStrategyV10({
  topic,
  latest,
  dict,
  onPlaceholder,
}: {
  topic: DispatchTopic;
  latest: boolean;
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const { strategy } = topic;
  const muted = strategy.action === "wait" || strategy.action === "pending" ? "muted" : undefined;
  const ctaMeta =
    topic.status === "pending"
      ? `${strategy.follow.watchCount} ${dict.market.watchReminder}`
      : `${strategy.follow.watchCount} ${dict.market.watchCount} · `;

  return (
    <div className={["topic-strategy", latest && "latest"].filter(Boolean).join(" ")}>
      <div className="strat-head">
        <div className="row1">
          {latest ? (
            <span className="strategy-latest-badge">{dict.market.latestStrategy}</span>
          ) : null}
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
      <StrategyValue label={dict.market.entry} value={strategy.entry} tone={muted} />
      <StrategyValue
        label={dict.market.stopLoss}
        value={strategy.stopLoss}
        tone={muted ?? "warn"}
      />
      <StrategyValue
        label={dict.market.takeProfit}
        value={strategy.takeProfit}
        tone={muted ?? "lime"}
      />
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
            <b>
              {strategy.follow.expiryNote ??
                `${strategy.follow.followCount} ${dict.market.followed}`}
            </b>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicCardV10({
  topic,
  latest,
  dict,
  onPlaceholder,
}: {
  topic: DispatchTopic;
  latest: boolean;
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const [collapsed, setCollapsed] = useState(topic.defaultCollapsed);
  const bodyId = `dispatch-v10-topic-${topic.id}`;
  const topicClassName = ["topic", topic.status, latest && "latest", collapsed && "collapsed"]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={topicClassName}>
      <TopicHeadV10
        topic={topic}
        bodyId={bodyId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
        dict={dict}
      />
      <TopicBody topic={topic} bodyId={bodyId} />
      <TopicStrategyV10 topic={topic} latest={latest} dict={dict} onPlaceholder={onPlaceholder} />
    </article>
  );
}

export function MarketAnalysisPanel({
  topics,
  dict,
  onPlaceholder,
}: {
  topics?: DispatchTopic[];
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const resolvedTopics = useMemo(
    () =>
      (topics && topics.length > 0 ? topics : dispatchV10DemoTopics).map((topic) =>
        normalizeTopicNames(topic, dict.roles),
      ),
    [dict.roles, topics],
  );
  const doneCount = resolvedTopics.filter((topic) => topic.status === "done").length;
  const activeCount = resolvedTopics.filter((topic) => topic.status === "active").length;
  const pendingCount = resolvedTopics.filter((topic) => topic.status === "pending").length;

  return (
    <div className={v9Styles.root}>
      <section className="chat-shell" aria-label={dict.market.ariaLabel}>
        <div className="chat-shell-head">
          <div className="cs-head-left">
            <div className="cs-icon" aria-hidden="true">
              ●
            </div>
            <div className="cs-icon-info">
              <div className="cs-title">{dict.market.title}</div>
              <div className="cs-sub">{dict.market.subtitle}</div>
            </div>
          </div>
          <div className="cs-head-right" aria-label={dict.market.statsAriaLabel}>
            <ChatShellStat label={dict.market.hot} value={resolvedTopics.length} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.closed} value={doneCount} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.debating} value={activeCount} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.started} value={pendingCount} />
          </div>
        </div>

        <div className="chat-shell-body">
          {resolvedTopics.length === 0 ? (
            <div className="topic-empty" role="status">
              {dict.market.empty}
            </div>
          ) : (
            resolvedTopics.map((topic, index) => (
              <div key={topic.id}>
                <TopicCardV10
                  topic={topic}
                  latest={index === 0}
                  dict={dict}
                  onPlaceholder={onPlaceholder}
                />
                {index < resolvedTopics.length - 1 ? (
                  <div className="topic-separator" aria-hidden="true">
                    <span className="topic-separator-dot" />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
