import { useState } from "react";
import { TopicBody } from "./TopicBody";
import { TopicHead } from "./TopicHead";
import type { DispatchTopic } from "./types";

export function Topic({ topic }: { topic: DispatchTopic }) {
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
    </article>
  );
}
