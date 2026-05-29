"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DispatchV10Dict, Locale } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import { buildCoinWFuturesTradeUrl, normalizeCoinWFuturesPair } from "@/lib/coinw/futuresLinks";
import { canRenderTradeCTA } from "@/lib/coinw/tradeGate";
import { shouldBypassFreshnessForTrade } from "@/lib/team/freshnessStatus";
import type { TradingReadinessFailureKind } from "@/lib/coinw/tradeReadinessState";
import {
  compareDecisionCandidateOrder,
  normalizeCandidateType,
  type CandidateType,
} from "@/lib/watch/decisionCandidate";
import { TopicBody } from "../v9/TopicBody";
import type {
  DispatchFreshnessState,
  DispatchTopic,
  DispatchTopicAction,
  DispatchTopicPaginationState,
  DispatchStageStatus,
} from "../v9/types";
import v9Styles from "../v9/dispatchConsoleV9.module.css";
import { CoreRobot } from "./CoreRobot";
import { InlineAvatarSvg, type InlineAvatarName } from "./InlineAvatarSvg";
import { v9AgentToV10Role } from "./staticContent";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  if (freshness.lastDecisionAt || freshness.status === "no_signal") return null;
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
  if (status.latestSucceededAt) return null;
  return null;
}

function fallbackCoinwPairForTopic(topic: DispatchTopic) {
  return (
    normalizeCoinWFuturesPair(topic.execution?.coinwPair) ??
    normalizeCoinWFuturesPair(`${topic.symbol}_USDT`)
  );
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

  return <span aria-hidden="true" hidden data-topic-ranking-score={ranking.score} />;
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

function StrategyLifecycleBadge({ topic }: { topic: DispatchTopic }) {
  const completed = Boolean((topic as DispatchTopic & { resolvedAt?: string | null }).resolvedAt);
  return (
    <span className={["strategy-lifecycle-badge", completed ? "completed" : "tracking"].join(" ")}>
      {completed ? "完成" : "追踪"}
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
        <StrategyLifecycleBadge topic={topic} />
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

function splitTickerTitle(topic: DispatchTopic) {
  const ticker = (topic.strategy.ticker || topic.trigger.ticker || topic.symbol || "")
    .replace(/^\$+/, "")
    .toUpperCase();
  const normalizedTitle = topic.displayTitle || topic.title || `${ticker} 实时行情分析`;
  const rest =
    normalizedTitle.replace(new RegExp(`^\\$?${ticker}\\s*`, "i"), "").trim() || "实时行情分析";
  return { ticker, rest };
}

function highlightedHeadline(text: string) {
  const parts = text.split(/(\$?\d[\d,.]*(?:\.\d+)?\s*(?:%|K|M|B|USD|USDT)?)/gi);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <em key={`${part}-${index}`}>{part}</em>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

function parseFirstNumber(value: string | undefined) {
  const match = value?.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEntryReference(value: string | undefined) {
  const matches = value?.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const values = matches
    .map((match) => Number(match.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value));
  if (values.length >= 2) return (values[0]! + values[1]!) / 2;
  return values[0] ?? null;
}

function formatDeltaPct(
  reference: number | null,
  target: number | null,
  action: DispatchTopic["strategy"]["action"],
) {
  if (!reference || !target || action === "pending") return "等待确认";
  const raw = ((target - reference) / reference) * 100;
  return `${raw >= 0 ? "+" : ""}${raw.toFixed(2)}%`;
}

function matrixSubtexts(strategy: DispatchTopic["strategy"]) {
  const entryReference = parseEntryReference(strategy.entry);
  const stop = parseFirstNumber(strategy.stopLoss);
  const takeProfit = parseFirstNumber(strategy.takeProfit);
  return {
    current: entryReference ? `当前围绕 ${strategy.entry}` : "当前待确认",
    stop: formatDeltaPct(entryReference, stop, strategy.action),
    takeProfit: formatDeltaPct(entryReference, takeProfit, strategy.action),
  };
}

function reasoningParagraphs(
  topic: DispatchTopic,
  sections: ReturnType<typeof topicReasoningSections>,
  mainReasoning: ReturnType<typeof primaryReasoning>,
) {
  const trade = sections.find((section) => section.key === "trade");
  const risk = sections.find((section) => section.key === "risk");
  const first =
    mainReasoning?.text ||
    topic.strategy.observationSummary ||
    topic.explanation ||
    topic.trigger.text ||
    topic.strategy.meta;
  const second =
    trade?.text ||
    risk?.text ||
    `入场 ${topic.strategy.entry}，止损 ${topic.strategy.stopLoss}，止盈 ${topic.strategy.takeProfit}；若失效条件触发则撤销本轮方案。`;
  const secondWithLevels = /\d/.test(second)
    ? second
    : `${second} 入场 ${topic.strategy.entry}，止损 ${topic.strategy.stopLoss}，止盈 ${topic.strategy.takeProfit}。`;
  return [first, secondWithLevels].filter(Boolean).slice(0, 2);
}

function emphasizeReasoning(text: string, index: number) {
  const priceMatch = text.match(/\d[\d,]*(?:\.\d+)?\s*(?:%|K|M|B|USD|USDT)?/i);
  if (!priceMatch) return text;
  const before = text.slice(0, priceMatch.index);
  const after = text.slice((priceMatch.index ?? 0) + priceMatch[0].length);
  return (
    <>
      {before}
      {index === 0 ? (
        <b className="v3-reason-hl">{priceMatch[0]}</b>
      ) : (
        <code className="v3-reason-code">{priceMatch[0]}</code>
      )}
      {after}
    </>
  );
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

function TopicStrategyV10({
  topic,
  latest,
  collapsed,
  bodyId,
  onToggle,
  dict,
  locale,
  onPlaceholder,
}: {
  topic: DispatchTopic;
  latest: boolean;
  collapsed: boolean;
  bodyId: string;
  onToggle: () => void;
  dict: DispatchV10Dict;
  locale: Locale;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
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
  const coinwPair = canRenderCoinWTrade ? fallbackCoinwPairForTopic(topic) : null;
  const coinwFuturesUrl =
    isObservationMode || !canRenderCoinWTrade
      ? buildCoinWFuturesTradeUrl({ coinwPair: null, locale })
      : (topic.execution?.tradeUrl ??
        buildCoinWFuturesTradeUrl({
          coinwPair,
          locale,
        }));
  const tradeReadinessKind = inferredTradeReadinessKind(topic, canRenderCoinWTrade);
  const coinwLinkType = canRenderCoinWTrade && coinwPair ? "pair" : "generic";
  const newsItem = topic.newsItems?.[0];
  const reasoningSections = topicReasoningSections(topic);
  const mainReasoning = primaryReasoning(topic, reasoningSections);
  const tone = directionTone(strategy.action);
  const visualTone = tone === "long" ? "long" : "short";
  const byline = directionByline(topic, isObservationMode);
  const cardHeadline = plainCardText(newsItem?.headline) || dict.market.noNews;
  const progressLabel = topic.progress || topic.startedAt;
  const titleParts = splitTickerTitle(topic);
  const matrixSubs = matrixSubtexts(strategy);
  const reasoningCopy = reasoningParagraphs(topic, reasoningSections, mainReasoning);
  const ctaTop = (
    <span className="v3-mega-top">
      <span className="v3-mega-icon" aria-hidden="true">
        {directionIcon(strategy.action)}
      </span>
      <span className="v3-mega-dir">{directionText(strategy.action)}</span>
      <span className="v3-mega-size">{allocationText(strategy)}</span>
    </span>
  );
  const ctaBottom = (
    <span className="v3-mega-bottom">
      <span className="v3-mega-action">
        {isObservationMode ? dict.market.coinwNavigate : dict.market.coinwFuturesLink}
      </span>
      <span className="v3-mega-arrow" aria-hidden="true">
        →
      </span>
    </span>
  );

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
      <article className={["v3-topic", visualTone, latest && "latest"].filter(Boolean).join(" ")}>
        <div className="v3-accent" aria-hidden="true" />
        <div className="v3-inner">
          <div className="v3-news-hero">
            <span className="v3-news-tag">决策源</span>
            <div className="v3-news-headline">{highlightedHeadline(cardHeadline)}</div>
            {newsItem?.url ? (
              <a
                className="v3-news-orig"
                href={newsItem.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                原文 ↗
              </a>
            ) : (
              <span className="v3-news-orig muted">原文 ↗</span>
            )}
            <div className="v3-news-foot">
              <span className="src">{newsItem?.source || dict.market.noNews}</span>
              {newsItem?.observedAt ? (
                <>
                  <span className="sep">·</span>
                  <span>{newsItem.observedAt}</span>
                </>
              ) : null}
              <span className="sep">·</span>
              <span className="sym">{strategy.ticker}</span>
            </div>
          </div>

          <header className="v3-head">
            <h2 className="v3-title">
              <span className="v3-title-ticker">{titleParts.ticker}</span>
              <span className="v3-title-rest">{titleParts.rest}</span>
            </h2>
            <span className="v3-time-chip">{progressLabel}</span>
          </header>

          <div className="v3-body">
            <div className="v3-matrix" aria-label="交易方案">
              <div className="v3-cell">
                <span className="v3-cell-label">入场区间</span>
                <span className="v3-cell-val">
                  {isObservationMode ? "观察结论" : strategy.entry}
                </span>
                <span className="v3-cell-sub ok">{matrixSubs.current}</span>
              </div>
              <div className="v3-cell">
                <span className="v3-cell-label">{dict.market.stopLoss}</span>
                <span className="v3-cell-val risk">
                  {isObservationMode ? "不涉及" : strategy.stopLoss}
                </span>
                <span className="v3-cell-sub">
                  {isObservationMode ? "观察卡" : matrixSubs.stop}
                </span>
              </div>
              <div className="v3-cell">
                <span className="v3-cell-label">{dict.market.takeProfit}</span>
                <span className="v3-cell-val reward">
                  {isObservationMode ? "不涉及" : strategy.takeProfit}
                </span>
                <span className="v3-cell-sub">
                  {isObservationMode ? "不生成交易方案" : matrixSubs.takeProfit}
                </span>
              </div>
            </div>

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
                {ctaTop}
                {ctaBottom}
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
                {ctaTop}
                {ctaBottom}
              </a>
            ) : renderBlockedTradeCTA ? (
              <button className="v3-mega-cta disabled" type="button" disabled>
                {ctaTop}
                {ctaBottom}
              </button>
            ) : (
              <button
                className="v3-mega-cta"
                type="button"
                onClick={() => onPlaceholder(topic, dict.market.coinwFuturesLink, "primary")}
              >
                {ctaTop}
                {ctaBottom}
              </button>
            )}

            <section className="v3-reasoning" aria-label="核心推理">
              <div className="v3-reason-head">
                <span className="v3-reason-tag">核心推理</span>
                <span className="v3-reason-byline">{byline}</span>
              </div>
              {reasoningCopy.map((paragraph, index) => (
                <p className="v3-reason-p" key={`${paragraph}-${index}`}>
                  {emphasizeReasoning(paragraph, index)}
                </p>
              ))}
            </section>

            <button
              className="v3-secondary"
              type="button"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              onClick={onToggle}
            >
              <div className="v3-sec-head">
                <span className="v3-sec-clock" aria-hidden="true">
                  ◷
                </span>
                <span className="v3-sec-title">
                  {collapsed ? "查看完整推理链" : "收起完整推理链"}
                </span>
                <span className="v3-sec-chevron" aria-hidden="true">
                  {collapsed ? "⌄" : "⌃"}
                </span>
              </div>
              <div className="v3-sec-foot">
                <span className="v3-sec-cta">{collapsed ? "展开 →" : "收起 →"}</span>
              </div>
            </button>
          </div>
        </div>
      </article>
      {tradeReadinessKind ? (
        <span
          hidden
          data-trade-readiness-slot="cta-disabled-reason"
          data-trade-readiness-kind={tradeReadinessKind}
        />
      ) : null}
      {renderStaleReason ? (
        <span className="cta-visible-reason">{dict.market.staleReason}</span>
      ) : null}
    </div>
  );
}

function TopicCardV10({
  topic,
  latest,
  collapsed,
  onToggle,
  dict,
  locale,
  onPlaceholder,
}: {
  topic: DispatchTopic;
  latest: boolean;
  collapsed: boolean;
  onToggle: () => void;
  dict: DispatchV10Dict;
  locale: Locale;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
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
      {!collapsed ? (
        <TopicHeadV10
          topic={topic}
          bodyId={bodyId}
          collapsed={collapsed}
          onToggle={onToggle}
          dict={dict}
        />
      ) : null}
      <TopicBody topic={topic} bodyId={bodyId} messageLabels={dict.message} />
      <TopicStrategyV10
        topic={topic}
        latest={latest}
        collapsed={collapsed}
        bodyId={bodyId}
        onToggle={onToggle}
        dict={dict}
        locale={locale}
        onPlaceholder={onPlaceholder}
      />
    </article>
  );
}

export function MarketAnalysisPanel({
  topics,
  dict,
  locale = "zh_CN",
  onPlaceholder,
  freshness,
  pagination,
}: {
  topics?: DispatchTopic[];
  dict: DispatchV10Dict;
  locale?: Locale;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string, action: DispatchTopicAction) => void;
  freshness?: DispatchFreshnessState;
  pagination?: DispatchTopicPaginationState;
}) {
  const resolvedTopics = useMemo(() => {
    const normalizedTopics = (topics ?? []).map((topic) => normalizeTopicNames(topic, dict.roles));
    return orderTopicsByRanking(normalizedTopics).filter(
      (topic) => topicCandidateType(topic) === "symbol",
    );
  }, [dict.roles, topics]);
  const [collapsedByTopicId, setCollapsedByTopicId] = useState<TopicCollapseState>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<ScrollAnchor>({ topicId: null, offset: 0, scrollTop: 0 });
  const paginationHasMore = pagination?.hasMore ?? false;
  const paginationLoading = pagination?.loading ?? false;
  const paginationOnLoadMore = pagination?.onLoadMore;
  const topicOrderSignature = resolvedTopics.map(topicDisplayIdentity).join("|");
  const freshnessText = formatFreshnessText(freshness, dict);

  useEffect(() => {
    setCollapsedByTopicId((current) => reconcileTopicCollapseState(resolvedTopics, current));
  }, [resolvedTopics]);

  useEffect(() => {
    if (!paginationHasMore || paginationLoading || !paginationOnLoadMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
      paginationOnLoadMore();
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) paginationOnLoadMore();
      },
      { root: bodyRef.current, rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [paginationHasMore, paginationLoading, paginationOnLoadMore]);

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
              {resolvedTopics.map((topic, index) => {
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
                      locale={locale}
                      onPlaceholder={onPlaceholder}
                    />
                    {index < resolvedTopics.length - 1 ? (
                      <div className="topic-separator" aria-hidden="true">
                        <span className="topic-separator-dot" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {pagination ? (
                <div className="topic-infinite-status" ref={loadMoreRef} role="status">
                  {pagination.loading
                    ? dict.market.loadingMore
                    : pagination.hasMore
                      ? ""
                      : dict.market.loadedAll.replace("{count}", String(pagination.loadedCount))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
