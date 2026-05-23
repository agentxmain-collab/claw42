"use client";

import React from "react";
import { formatSafeContent } from "@/lib/watch/safeMessageFormatter";
import type { DispatchAgentId, DispatchMessage } from "./types";

export interface MessageBubbleLabels {
  expand: string;
  collapse: string;
}

const DEFAULT_MESSAGE_LABELS: MessageBubbleLabels = {
  expand: "展开全文",
  collapse: "收起",
};

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

const COLLAPSED_SUMMARY_MAX_CHARS = 60;

function firstSentenceBoundary(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char || !"。！？!?；;.".includes(char)) continue;
    if (char === "." && /\d/.test(value[index - 1] ?? "") && /\d/.test(value[index + 1] ?? "")) {
      continue;
    }
    return index;
  }

  return -1;
}

function compactCollapsedSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= COLLAPSED_SUMMARY_MAX_CHARS) {
    return { text: normalized, truncated: false };
  }

  const firstSentenceEnd = firstSentenceBoundary(normalized);
  if (firstSentenceEnd > 0) {
    const firstSentence = normalized.slice(0, firstSentenceEnd + 1).trim();
    if (firstSentence.length <= COLLAPSED_SUMMARY_MAX_CHARS) {
      return { text: firstSentence, truncated: firstSentence.length < normalized.length };
    }
  }

  const text = normalized
    .slice(0, COLLAPSED_SUMMARY_MAX_CHARS)
    .replace(/[.。…，,、；;：:\s-]+$/g, "")
    .trim();

  return { text: `${text}...`, truncated: text.length < normalized.length };
}

function MessageBubbleComponent({
  message,
  labels = DEFAULT_MESSAGE_LABELS,
}: {
  message: DispatchMessage;
  labels?: MessageBubbleLabels;
}) {
  const avatar = AGENT_AVATAR[message.agentId];
  const [collapsed, setCollapsed] = React.useState(true);
  const rawDetailText = message.content.trim();
  const summaryText = message.oneLineSummary?.trim() ?? "";
  const compactSummaryText = React.useMemo(
    () => compactCollapsedSummary(summaryText || rawDetailText),
    [rawDetailText, summaryText],
  );
  const standaloneDetailText = rawDetailText || summaryText;
  const shouldCompactRawDetail = Boolean(!summaryText && compactSummaryText.truncated);
  const formattedContent = React.useMemo(
    () => formatSafeContent(standaloneDetailText),
    [standaloneDetailText],
  );
  const formattedSummary = React.useMemo(
    () => formatSafeContent(compactSummaryText.text),
    [compactSummaryText.text],
  );
  const hasDecisionLayer = Boolean(
    message.direction || message.confidence !== undefined || summaryText || shouldCompactRawDetail,
  );
  const hasExpandableDetail = Boolean(
    standaloneDetailText &&
      (compactSummaryText.truncated || (summaryText && standaloneDetailText !== summaryText)),
  );
  const expanded = hasExpandableDetail && !collapsed;
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
                {summaryText || shouldCompactRawDetail ? (
                  <div className="msg-summary">
                    <span hidden={expanded && hasExpandableDetail}>{formattedSummary}</span>
                    {hasExpandableDetail ? (
                      <span id={detailId} hidden={!expanded} className="msg-detail">
                        {formattedContent}
                      </span>
                    ) : null}
                  </div>
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
                    setCollapsed(true);
                  }
                }}
                onClick={() => setCollapsed((value) => !value)}
              >
                <span className="msg-expand-icon" aria-hidden="true" />
                {expanded ? labels.collapse : labels.expand}
              </button>
            ) : null}
            {!hasExpandableDetail && !summaryText && !shouldCompactRawDetail ? (
              <span className="msg-detail">{formattedContent}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = React.memo(MessageBubbleComponent);
