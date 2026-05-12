import type { Locale } from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import {
  getDispatchAgentDisplayName,
  mapTeamMemberToDispatchAgent,
} from "@/lib/watch/dispatchAgentMapping";
import { calculateTopicIntensity } from "@/lib/watch/intensityCalculator";
import {
  groupPublicTimelineEventsByTopic,
  type DispatchTopicGroup,
  type PmDecisionTimelineEvent,
} from "@/lib/watch/topicAggregator";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type {
  DispatchMessage,
  DispatchStageMarker,
  DispatchStrategy,
  DispatchTopic,
} from "@/modules/agent-watch/v9/types";

export interface FollowStatsSnapshot {
  watchCount: number;
  followCount: number;
  userFollowed?: boolean;
}

export interface V9AdapterContext {
  events: readonly PublicTimelineEvent[];
  evidenceMap?: Readonly<Record<string, NewsEvidence | undefined>>;
  followStatsByRecordId?: Readonly<Record<string, FollowStatsSnapshot | undefined>>;
  locale: Locale;
  now?: number;
}

const TEAM_MESSAGE_ORDER: TeamMemberId[] = [
  "chart_analyst",
  "news_analyst",
  "onchain_analyst",
  "fundamental_analyst",
  "research_lead",
  "risk_lead",
  "pm",
];

function formatTime(ts: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(ts));
}

function minutesBetween(start: number, end: number) {
  return Math.max(0, Math.round((end - start) / 60_000));
}

function formatDataAge(ts: number, now: number) {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return `数据 ${seconds} 秒前`;
  return `数据 ${Math.round(seconds / 60)} 分钟前`;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value);
}

function formatEntry(entryRange: TradeDecision["entryRange"], entryPrice: number | null) {
  if (entryRange) return `${formatPrice(entryRange.low)} - ${formatPrice(entryRange.high)}`;
  if (typeof entryPrice === "number") return formatPrice(entryPrice);
  return "待定";
}

function formatTakeProfit(takeProfit: number[]) {
  return takeProfit.length > 0 ? takeProfit.map(formatPrice).join(" / ") : "待定";
}

function formatStopLoss(stopLoss: number | null) {
  return typeof stopLoss === "number" ? formatPrice(stopLoss) : "待定";
}

function firstEvidence(group: DispatchTopicGroup, evidenceMap: V9AdapterContext["evidenceMap"]) {
  return group.evidenceIds
    .map((evidenceId) => evidenceMap?.[evidenceId])
    .find((evidence): evidence is NewsEvidence => Boolean(evidence));
}

function stageId(topicId: string, stage: number) {
  return `${topicId}-stage-${stage}`;
}

function stageForMember(memberId: TeamMemberId) {
  if (
    memberId === "fundamental_analyst" ||
    memberId === "news_analyst" ||
    memberId === "chart_analyst" ||
    memberId === "onchain_analyst"
  ) {
    return 1;
  }
  if (memberId === "research_lead") return 2;
  if (memberId === "risk_lead") return 4;
  return 5;
}

function makeStages(topicId: string, hasTradeDecision: boolean): DispatchStageMarker[] {
  if (!hasTradeDecision) {
    return [
      { id: stageId(topicId, 1), label: "阶段 1 · 信息收集", status: "done" },
      { id: stageId(topicId, 2), label: "阶段 2 · 多空辩论", status: "done" },
      { id: stageId(topicId, 3), label: "阶段 3 · 交易方案 · 进行中", status: "active" },
      {
        id: stageId(topicId, 4),
        label: "阶段 4-6 · 等待中",
        status: "pending",
        note: "风险审查 / PM 终审 / 复盘 按顺序触发",
      },
    ];
  }

  return [
    { id: stageId(topicId, 1), label: "阶段 1 · 信息收集", status: "done" },
    { id: stageId(topicId, 2), label: "阶段 2 · 多空辩论", status: "done" },
    { id: stageId(topicId, 3), label: "阶段 3 · 交易方案", status: "done" },
    { id: stageId(topicId, 4), label: "阶段 4 · 风险审查", status: "done" },
    { id: stageId(topicId, 5), label: "阶段 5 · 最终决策", status: "final" },
    {
      id: stageId(topicId, 6),
      label: "阶段 6 · 复盘沉淀",
      status: "pending",
      note: "TODO：真实 memory_loop 尚未接入，等待写入",
    },
  ];
}

