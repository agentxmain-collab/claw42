import React from "react";
import { formatSafeContent } from "@/lib/watch/safeMessageFormatter";
import type { DispatchAgentId, DispatchMessage } from "./types";

const AGENT_AVATAR: Record<DispatchAgentId, { label: string; className: string }> = {
  fundamental_analyst: { label: "F", className: "a-fund" },
  onchain_analyst: { label: "O", className: "a-sent" },
  news_analyst: { label: "N", className: "a-news" },
  technical_analyst: { label: "T", className: "a-tech" },
  bullish_researcher: { label: "↑", className: "a-bull" },
  bearish_researcher: { label: "↓", className: "a-bear" },
  trader: { label: "$", className: "a-trade" },
  aggressive_reviewer: { label: "A", className: "a-aggr" },
  neutral_reviewer: { label: "N", className: "a-neut" },
  conservative_reviewer: { label: "C", className: "a-cons" },
  portfolio_manager: { label: "PM", className: "a-pm" },
  memory_loop: { label: "∞", className: "a-mem" },
};

function MessageBubbleComponent({ message }: { message: DispatchMessage }) {
  const avatar = AGENT_AVATAR[message.agentId];
  const formattedContent = React.useMemo(
    () => formatSafeContent(message.content),
    [message.content],
  );

  return (
    <div className="msg">
      <div className={`msg-avatar ${avatar.className}`} aria-hidden="true">
        {avatar.label}
      </div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-name">{message.agentName}</span>
          {message.mentions.map((mention) => (
            <span className="msg-mention" key={mention}>
              {mention}
            </span>
          ))}
          <span className="msg-time">{message.time}</span>
          {message.dataAge ? <span className="msg-data-age">{message.dataAge}</span> : null}
        </div>
        {message.typing ? (
          <div className="typing" aria-label={`${message.agentName} 正在输入`}>
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="msg-bubble">
            {message.quote ? (
              <div className="msg-quote">
                <span className="q-name">{message.quote.agentName}：</span>
                {message.quote.text}
              </div>
            ) : null}
            <span>{formattedContent}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = React.memo(MessageBubbleComponent);
