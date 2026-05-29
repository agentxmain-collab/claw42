import React from "react";
import type { DispatchV10FollowTradeDict } from "@/i18n/types";
import { Topic } from "./Topic";
import type { DispatchTopic, DispatchTopicAction } from "./types";

function displayRank(topic: DispatchTopic) {
  if (typeof topic.topicRanking?.rank === "number") return topic.topicRanking.rank;
  const match = topic.topicRanking?.rankLabel.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
}

function sortTopicsForRender(topics: DispatchTopic[]) {
  return [...topics].sort((a, b) => {
    const rankDelta = displayRank(a) - displayRank(b);
    if (rankDelta !== 0) return rankDelta;
    const timeDelta = (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0);
    if (timeDelta !== 0) return timeDelta;
    return a.id.localeCompare(b.id);
  });
}

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
  followTradeDict,
}: {
  topics: DispatchTopic[];
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  followTradeDict?: DispatchV10FollowTradeDict;
}) {
  const doneCount = topics.filter((topic) => topic.status === "done").length;
  const activeCount = topics.filter((topic) => topic.status === "active").length;
  const pendingCount = topics.filter((topic) => topic.status === "pending").length;
  const orderedTopics = sortTopicsForRender(topics);

  return (
    <section className="chat-shell" aria-label="AI 团队工作台">
      <div className="chat-shell-head">
        <div className="cs-head-left">
          <div className="cs-icon" aria-hidden="true">
            ●
          </div>
          <div className="cs-icon-info">
            <div className="cs-title">AI 团队工作台</div>
            <div className="cs-sub">实时交易决策流 · 自动更新</div>
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
        {orderedTopics.length === 0 ? (
          <div className="topic-empty" role="status">
            暂无决策更新
          </div>
        ) : (
          orderedTopics.map((topic, index) => (
            <div key={topic.id}>
              <Topic
                topic={topic}
                latest={index === 0}
                onPlaceholder={onPlaceholder}
                followTradeDict={followTradeDict}
              />
              {index < orderedTopics.length - 1 ? (
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
