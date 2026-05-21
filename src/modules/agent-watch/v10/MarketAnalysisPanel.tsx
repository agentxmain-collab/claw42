"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import { buildCoinWFuturesTradeUrl } from "@/lib/coinw/futuresLinks";
import {
  compareDecisionCandidateOrder,
  normalizeCandidateType,
  type CandidateType,
} from "@/lib/watch/decisionCandidate";
import { IntensityBar } from "../v9/IntensityBar";
import { TopicBody } from "../v9/TopicBody";
import type {
  DispatchFreshnessState,
  DispatchTopic,
  DispatchTopicAction,
  DispatchStageStatus,
} from "../v9/types";
import v9Styles from "../v9/dispatchConsoleV9.module.css";
import { v9AgentToV10Role } from "./staticContent";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function ChatShellStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cs-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function formatFreshnessText(freshness: DispatchFreshnessState | undefined, dict: DispatchV10Dict) {
  if (!freshness) return null;
  const residentText = formatResidentPrewarmText(freshness, dict);
  if (residentText) return residentText;
  if (freshness.status === "idle") return null;
  if (freshness.status === "refreshing" || freshness.refreshStarted) {
    return `${dict.market.newAnalysisRunning} · ${dict.market.autoRefreshOnComplete}`;
  }
  if (freshness.lastDecisionAt) {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - Date.parse(freshness.lastDecisionAt)) / 60_000),
    );
    return `${dict.market.cachedStateLabel} · ${dict.market.analyzedAgo.replace(
      "{minutes}",
      String(minutes),
    )}`;
  }
  if (freshness.status === "no_signal") return dict.market.cachedStateLabel;
  return null;
}

function formatResidentPrewarmText(freshness: DispatchFreshnessState, dict: DispatchV10Dict) {
  const status = freshness.residentStatus;
  if (!status) return null;
  if (status.overallState === "running") {
    return `${dict.market.residentUpdating} · ${dict.market.autoRefreshOnComplete}`;
  }
  if (status.overallState === "queued") {
    return `${dict.market.residentQueued} · ${dict.market.autoRefreshOnComplete}`;
  }
  if (status.overallState === "failed") {
    return `${dict.market.residentUpdateIssue} · ${dict.market.residentCacheFallback}`;
  }
  if (status.latestSucceededAt) {
    const minutes = Math.max(
      0,
      Math.round((status.servedAt - Date.parse(status.latestSucceededAt)) / 60_000),
    );
    return `${dict.market.residentCachedState} · ${dict.market.analyzedAgo.replace(
      "{minutes}",
      String(minutes),
    )}`;
  }
  return null;
}

function normalizeTopicNames(topic: DispatchTopic, roles: DispatchV10Dict["roles"]): DispatchTopic {
  return {
    ...topic,
    messages: topic.messages.map((message) => {
      const role = roles[v9AgentToV10Role[message.agentId]];
      return {
        ...message,
        agentName: role.name,
        quote: message.quote
          ? {
              ...message.quote,
              agentName:
                topic.messages.find(
                  (candidate) => candidate.quote?.agentName === message.quote?.agentName,
                )?.quote?.agentName ?? message.quote.agentName,
            }
          : undefined,
      };
    }),
  };
}

function progressStatus(topic: DispatchTopic, index: number): DispatchStageStatus {
  if (topic.status === "done") return "done";
  const explicitStage = topic.stages[index];
  if (explicitStage) return explicitStage.status;
  if (topic.status === "active" && index === 0) return "active";
  return "pending";
}

