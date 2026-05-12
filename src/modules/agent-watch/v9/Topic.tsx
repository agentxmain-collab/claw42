import React, { useState } from "react";
import { TopicBody } from "./TopicBody";
import { TopicHead } from "./TopicHead";
import { TopicStrategy } from "./TopicStrategy";
import type { DispatchTopic, DispatchTopicAction } from "./types";

export function Topic({
  topic,
  onPlaceholder,
}: {
  topic: DispatchTopic;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const [collapsed, setCollapsed] = useState(topic.defaultCollapsed);
  const bodyId = `dispatch-topic-${topic.id}`;

  return (
    <article className={`topic ${topic.status}${collapsed ? " collapsed" : ""}`}>
      <TopicHead
        topic={topic}
        bodyId={bodyId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
      />
      <TopicBody topic={topic} bodyId={bodyId} />
      <TopicStrategy topic={topic} onPlaceholder={onPlaceholder} />
    </article>
  );
}
