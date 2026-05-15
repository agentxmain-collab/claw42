import React from "react";
import type { DispatchV10FollowTradeDict } from "@/i18n/types";
import { ChatShell } from "./ChatShell";
import { dispatchTopics } from "./fixtureData";
import type { DispatchTopic, DispatchTopicAction } from "./types";

export const MarketAnalysisView = React.memo(function MarketAnalysisView({
  topics,
  onPlaceholder,
  followTradeDict,
}: {
  topics?: DispatchTopic[];
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  followTradeDict?: DispatchV10FollowTradeDict;
}) {
  const resolvedTopics = topics ?? dispatchTopics;

  return (
    <ChatShell
      topics={resolvedTopics}
      onPlaceholder={onPlaceholder}
      followTradeDict={followTradeDict}
    />
  );
});