function makeRationaleMessages({
  event,
  topicId,
  locale,
  now,
}: {
  event: PmDecisionTimelineEvent;
  topicId: string;
  locale: Locale;
  now: number;
}) {
  const directionHint = event.payload.tradeDecision?.direction;
  return TEAM_MESSAGE_ORDER.flatMap((memberId): DispatchMessage[] => {
    const rationale = event.payload.rationaleByMember[memberId]?.trim();
    if (!rationale) return [];
    const agentId = mapTeamMemberToDispatchAgent(memberId, directionHint);
    const stage = stageForMember(memberId);
    return [
      {
        id: `${event.payload.recordId}-${memberId}`,
        stageId: stageId(topicId, stage),
        agentId,
        agentName: getDispatchAgentDisplayName(agentId, locale, memberId),
        time: formatTime(event.ts),
        dataAge: formatDataAge(event.ts, now),
        mentions: [],
        content: rationale,
      },
    ];
  });
}

function makeTraderMessage(
  topicId: string,
  event: PmDecisionTimelineEvent,
  locale: Locale,
): DispatchMessage | null {
  const decision = event.payload.tradeDecision;
  if (!decision) {
    return {
      id: `${event.payload.recordId}-trader-typing`,
      stageId: stageId(topicId, 3),
      agentId: "trader",
      agentName: getDispatchAgentDisplayName("trader", locale),
      time: formatTime(event.ts),
      mentions: [],
      content: "",
      typing: true,
    };
  }

  return {
    id: `${event.payload.recordId}-trader`,
    stageId: stageId(topicId, 3),
    agentId: "trader",
    agentName: getDispatchAgentDisplayName("trader", locale),
    time: formatTime(Date.parse(decision.generatedAt)),
    mentions: [],
    content: `方案 **${decision.direction.toUpperCase()}**。入场 ${formatEntry(
      decision.entryRange,
      decision.entryPrice,
    )} / 止损 ${formatStopLoss(decision.stopLoss)} / 止盈 ${formatTakeProfit(
      decision.takeProfit,
    )} / 仓位 ${Math.round(decision.positionSizing * 100)}%。`,
  };
}

function makePmMessage(
  topicId: string,
  event: PmDecisionTimelineEvent,
  locale: Locale,
): DispatchMessage | null {
  const decision = event.payload.tradeDecision;
  if (!decision) return null;
  const direction = decision.direction.toUpperCase();
  const content =
    decision.direction === "wait"
      ? `**维持 WAIT**。${decision.riskNote}`
      : `**批准 ${direction}**。${decision.riskNote} **失效条件：${decision.invalidatesIf}**`;

  return {
    id: `${event.payload.recordId}-pm`,
    stageId: stageId(topicId, 5),
    agentId: "portfolio_manager",
    agentName: getDispatchAgentDisplayName("portfolio_manager", locale, "pm"),
    time: formatTime(Date.parse(decision.generatedAt)),
    mentions: [],
    content,
  };
}

function makeMessages(group: DispatchTopicGroup, locale: Locale, now: number) {
  const topicId = group.id;
  const event = group.latestDecision;
  return [
    ...makeRationaleMessages({ event, topicId, locale, now }),
    makeTraderMessage(topicId, event, locale),
    makePmMessage(topicId, event, locale),
  ].filter((message): message is DispatchMessage => Boolean(message));
}

