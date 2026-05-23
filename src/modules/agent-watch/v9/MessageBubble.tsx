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

function MessageBubbleComponent({
  message,
  expandLabel = "展开全文",
  collapseLabel = "收起",
}: {
  message: DispatchMessage;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const avatar = AGENT_AVATAR[message.agentId];
  const [expanded, setExpanded] = React.useState(false);
  const formattedContent = React.useMemo(
    () => formatSafeContent(message.content),
    [message.content],
  );
  const formattedSummary = React.useMemo(
    () => formatSafeContent(message.oneLineSummary ?? ""),
    [message.oneLineSummary],
  );
  const hasDecisionLayer = Boolean(
    message.direction || message.confidence !== undefined || message.oneLineSummary,
  );
  const hasExpandableDetail = Boolean(message.oneLineSummary && message.content.trim());
  const detailId = React.useMemo(
    () => `msg-detail-${message.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [message.id],
  );
  const confidencePct =
    typeof message.confidence === "number"
      ? Math.round(Math.max(0, Math.min(1, message.confidence)) * 100)
      : null;

  return (
    <div className="msg">
      <div className={`msg-avatar ${avatar.className}`} aria-hidden="true">
        {avatar.label}
      </div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-name">{message.agentName}</span>
          {message.roundLabel ? <span className="msg-round">{message.roundLabel}</span> : null}
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
            {hasDecisionLayer ? (
              <div className="msg-l1">
                <div className="msg-l1-top">
                  {message.direction ? (
                    <span className={`direction-badge ${message.direction}`}>
                      {message.directionLabel ?? message.direction.toUpperCase()}
                    </span>
                  ) : null}
                  {confidencePct !== null ? (
                    <span className="confidence-meter" aria-label={`Confidence ${confidencePct}%`}>
                      <span className="confidence-track" aria-hidden="true">
                        <span style={{ width: `${confidencePct}%` }} />
                      </span>
                      <b>{confidencePct}%</b>
                    </span>
                  ) : null}
                  {message.roleViewpoint ? (
                    <span className="role-viewpoint">{message.roleViewpoint}</span>
                  ) : null}
                </div>
                {message.oneLineSummary ? (
                  <div className="msg-summary">{formattedSummary}</div>
                ) : null}
              </div>
            ) : null}
            {hasDecisionLayer && hasExpandableDetail ? (
              <button
                className="msg-expand"
                type="button"
                aria-expanded={expanded}
                aria-controls={detailId}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && expanded) {
                    event.preventDefault();
                    setExpanded(false);
                  }
                }}
                onClick={() => setExpanded((value) => !value)}
              >
                <span className="msg-expand-icon" aria-hidden="true" />
                {expanded ? collapseLabel : expandLabel}
              </button>
            ) : null}
            {hasDecisionLayer && hasExpandableDetail && expanded ? (
              <div className="msg-divider" aria-hidden="true" />
            ) : null}
            <span
              id={hasExpandableDetail ? detailId : undefined}
              className={["msg-detail", hasExpandableDetail && !expanded ? "collapsed" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {formattedContent}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = React.memo(MessageBubbleComponent);
