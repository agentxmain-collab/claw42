import React from "react";
import { Topic } from "./Topic";
import type { DispatchTopic, DispatchTopicAction } from "./types";

function ChatShellStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cs-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export const ChatShell = React.memo(function ChatShell({
  topics,
  onPlaceholder,
}: {
  topics: DispatchTopic[];
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const doneCount = topics.filter((topic) => topic.status === "done").length;
  const activeCount = topics.filter((topic) => topic.status === "active").length;
  const pendingCount = topics.filter((topic) => topic.status === "pending").length;

  return (
    <section className="chat-shell" aria-label="AI 团队工作台">
      <div className="chat-shell-head">
        <div className="cs-head-left">
          <div className="cs-icon" aria-hidden="true">
            ●
          </div>
          <div className="cs-icon-info">
            <div className="cs-title">AI 团队工作台</div>
            <div className="cs-sub">claw42 TopicGenerator · session #cs-19:31</div>
          </div>
        </div>
        <div className="cs-head-right" aria-label="Topic status summary">
          <ChatShellStat label="热点" value={topics.length} />
          <div className="cs-divider" />
          <ChatShellStat label="已闭环" value={doneCount} />
          <div className="cs-divider" />
          <ChatShellStat label="辩论中" value={activeCount} />
          <div className="cs-divider" />
          <ChatShellStat label="起步" value={pendingCount} />
        </div>
      </div>

      <div className="chat-shell-body">
        {topics.length === 0 ? (
          <div className="topic-empty" role="status">
            暂无符合公开展示条件的真实 PM 决策
          </div>
        ) : (
          topics.map((topic, index) => (
            <div key={topic.id}>
              <Topic topic={topic} onPlaceholder={onPlaceholder} />
              {index < topics.length - 1 ? (
                <div className="topic-separator" aria-hidden="true">
                  <span className="topic-separator-dot" />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
});