function TopicProgress({ topic, dict }: { topic: DispatchTopic; dict: DispatchV10Dict }) {
  return (
    <div className="topic-progress" aria-label={dict.market.progressAriaLabel}>
      {dict.market.progressLabels.map((label, index) => {
        const status = progressStatus(topic, index);
        return (
          <div className={`step ${status}`} key={label}>
            <span className="lbl">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const CANDIDATE_CLASS: Record<CandidateType, string> = {
  symbol: "candidate-symbol",
  market_overview: "candidate-market-overview",
  hotspot: "candidate-hotspot",
};

function topicCandidateType(topic: DispatchTopic) {
  return normalizeCandidateType(topic.candidateType);
}

function topicCandidateClass(topic: DispatchTopic) {
  return CANDIDATE_CLASS[topicCandidateType(topic)];
}

function topicOrderKey(topic: DispatchTopic) {
  return {
    candidateType: topic.candidateType,
    candidateKey: topic.candidateKey ?? topic.symbol,
    recordId: topic.id,
    symbol: topic.symbol,
    score: topic.topicRanking?.score,
    lastUpdatedAt: topic.lastUpdatedAt,
  };
}

function orderTopicsByRanking(topics: DispatchTopic[]) {
  return [...topics].sort((left, right) =>
    compareDecisionCandidateOrder(topicOrderKey(left), topicOrderKey(right)),
  );
}

export function topicDisplayIdentity(topic: DispatchTopic) {
  const candidateType = topicCandidateType(topic);
  const candidateKey = topic.candidateKey?.trim();
  const symbol = topic.symbol?.trim().replace(/^\$+/, "").toUpperCase();
  if (candidateType === "symbol" && symbol) return `symbol:${symbol}`;
  if (candidateKey) return `${candidateType}:${candidateKey}`;
  if (symbol) return `${candidateType}:${symbol}`;
  return `record:${topic.id}`;
}

type TopicCollapseState = Record<string, boolean>;
type TopicFeedbackValue = "helpful" | "not_helpful";
type TopicFeedbackState = Record<string, TopicFeedbackValue>;

export function reconcileTopicCollapseState(
  topics: DispatchTopic[],
  current: TopicCollapseState,
): TopicCollapseState {
  let changed = false;
  const next: TopicCollapseState = {};

  for (const topic of topics) {
    const identity = topicDisplayIdentity(topic);
    if (Object.prototype.hasOwnProperty.call(current, identity)) {
      next[identity] = current[identity];
    } else {
      next[identity] = topic.defaultCollapsed;
      changed = true;
    }
  }

  for (const topicId of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(next, topicId)) {
      changed = true;
      break;
    }
  }

  return changed ? next : current;
}

export function toggleTopicCollapseState(
  current: TopicCollapseState,
  topicId: string,
  fallbackCollapsed: boolean,
): TopicCollapseState {
  return {
    ...current,
    [topicId]: !(current[topicId] ?? fallbackCollapsed),
  };
}

interface ScrollAnchor {
  topicId: string | null;
  offset: number;
  scrollTop: number;
}

function readScrollAnchor(body: HTMLElement): ScrollAnchor {
  const cards = Array.from(body.querySelectorAll<HTMLElement>("[data-topic-card-id]"));
  const scrollTop = body.scrollTop;
  const anchor =
    cards.find((card) => card.offsetTop + card.offsetHeight > scrollTop + 1) ?? cards[0] ?? null;

  if (!anchor) {
    return { topicId: null, offset: 0, scrollTop };
  }

  return {
    topicId: anchor.dataset.topicCardId ?? null,
    offset: anchor.offsetTop - scrollTop,
    scrollTop,
  };
}

function restoreScrollAnchor(body: HTMLElement, anchor: ScrollAnchor) {
  if (anchor.topicId) {
    const escapedTopicId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(anchor.topicId)
        : anchor.topicId.replace(/["\\]/g, "\\$&");
    const nextAnchor = body.querySelector<HTMLElement>(`[data-topic-card-id="${escapedTopicId}"]`);
    if (nextAnchor) {
      body.scrollTop = Math.max(0, nextAnchor.offsetTop - anchor.offset);
      return;
    }
  }
  body.scrollTop = Math.min(anchor.scrollTop, Math.max(0, body.scrollHeight - body.clientHeight));
}

function TopicRankingV10({ topic }: { topic: DispatchTopic }) {
  const ranking = topic.topicRanking;
  if (!ranking) return null;

  return (
    <div className="topic-ranking" data-topic-ranking-score={ranking.score}>
      <span className="topic-ranking-label">{ranking.rankLabel}</span>
    </div>
  );
}

function hasOriginalUrl(topic: DispatchTopic) {
  return Boolean(topic.originalUrl && topic.originalUrl !== "#");
}

function TopicCandidateBadge({ topic, dict }: { topic: DispatchTopic; dict: DispatchV10Dict }) {
  const candidateType = topicCandidateType(topic);
  if (candidateType === "symbol") return null;

  return (
    <span className={`candidate-type-badge ${topicCandidateClass(topic)}`}>
      {dict.market.candidateBadges[candidateType]}
    </span>
  );
}

function TopicHeadV10({
  topic,
  bodyId,
  collapsed,
  onToggle,
  dict,
}: {
  topic: DispatchTopic;
  bodyId: string;
  collapsed: boolean;
  onToggle: () => void;
  dict: DispatchV10Dict;
}) {
  const toggleLabel = topic.displayTitle || topic.title || topic.symbol;
  const liveLabel =
    topic.status === "done"
      ? dict.market.statusDone
      : topic.status === "pending"
        ? dict.market.statusPending
        : dict.market.statusActive;

  return (
    <div
      className="topic-head"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        onToggle();
      }}
    >
      <button
        className="topic-toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        aria-label={`${collapsed ? dict.market.expand : dict.market.collapse} ${toggleLabel}`}
        onClick={onToggle}
      />
      <div className="topic-eyebrow" aria-live={topic.status === "active" ? "polite" : "off"}>
        <span className="live-tag">{liveLabel}</span>
        <TopicCandidateBadge topic={topic} dict={dict} />
        <span className="topic-source">
          · {topic.startedAt} · {topic.progress}
        </span>
      </div>
      <h2 id={`${bodyId}-title`} className="topic-title">
        {topic.title}
      </h2>
      {topic.explanation ? (
        <p className={["topic-explanation", collapsed && "collapsed"].filter(Boolean).join(" ")}>
          {topic.explanation}
        </p>
      ) : null}
      {hasOriginalUrl(topic) ? (
        <a
          className="topic-original"
          href={topic.originalUrl}
          onClick={(event) => event.stopPropagation()}
        >
          {dict.market.original}
        </a>
      ) : null}
      <div className="topic-meta-row">
        <IntensityBar value={topic.intensity} />
        <div className="trigger">
          <span className="trigger-pill ticker">{topic.trigger.ticker}</span>
          <span className="trigger-text">{topic.trigger.text}</span>
        </div>
      </div>
      <TopicProgress topic={topic} dict={dict} />
    </div>
  );
}

function StrategyValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted" | "warn" | "lime";
}) {
  return (
    <div className="strat-field">
      <span className="lbl">{label}</span>
      <span className={`val${tone ? ` ${tone}` : ""}`}>{value}</span>
    </div>
  );
}

function topicFeedbackLabel(topic: DispatchTopic) {
  const symbol = topic.symbol?.trim().replace(/^\$+/, "").toUpperCase();
  return symbol || topic.candidateKey || topicDisplayIdentity(topic);
}

function TopicFeedback({
  topic,
  dict,
  value,
  onFeedback,
}: {
  topic: DispatchTopic;
  dict: DispatchV10Dict;
  value?: TopicFeedbackValue;
  onFeedback: (topic: DispatchTopic, value: TopicFeedbackValue) => void;
}) {
  const feedbackTopic = topicFeedbackLabel(topic);

  return (
    <div
      className="topic-feedback"
      data-feedback-topic={feedbackTopic}
      aria-label={dict.market.feedbackAriaLabel}
    >
      <span className="topic-feedback-label">
        {value ? dict.market.feedbackThanks : dict.market.feedbackPrompt}
      </span>
      <div className="topic-feedback-actions">
        <button
          className={["topic-feedback-btn", value === "helpful" && "active"]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={value === "helpful"}
          onClick={() => onFeedback(topic, "helpful")}
        >
          {dict.market.feedbackHelpful}
        </button>
        <button
          className={["topic-feedback-btn", value === "not_helpful" && "active"]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={value === "not_helpful"}
          onClick={() => onFeedback(topic, "not_helpful")}
        >
          {dict.market.feedbackNotHelpful}
        </button>
      </div>
    </div>
  );
}

function TopicStrategyV10({
  topic,
  latest,
  dict,
  onPlaceholder,
  feedbackValue,
  onFeedback,
}: {
  topic: DispatchTopic;
  latest: boolean;
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  feedbackValue?: TopicFeedbackValue;
  onFeedback: (topic: DispatchTopic, value: TopicFeedbackValue) => void;
}) {
  const { strategy } = topic;
  const candidateType = topicCandidateType(topic);
  const canRenderFollowTrade = candidateType === "symbol" && topic.execution?.executable === true;
  const muted = strategy.action === "wait" || strategy.action === "pending" ? "muted" : undefined;
  const followStatus =
    topic.status === "pending"
      ? `${strategy.follow.watchCount} ${dict.market.watchReminder}`
      : `${strategy.follow.watchCount} ${dict.market.watchCount} · ${strategy.follow.followCount} ${dict.market.followed}`;
  const coinwFuturesUrl =
    topic.execution?.tradeUrl ??
    buildCoinWFuturesTradeUrl({
      coinwPair: canRenderFollowTrade ? topic.execution?.coinwPair : null,
    });

  return (
    <div className={["topic-strategy", latest && "latest"].filter(Boolean).join(" ")}>
      <div className="strat-head">
        <div className="row1">
          {latest ? (
            <span className="strategy-latest-badge">{dict.market.latestStrategy}</span>
          ) : null}
          <span className="name">{strategy.name}</span>
          <span className="ticker">{strategy.ticker}</span>
          <span className={`action ${strategy.action}`}>{strategy.actionLabel}</span>
        </div>
        <div className="meta">
          {strategy.meta}
          {strategy.metaHighlight ? (
            <>
              {" "}
              <b className={strategy.metaHighlight.tone}>{strategy.metaHighlight.text}</b>
            </>
          ) : null}
        </div>
      </div>
      <StrategyValue label={dict.market.entry} value={strategy.entry} tone={muted} />
      <StrategyValue
        label={dict.market.stopLoss}
        value={strategy.stopLoss}
        tone={muted ?? "warn"}
      />
      <StrategyValue
        label={dict.market.takeProfit}
        value={strategy.takeProfit}
        tone={muted ?? "lime"}
      />
      <div className="strat-cta">
        <div className="cta-row">
          <a
            className="cta-btn"
            href={coinwFuturesUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {dict.market.coinwFuturesLink}
          </a>
          <button
            className="cta-btn secondary"
            type="button"
            onClick={() => onPlaceholder(topic, strategy.follow.secondaryLabel, "secondary")}
          >
            {strategy.follow.secondaryLabel}
          </button>
        </div>
        <div className="cta-meta">{followStatus}</div>
        <TopicFeedback topic={topic} dict={dict} value={feedbackValue} onFeedback={onFeedback} />
      </div>
    </div>
  );
}

function TopicCardV10({
  topic,
  latest,
  collapsed,
  onToggle,
  dict,
  onPlaceholder,
  feedbackValue,
  onFeedback,
}: {
  topic: DispatchTopic;
  latest: boolean;
  collapsed: boolean;
  onToggle: () => void;
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  feedbackValue?: TopicFeedbackValue;
  onFeedback: (topic: DispatchTopic, value: TopicFeedbackValue) => void;
}) {
  const bodyId = `dispatch-v10-topic-${topic.id}`;
  const topicClassName = [
    "topic",
    topic.status,
    topicCandidateClass(topic),
    latest && "latest",
    collapsed && "collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={topicClassName}>
      <TopicHeadV10
        topic={topic}
        bodyId={bodyId}
        collapsed={collapsed}
        onToggle={onToggle}
        dict={dict}
      />
      <TopicBody topic={topic} bodyId={bodyId} />
      <TopicStrategyV10
        topic={topic}
        latest={latest}
        dict={dict}
        onPlaceholder={onPlaceholder}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      />
      <TopicRankingV10 topic={topic} />
    </article>
  );
}

export function MarketAnalysisPanel({
  topics,
  dict,
  onPlaceholder,
  freshness,
}: {
  topics?: DispatchTopic[];
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  freshness?: DispatchFreshnessState;
}) {
  const resolvedTopics = useMemo(() => {
    const normalizedTopics = (topics ?? []).map((topic) => normalizeTopicNames(topic, dict.roles));
    return orderTopicsByRanking(normalizedTopics);
  }, [dict.roles, topics]);
  const [collapsedByTopicId, setCollapsedByTopicId] = useState<TopicCollapseState>({});
  const [feedbackByTopicId, setFeedbackByTopicId] = useState<TopicFeedbackState>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<ScrollAnchor>({ topicId: null, offset: 0, scrollTop: 0 });
  const topicOrderSignature = resolvedTopics.map(topicDisplayIdentity).join("|");
  const doneCount = resolvedTopics.filter((topic) => topic.status === "done").length;
  const activeCount = resolvedTopics.filter((topic) => topic.status === "active").length;
  const pendingCount = resolvedTopics.filter((topic) => topic.status === "pending").length;
  const hotspotCount = resolvedTopics.filter(
    (topic) => topicCandidateType(topic) === "hotspot",
  ).length;
  const freshnessText = formatFreshnessText(freshness, dict);
  const handleFeedback = useCallback((topic: DispatchTopic, value: TopicFeedbackValue) => {
    const topicIdentity = topicDisplayIdentity(topic);
    setFeedbackByTopicId((current) => ({ ...current, [topicIdentity]: value }));
    trackEvent("watch_topic_feedback", {
      topicId: topic.id,
      topicIdentity,
      candidateType: topicCandidateType(topic),
      candidateKey: topic.candidateKey ?? null,
      symbol: topic.symbol ?? null,
      feedback: value,
    });
  }, []);

  useEffect(() => {
    setCollapsedByTopicId((current) => reconcileTopicCollapseState(resolvedTopics, current));
  }, [resolvedTopics]);

  useIsomorphicLayoutEffect(() => {
    const body = bodyRef.current;
    if (body) restoreScrollAnchor(body, scrollAnchorRef.current);
    return () => {
      if (bodyRef.current) {
        scrollAnchorRef.current = readScrollAnchor(bodyRef.current);
      }
    };
  }, [topicOrderSignature]);

  return (
    <div className={`${v9Styles.root} v10-market-root`}>
      <section className="chat-shell" aria-label={dict.market.ariaLabel}>
        <div className="chat-shell-head">
          <div className="cs-head-left">
            <div className="cs-icon" aria-hidden="true">
              ●
            </div>
            <div className="cs-icon-info">
              <div className="cs-title">{dict.market.title}</div>
              <div className="cs-sub">{dict.market.subtitle}</div>
              {freshnessText ? <div className="cs-freshness">{freshnessText}</div> : null}
            </div>
          </div>
          <div className="cs-head-right" aria-label={dict.market.statsAriaLabel}>
            <ChatShellStat label={dict.market.hot} value={hotspotCount} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.closed} value={doneCount} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.debating} value={activeCount} />
            <div className="cs-divider" />
            <ChatShellStat label={dict.market.started} value={pendingCount} />
          </div>
        </div>

        <div
          className="chat-shell-body"
          ref={bodyRef}
          onScroll={(event) => {
            scrollAnchorRef.current = readScrollAnchor(event.currentTarget);
          }}
        >
          {resolvedTopics.length === 0 ? (
            <div className="topic-empty" role="status">
              <span className="topic-empty-icon" aria-hidden="true">
                ○
              </span>
              <span className="topic-empty-label">NO DATA</span>
              <span className="topic-empty-text">{dict.market.empty}</span>
            </div>
          ) : (
            resolvedTopics.map((topic, index) => {
              const topicIdentity = topicDisplayIdentity(topic);
              return (
                <div key={topicIdentity} data-topic-card-id={topicIdentity}>
                  <TopicCardV10
                    topic={topic}
                    latest={index === 0}
                    collapsed={collapsedByTopicId[topicIdentity] ?? topic.defaultCollapsed}
                    onToggle={() => {
                      setCollapsedByTopicId((current) =>
                        toggleTopicCollapseState(current, topicIdentity, topic.defaultCollapsed),
                      );
                    }}
                    dict={dict}
                    onPlaceholder={onPlaceholder}
                    feedbackValue={feedbackByTopicId[topicIdentity]}
                    onFeedback={handleFeedback}
                  />
                  {index < resolvedTopics.length - 1 ? (
                    <div className="topic-separator" aria-hidden="true">
                      <span className="topic-separator-dot" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
