"use client";

import { useEffect } from "react";
import type { Dict } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import type { ChatThread, NewsDebate } from "@/lib/types";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { FinalStrategyBlock } from "./FinalStrategyBlock";
import { InsufficientConsensus } from "./InsufficientConsensus";
import { SeedChip } from "./SeedChip";

export function ChatThreadRenderer({
  thread,
  debate,
  labels,
}: {
  thread: ChatThread;
  debate?: NewsDebate;
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  useEffect(() => {
    trackEvent("chat_thread_view", {
      thread_id: thread.id,
      seed_type: thread.seed.type,
      message_count: thread.messages.length,
    });
  }, [thread.id, thread.messages.length, thread.seed.type]);

  return (
    <section className="space-y-2">
      <SeedChip thread={thread} />
      {thread.messages.map((message, index) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          previousMessage={thread.messages[index - 1]}
          history={thread.messages}
        />
      ))}

      {debate &&
        (thread.strategy ? (
          <FinalStrategyBlock strategy={thread.strategy} labels={labels} />
        ) : (
          <InsufficientConsensus debate={debate} labels={labels} />
        ))}
    </section>
  );
}
