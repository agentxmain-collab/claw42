import React from "react";
import { ChatShell } from "./ChatShell";
import { dispatchTopics } from "./fixtureData";
import type { DispatchTopic, DispatchTopicAction } from "./types";

export const MarketAnalysisView = React.memo(function MarketAnalysisView({
  topics,
  onPlaceholder,
}: {
  topics?: DispatchTopic[];
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
}) {
  const resolvedTopics = topics ?? dispatchTopics;

  return <ChatShell topics={resolvedTopics} onPlaceholder={onPlaceholder} />;
});
