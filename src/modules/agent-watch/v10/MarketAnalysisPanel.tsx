"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import { buildCoinWFuturesTradeUrl } from "@/lib/coinw/futuresLinks";
import { canRenderTradeCTA } from "@/lib/coinw/tradeGate";
import { shouldBypassFreshnessForTrade } from "@/lib/team/freshnessStatus";
import type { TradingReadinessFailureKind } from "@/lib/coinw/tradeReadinessState";
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
import { CoreRobot } from "./CoreRobot";
import { InlineAvatarSvg, type InlineAvatarName } from "./InlineAvatarSvg";
import { v9AgentToV10Role } from "./staticContent";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const TOPIC_PAGE_SIZE = 15;

function ChatShellStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cs-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function MarketPanelAvatar({ name, className }: { name: InlineAvatarName; className: string }) {
  return (
    <span className={`market-panel-avatar ${className}`} aria-hidden="true">
      <InlineAvatarSvg className="market-panel-avatar-img" name={name} />
    </span>
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

function topicHeadAvatarName(topic: DispatchTopic): InlineAvatarName {
  const candidateType = topicCandidateType(topic);
  if (candidateType === "market_overview") return "portfolioManager";
  if (candidateType === "hotspot") return "news";
  return "technical";
}

function strategyAvatarName(topic: DispatchTopic): InlineAvatarName {
  if (topicCandidateType(topic) !== "symbol") return "portfolioManager";
  if (topic.strategy.action === "short") return "bearish";
  if (topic.strategy.action === "long") return "bullish";
  return "trader";
}

function inferredTradeReadinessKind(
  topic: DispatchTopic,
  canRenderFollowTrade: boolean,
): TradingReadinessFailureKind | null {
  const explicitKind = topic.execution?.tradeReadiness?.states[0]?.kind;
  if (explicitKind) return explicitKind;
  if (canRenderFollowTrade) return null;
  if (topic.execution?.watchOnlyReason) return "instrument_unavailable";
  if (topicCandidateType(topic) !== "symbol") return "submission_mode_blocked";
  return "submission_mode_blocked";
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
  return [...topics].sort((left, right) => {
    const leftRank = left.topicRanking?.rank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.topicRanking?.rank ?? Number.POSITIVE_INFINITY;
    const rankDelta = leftRank - rightRank;
    if (rankDelta !== 0) return rankDelta;
    return compareDecisionCandidateOrder(topicOrderKey(left), topicOrderKey(right));
  });
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

function TopicRankingInline({ topic }: { topic: DispatchTopic }) {
  const ranking = topic.topicRanking;
  if (!ranking) return null;

  return (
    <span className="topic-ranking" data-topic-ranking-score={ranking.score}>
      <span className="topic-ranking-label">{ranking.rankLabel}</span>
    </span>
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

function isStaleOrExpired(topic: DispatchTopic) {
  if (shouldBypassFreshnessForTrade(topic.strategy.action)) return false;
  return topic.freshnessStatus?.level === "stale" || topic.freshnessStatus?.level === "expired";
}

function freshnessForTrade(topic: DispatchTopic) {
  return shouldBypassFreshnessForTrade(topic.strategy.action) ? undefined : topic.freshnessStatus;
}

function formatCardFreshnessAge(topic: DispatchTopic, dict: DispatchV10Dict) {
  const ageMinutes = topic.freshnessStatus?.ageMinutes;
  if (typeof ageMinutes !== "number") return null;
  if (ageMinutes >= 60) {
    const hours = Math.max(1, Math.floor(ageMinutes / 60));
    return `${dict.market.staleAgePrefix} ${hours} 小时前`;
  }
  return `${dict.market.staleAgePrefix} ${ageMinutes} 分钟前`;
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
  const freshnessAge = formatCardFreshnessAge(topic, dict);
  const staleAge = isStaleOrExpired(topic);

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
        <TopicRankingInline topic={topic} />
        {freshnessAge ? (
          <span className={["topic-age", staleAge && "stale"].filter(Boolean).join(" ")}>
            {freshnessAge}
          </span>
        ) : null}
      </div>
      <div className="topic-title-row">
        <MarketPanelAvatar className="topic-head-avatar" name={topicHeadAvatarName(topic)} />
        <h2 id={`${bodyId}-title`} className="topic-title">
          {topic.title}
        </h2>
      </div>
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

function plainCardText(value: string | undefined) {
  return (value ?? "")
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function directionTone(action: DispatchTopic["strategy"]["action"]) {
  if (action === "long") return "long";
  if (action === "short") return "short";
  return "wait";
}

function directionText(action: DispatchTopic["strategy"]["action"]) {
  if (action === "long") return "LONG";
  if (action === "short") return "SHORT";
  return "WAIT";
}

function directionByline(topic: DispatchTopic, observationMode: boolean) {
  if (topic.strategy.action === "long") {
    return `${observationMode ? "观察分析" : "多空双向分析"} · 多方占优`;
  }
  if (topic.strategy.action === "short") {
    return `${observationMode ? "观察分析" : "多空双向分析"} · 空方占优`;
  }
  return `${observationMode ? "观察分析" : "多空双向分析"} · 等待确认`;
}

function directionIcon(action: DispatchTopic["strategy"]["action"]) {
  if (action === "long") return "↑";
  if (action === "short") return "↓";
  return "•";
}

function allocationText(strategy: DispatchTopic["strategy"]) {
  const fromAction = strategy.actionLabel.match(/(\d+(?:\.\d+)?)%/);
  if (fromAction) return `${fromAction[1]}%`;
  const fromMeta = strategy.meta.match(/(\d+(?:\.\d+)?)%/);
  if (fromMeta) return `${fromMeta[1]}%`;
  return "待定";
}

function messageSearchText(message: DispatchTopic["messages"][number]) {
  return `${message.agentId} ${message.agentName} ${message.roleViewpoint ?? ""} ${message.direction ?? ""} ${message.directionLabel ?? ""} ${message.content}`;
}

function findReasoningMessage(
  topic: DispatchTopic,
  predicate: (message: DispatchTopic["messages"][number], searchText: string) => boolean,
) {
  return topic.messages.find((message) => {
    const content = plainCardText(message.content);
    if (!content) return false;
    return predicate(message, messageSearchText(message));
  });
}

function topicReasoningSections(topic: DispatchTopic) {
  const sections: Array<{ key: string; label: string; text: string }> = [];
  const used = new Set<string>();
  const add = (key: string, label: string, text: string | undefined) => {
    const clean = plainCardText(text);
    if (!clean || used.has(clean)) return;
    used.add(clean);
    sections.push({ key, label, text: clean });
  };

  const bull = findReasoningMessage(
    topic,
    (message, searchText) =>
      message.direction === "long" || /多头|多方|bullish|bull/i.test(searchText),
  );
  const bear = findReasoningMessage(
    topic,
    (message, searchText) =>
      message.direction === "short" || /空头|空方|bearish|bear/i.test(searchText),
  );
  const trade = findReasoningMessage(
    topic,
    (message, searchText) =>
      message.agentId === "trader" || /交易|执行|入场|方案/i.test(searchText),
  );
  const risk = findReasoningMessage(
    topic,
    (message, searchText) =>
      message.agentId === "aggressive_reviewer" ||
      message.agentId === "neutral_reviewer" ||
      message.agentId === "conservative_reviewer" ||
      /风险|审查|防守|中立|组合|risk/i.test(searchText),
  );

  add("bull", "多方观点", bull?.content);
  add("bear", "空方观点", bear?.content);
  add("trade", "交易方案", trade?.content);
  add("risk", "风险审查", risk?.content);
  add("strategy", "策略摘要", topic.strategy.observationSummary ?? topic.explanation);
  add("trigger", "触发依据", topic.trigger.text);

  return sections.slice(0, 4);
}

function primaryReasoning(
  topic: DispatchTopic,
  sections: ReturnType<typeof topicReasoningSections>,
) {
  const preferredKey =
    topic.strategy.action === "long" ? "bull" : topic.strategy.action === "short" ? "bear" : "risk";
  return (
    sections.find((section) => section.key === preferredKey) ??
    sections.find((section) => section.key === "risk") ??
    sections[0]
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
  collapsed,
  bodyId,
  onToggle,
  dict,
  onPlaceholder,
  feedbackValue,
  onFeedback,
}: {
  topic: DispatchTopic;
  latest: boolean;
  collapsed: boolean;
  bodyId: string;
  onToggle: () => void;
  dict: DispatchV10Dict;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  feedbackValue?: TopicFeedbackValue;
  onFeedback: (topic: DispatchTopic, value: TopicFeedbackValue) => void;
}) {
  const { strategy } = topic;
  const candidateType = topicCandidateType(topic);
  const isObservationMode =
    strategy.mode === "observation" ||
    candidateType === "market_overview" ||
    candidateType === "hotspot";
  const executableSymbol = candidateType === "symbol" && topic.execution?.executable === true;
  const canRenderCoinWTrade = canRenderTradeCTA({
    externalNavigationEnabled: true,
    executable: executableSymbol,
    readinessStates: topic.execution?.tradeReadiness?.states,
    freshness: freshnessForTrade(topic),
  });
  const renderBlockedTradeCTA = executableSymbol && !canRenderCoinWTrade;
  const renderStaleReason = renderBlockedTradeCTA && isStaleOrExpired(topic);
  const followStatus =
    topic.status === "pending"
      ? `${strategy.follow.watchCount} ${dict.market.watchReminder}`
      : `${strategy.follow.watchCount} ${dict.market.watchCount} · ${strategy.follow.followCount} ${dict.market.followed}`;
  const coinwFuturesUrl =
    isObservationMode || !canRenderCoinWTrade
      ? buildCoinWFuturesTradeUrl({ coinwPair: null })
      : (topic.execution?.tradeUrl ??
        buildCoinWFuturesTradeUrl({
          coinwPair: topic.execution?.coinwPair,
        }));
  const tradeReadinessKind = inferredTradeReadinessKind(topic, canRenderCoinWTrade);
  const coinwLinkType = canRenderCoinWTrade && topic.execution?.coinwPair ? "pair" : "generic";
  const newsItem = topic.newsItems?.[0];
  const reasoningSections = topicReasoningSections(topic);
  const mainReasoning = primaryReasoning(topic, reasoningSections);
  const tone = directionTone(strategy.action);
  const byline = directionByline(topic, isObservationMode);
  const cardHeadline = plainCardText(newsItem?.headline) || dict.market.noNews;
  const progressLabel = topic.progress || topic.startedAt;

  return (
    <div
      className={[
        "topic-strategy",
        "topic-card-v3",
        `v3-${tone}`,
        latest && "latest",
        isObservationMode && "observation",
      ]
        .filter(Boolean)
        .join(" ")}
      data-topic-card-v3="true"
      data-trade-readiness-slot={tradeReadinessKind ? "card-status" : undefined}
      data-trade-readiness-kind={tradeReadinessKind ?? undefined}
    >
      <div className="v3-accent" aria-hidden="true" />
      <div className="v3-inner">
        <div className="v3-news-hero">
          <div className="v3-news-kicker">决策源</div>
          {newsItem?.url ? (
            <a
              className="v3-news-headline"
              href={newsItem.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {cardHeadline}
            </a>
          ) : (
            <div className="v3-news-headline">{cardHeadline}</div>
          )}
          <div className="v3-news-meta">
            {newsItem ? (
              <>
                <span>{newsItem.source}</span>
                {newsItem.observedAt ? <span>{newsItem.observedAt}</span> : null}
              </>
            ) : (
              <span>{dict.market.noNews}</span>
            )}
            <span>{topic.trigger.ticker}</span>
          </div>
        </div>

        <div className="v3-head">
          <MarketPanelAvatar className="v3-avatar" name={strategyAvatarName(topic)} />
          <div className="v3-title-block">
            <div className="v3-title-row">
              {latest ? (
                <span className="strategy-latest-badge">{dict.market.latestStrategy}</span>
              ) : null}
              <span className="v3-ticker">{strategy.ticker}</span>
              <span className={`v3-direction-chip ${tone}`}>
                <span aria-hidden="true">{directionIcon(strategy.action)}</span>
                {directionText(strategy.action)}
              </span>
            </div>
            <h3>{topic.title}</h3>
            <p>{byline}</p>
          </div>
          <div className="v3-progress-chip">{progressLabel}</div>
        </div>

        <div className="v3-body">
          <div className="v3-matrix" aria-label="交易方案">
            {isObservationMode ? (
              <div className="v3-cell v3-cell-wide observation-summary">
                <span className="v3-cell-label">{dict.market.observationSummaryLabel}</span>
                <strong>{plainCardText(strategy.observationSummary) || cardHeadline}</strong>
              </div>
            ) : (
              <>
                <div className="v3-cell">
                  <span className="v3-cell-label">{dict.market.entry}</span>
                  <strong>{strategy.entry}</strong>
                </div>
                <div className="v3-cell">
                  <span className="v3-cell-label">{dict.market.stopLoss}</span>
                  <strong className="warn">{strategy.stopLoss}</strong>
                </div>
                <div className="v3-cell">
                  <span className="v3-cell-label">{dict.market.takeProfit}</span>
                  <strong className="lime">{strategy.takeProfit}</strong>
                </div>
                <div className="v3-cell">
                  <span className="v3-cell-label">仓位</span>
                  <strong>{allocationText(strategy)}</strong>
                </div>
              </>
            )}
          </div>

          <div className="v3-cta-stack">
            {isObservationMode ? (
              <a
                className="v3-mega-cta"
                href={coinwFuturesUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  trackEvent("coinw_trade_cta_click", {
                    topicId: topic.id,
                    candidateType,
                    candidateKey: topic.candidateKey ?? null,
                    symbol: topic.symbol,
                    linkType: "generic",
                    executable: false,
                  });
                }}
              >
                {dict.market.coinwNavigate}
              </a>
            ) : canRenderCoinWTrade ? (
              <a
                className="v3-mega-cta"
                href={coinwFuturesUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  trackEvent("coinw_trade_cta_click", {
                    topicId: topic.id,
                    candidateType,
                    candidateKey: topic.candidateKey ?? null,
                    symbol: topic.symbol,
                    linkType: coinwLinkType,
                    executable: true,
                  });
                }}
              >
                {dict.market.coinwFuturesLink}
              </a>
            ) : renderBlockedTradeCTA ? (
              <button className="v3-mega-cta disabled" type="button" disabled>
                {dict.market.coinwFuturesLink}
              </button>
            ) : (
              <button
                className="v3-mega-cta"
                type="button"
                onClick={() => onPlaceholder(topic, dict.market.coinwFuturesLink, "primary")}
              >
                {dict.market.coinwFuturesLink}
              </button>
            )}
            <span className="v3-follow-meta">{followStatus}</span>
            {renderStaleReason ? (
              <span className="cta-visible-reason">{dict.market.staleReason}</span>
            ) : null}
          </div>
        </div>

        <div className="v3-reason-row">
          <section className="v3-reasoning" aria-label="核心推理">
            <span className="v3-section-label">核心推理</span>
            <strong>{mainReasoning?.label ?? byline}</strong>
            <p>{mainReasoning?.text ?? plainCardText(strategy.meta)}</p>
          </section>
          <button
            className="v3-secondary"
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            <span className="v3-section-label">
              {collapsed ? "查看完整推理链" : "收起完整推理链"}
            </span>
            <strong>{byline}</strong>
            <span>
              {reasoningSections.map((section) => section.label).join(" / ") || strategy.name}
            </span>
          </button>
        </div>

        {tradeReadinessKind ? (
          <span
            hidden
            data-trade-readiness-slot="cta-disabled-reason"
            data-trade-readiness-kind={tradeReadinessKind}
          />
        ) : null}
        <div className="v3-analysis-meta">
          {isObservationMode ? dict.market.analysisOnlyCopy : strategy.meta}
          {strategy.metaHighlight ? (
            <>
              {" "}
              <b className={strategy.metaHighlight.tone}>{strategy.metaHighlight.text}</b>
            </>
          ) : null}
        </div>
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
    topic.freshnessStatus && `freshness-${topic.freshnessStatus.level}`,
    latest && "latest",
    collapsed && "collapsed",
    !collapsed && "expanded",
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
      <TopicBody topic={topic} bodyId={bodyId} messageLabels={dict.message} />
      <TopicStrategyV10
        topic={topic}
        latest={latest}
        collapsed={collapsed}
        bodyId={bodyId}
        onToggle={onToggle}
        dict={dict}
        onPlaceholder={onPlaceholder}
        feedbackValue={feedbackValue}
        onFeedback={onFeedback}
      />
    </article>
  );
}

function TopicPagination({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const previousDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= pageCount;
  return (
    <nav className="topic-pagination" aria-label="Topic pagination">
      <button
        type="button"
        disabled={previousDisabled}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        ‹
      </button>
      <span>
        {currentPage}/{pageCount}
      </span>
      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
      >
        ›
      </button>
    </nav>
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
    return orderTopicsByRanking(normalizedTopics).filter(
      (topic) => topicCandidateType(topic) === "symbol",
    );
  }, [dict.roles, topics]);
  const [collapsedByTopicId, setCollapsedByTopicId] = useState<TopicCollapseState>({});
  const [feedbackByTopicId, setFeedbackByTopicId] = useState<TopicFeedbackState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<ScrollAnchor>({ topicId: null, offset: 0, scrollTop: 0 });
  const pageCount = Math.max(1, Math.ceil(resolvedTopics.length / TOPIC_PAGE_SIZE));
  const visibleTopics = useMemo(() => {
    const pageStart = (currentPage - 1) * TOPIC_PAGE_SIZE;
    return resolvedTopics.slice(pageStart, pageStart + TOPIC_PAGE_SIZE);
  }, [currentPage, resolvedTopics]);
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

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), pageCount));
  }, [pageCount]);

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
              <CoreRobot className="workbench-core-robot" />
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
            <>
              {visibleTopics.map((topic, index) => {
                const topicIdentity = topicDisplayIdentity(topic);
                return (
                  <div key={topicIdentity} data-topic-card-id={topicIdentity}>
                    <TopicCardV10
                      topic={topic}
                      latest={(currentPage - 1) * TOPIC_PAGE_SIZE + index === 0}
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
                    {index < visibleTopics.length - 1 ? (
                      <div className="topic-separator" aria-hidden="true">
                        <span className="topic-separator-dot" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <TopicPagination
                currentPage={currentPage}
                pageCount={pageCount}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