function makeStrategy(
  group: DispatchTopicGroup,
  stats: FollowStatsSnapshot | undefined,
): DispatchStrategy {
  const decision = group.latestDecision.payload.tradeDecision;
  const ticker = `$${group.symbol}`;

  if (!decision) {
    return {
      action: "pending",
      actionLabel: "PENDING",
      name: "尚未决策",
      ticker,
      meta: "分析进行中 · 等待交易方案",
      entry: "待定",
      stopLoss: "待定",
      takeProfit: "待定",
      follow: {
        primaryLabel: "等待决策",
        primaryDisabled: true,
        secondaryLabel: "提醒我",
        watchCount: stats?.watchCount ?? 0,
        followCount: stats?.followCount ?? 0,
      },
    };
  }

  const actionLabel =
    decision.direction === "wait"
      ? "WAIT"
      : `${decision.direction.toUpperCase()} ${Math.round(decision.positionSizing * 100)}%`;

  return {
    action: decision.direction === "wait" ? "wait" : decision.direction,
    actionLabel,
    name: decision.direction === "wait" ? "本次决策" : "交易方案",
    ticker,
    meta: `置信度 ${Math.round(decision.confidence * 100)}% · ${decision.timeHorizon}`,
    metaHighlight:
      decision.confidence >= 0.75
        ? {
            text: "高置信",
            tone: "ok",
          }
        : undefined,
    entry: formatEntry(decision.entryRange, decision.entryPrice),
    stopLoss: formatStopLoss(decision.stopLoss),
    takeProfit: formatTakeProfit(decision.takeProfit),
    follow: {
      primaryLabel: stats?.userFollowed
        ? "已跟单"
        : decision.direction === "wait"
          ? "提醒我"
          : "跟单",
      primaryDisabled: Boolean(stats?.userFollowed) || decision.direction === "wait",
      secondaryLabel: "查看详情",
      watchCount: stats?.watchCount ?? 0,
      followCount: stats?.followCount ?? 0,
      expiryNote: decision.direction === "wait" ? "等待明确方案" : undefined,
    },
  };
}

function makeTitle(group: DispatchTopicGroup, evidence?: NewsEvidence) {
  const suffix = evidence?.summary || evidence?.title || "真实 PM 决策已完成";
  return `${group.symbol} live market check · ${suffix}`;
}

function makeProgress(group: DispatchTopicGroup, now: number) {
  const decision = group.latestDecision.payload.tradeDecision;
  if (!decision) return "当前进行到阶段 3";
  return `${minutesBetween(group.startedAt, now)} 分钟闭环`;
}

export function mapPublicTimelineEventsToTopics(ctx: V9AdapterContext): DispatchTopic[] {
  const now = ctx.now ?? Date.now();
  const groups = groupPublicTimelineEventsByTopic(ctx.events);

  return groups.map((group, index) => {
    const evidence = firstEvidence(group, ctx.evidenceMap);
    const latest = group.latestDecision;
    const recordId = latest.payload.recordId;
    const confidence = latest.payload.tradeDecision?.confidence;
    const hasTradeDecision = Boolean(latest.payload.tradeDecision);
    const status = hasTradeDecision ? "done" : "pending";

    return {
      id: recordId,
      symbol: group.symbol,
      status,
      title: makeTitle(group, evidence),
      originalUrl: evidence?.url ?? "#",
      startedAt: formatTime(group.startedAt),
      progress: makeProgress(group, now),
      intensity: calculateTopicIntensity({
        event: latest,
        evidenceMap: ctx.evidenceMap,
        confidence,
      }),
      trigger: {
        ticker: `$${group.symbol}`,
        text: evidence?.summary || evidence?.title || `${group.symbol} PM decision`,
      },
      stages: makeStages(group.id, hasTradeDecision),
      messages: makeMessages(group, ctx.locale, now),
      strategy: makeStrategy(group, ctx.followStatsByRecordId?.[recordId]),
      defaultCollapsed: index > 0,
    };
  });
}
