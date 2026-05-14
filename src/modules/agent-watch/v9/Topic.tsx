import React, { useState } from "react";
import { TopicBody } from "./TopicBody";
import { TopicHead } from "./TopicHead";
import { TopicStrategy } from "./TopicStrategy";
import type { DispatchTopic, DispatchTopicAction } from "./types";

export function Topic({
  topic,
  onPlaceholder,
  latest = false,
}: {
  topic: DispatchTopic;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  latest?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(topic.defaultCollapsed);
  const bodyId = `dispatch-topic-${topic.id}`;

  const topicClassName = [
    "topic",
    topic.status,
    latest ? "latest" : "",
    collapsed ? "collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={topicClassName}>
      <TopicHead
        topic={topic}
        bodyId={bodyId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
      />
      <TopicBody topic={topic} bodyId={bodyId} />
      <TopicStrategy topic={topic} latest={latest} onPlaceholder={onPlaceholder} />
    </article>
  );
}
