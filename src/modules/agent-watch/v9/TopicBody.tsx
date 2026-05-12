import { MessageBubble } from "./MessageBubble";
import type { DispatchStageMarker, DispatchTopic } from "./types";

function StageMarker({ stage }: { stage: DispatchStageMarker }) {
  const statusClass = stage.status === "done" ? "" : ` ${stage.status}`;

  return (
    <div className={`stage-marker${statusClass}`}>
      <div className="line" />
      <span className="badge">
        {stage.status === "active" ? <span className="dot" aria-hidden="true" /> : null}
        {stage.label}
      </span>
      <div className="line" />
    </div>
  );
}

export function TopicBody({
  topic,
  bodyId,
}: {
  topic: DispatchTopic;
  bodyId: string;
}) {
  return (
    <div
      id={bodyId}
      className="topic-body"
      role="region"
      aria-labelledby={`${bodyId}-title`}
      aria-live={topic.status === "active" ? "polite" : "off"}
    >
      {topic.stages.map((stage) => {
        const stageMessages = topic.messages.filter((message) => message.stageId === stage.id);

        return (
          <div key={stage.id}>
            <StageMarker stage={stage} />
            {stageMessages.map((message) => (
              <MessageBubble message={message} key={message.id} />
            ))}
            {stage.note ? <div className="pending-stub">{stage.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
