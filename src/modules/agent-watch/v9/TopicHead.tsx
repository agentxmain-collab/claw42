import React, { type KeyboardEvent, type MouseEvent } from "react";
import { IntensityBar } from "./IntensityBar";
import type { DispatchTopic } from "./types";

export function isTopicToggleKey(key: string) {
  return key === "Enter" || key === " ";
}

function hasOriginalUrl(value: string | undefined) {
  return Boolean(value && value !== "#");
}

export function TopicHead({
  topic,
  bodyId,
  collapsed,
  onToggle,
}: {
  topic: DispatchTopic;
  bodyId: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  function handleHeadClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a,button")) return;
    onToggle();
  }

  function handleToggleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isTopicToggleKey(event.key)) return;
    event.preventDefault();
    onToggle();
  }

  const liveLabel =
    topic.status === "done" ? "已闭环" : topic.status === "pending" ? "起步中" : "LIVE 辩论";
  const showOriginalLink = hasOriginalUrl(topic.originalUrl);

  return (
    <div className="topic-head" onClick={handleHeadClick}>
      <button
        className="topic-toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        aria-label={`${collapsed ? "展开" : "收起"} ${topic.symbol} 分析`}
        onClick={onToggle}
        onKeyDown={handleToggleKeyDown}
      />
      <div className="topic-eyebrow" aria-live={topic.status === "active" ? "polite" : "off"}>
        <span className="live-tag">{liveLabel}</span>
        <span className="topic-source">
          · {topic.startedAt} 起 · {topic.progress}
        </span>
      </div>
      <h2 id={`${bodyId}-title`} className="topic-title">
        {topic.title}
      </h2>
      {showOriginalLink ? (
        <a
          className="topic-original"
          href={topic.originalUrl}
          onClick={(event) => event.stopPropagation()}
        >
          {topic.sourceLabel ? `原文 · ${topic.sourceLabel}` : "原文"} →
        </a>
      ) : null}
      <div className="topic-meta-row">
        <IntensityBar value={topic.intensity} />
        <div className="trigger">
          <span className="trigger-pill ticker">{topic.trigger.ticker}</span>
          <span className="trigger-text">{topic.trigger.text}</span>
        </div>
      </div>
    </div>
  );
}
