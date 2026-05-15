import type { DispatchV10OutcomeDict, Locale } from "@/i18n/types";
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
  outcomeDict: DispatchV10OutcomeDict;
  now?: number;
}

const TEAM_MESSAGE_ORDER: TeamMemberId[] = [
  "chart_analyst",
  "news_analyst",
  "onchain_analyst",
  "fundamental_analyst",
  "bullish_researcher",
  "bearish_researcher",
  "research_lead",
  "trader",
  "aggressive_reviewer",
  "neutral_reviewer",
  "conservative_reviewer",
  "risk_lead",
  "memory_loop",
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

function replaceVars(template: string, vars: Readonly<Record<string, string | number>>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function renderableTradeDecision(event: PmDecisionTimelineEvent): TradeDecision | null {
  const decision = event.payload.tradeDecision;
  if (!decision || typeof decision !== "object") return null;
  if (
    decision.direction !== "long" &&
    decision.direction !== "short" &&
    decision.direction !== "wait"
  ) {
    return null;
  }
  if (
    typeof decision.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(decision.generatedAt))
  ) {
    return null;
  }
  if (!Array.isArray(decision.takeProfit) || !decision.takeProfit.every(isFiniteNumber))
    return null;
  if (!isFiniteNumber(decision.positionSizing)) return null;
  if (!isFiniteNumber(decision.confidence)) return null;
  if (decision.entryPrice !== null && decision.entryPrice !== undefined) {
    if (!isFiniteNumber(decision.entryPrice)) return null;
  }
  if (decision.entryRange !== null && decision.entryRange !== undefined) {
    if (
      typeof decision.entryRange !== "object" ||
      !isFiniteNumber(decision.entryRange.low) ||
      !isFiniteNumber(decision.entryRange.high)
    ) {
      return null;
    }
  }
  if (decision.stopLoss !== null && decision.stopLoss !== undefined) {
    if (!isFiniteNumber(decision.stopLoss)) return null;
  }
  if (typeof decision.timeHorizon !== "string") return null;
  if (typeof decision.riskNote !== "string") return null;
  if (typeof decision.invalidatesIf !== "string") return null;
  return decision;
}

function firstEvidence(group: DispatchTopicGroup, evidenceMap: V9AdapterContext["evidenceMap"]) {
  return group.evidenceIds
    .map((evidenceId) => evidenceMap?.[evidenceId])
    .find((evidence): evidence is NewsEvidence => Boolean(evidence));
}

function originalEvidenceUrl(evidence: NewsEvidence | undefined) {
  const url = evidence?.url.trim();
  if (!url || url === "#") return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
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
  if (memberId === "bullish_researcher" || memberId === "bearish_researcher") return 2;
  if (memberId === "trader") return 3;
  if (memberId === "risk_lead") return 4;
  if (
    memberId === "aggressive_reviewer" ||
    memberId === "neutral_reviewer" ||
    memberId === "conservative_reviewer"
  ) {
    return 4;
  }
  if (memberId === "memory_loop") return 6;
  return 5;
}

function makeStages(
  topicId: string,
  hasTradeDecision: boolean,
  hasResolution = false,
  hasMemoryLoop = false,
  outcomeDict: DispatchV10OutcomeDict,
): DispatchStageMarker[] {
  if (!hasTradeDecision) {
    return [
      { id: stageId(topicId, 1), label: "阶段 1 · 信息收集", status: "done" },
      { id: stageId(topicId, 2), label: "阶段 2 · 多空辩论", status: "done" },
      { id: stageId(topicId, 3), label: "阶段 3 · 交易方案 · 进行中", status: "active" },
      {
        id: stageId(topicId, 4),
        label: "阶段 4-6 · 等待中",
        status: "pending",
        note: "风险审查 / 最终决策 / 复盘 按顺序触发",
      },
    ];
  }

  return [
    { id: stageId(topicId, 1), label: "阶段 1 · 信息收集", status: "done" },
    { id: stageId(topicId, 2), label: "阶段 2 · 多空辩论", status: "done" },
    { id: stageId(topicId, 3), label: "阶段 3 · 交易方案", status: "done" },
    { id: stageId(topicId, 4), label: "阶段 4 · 风险审查", status: "done" },
    { id: stageId(topicId, 5), label: "阶段 5 · 最终决策", status: "final" },
    hasResolution || hasMemoryLoop
      ? { id: stageId(topicId, 6), label: "阶段 6 · 复盘沉淀", status: "done" }
      : {
          id: stageId(topicId, 6),
          label: "阶段 6 · 复盘沉淀",
          status: "pending",
          note: outcomeDict.pending,
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
  const directionHint = renderableTradeDecision(event)?.direction;
  const rationaleByMember = event.payload.rationaleByMember ?? {};
  return TEAM_MESSAGE_ORDER.flatMap((memberId): DispatchMessage[] => {
    const rationale = rationaleByMember[memberId]?.trim();
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
  hasRationale: boolean,
): DispatchMessage | null {
  const decision = renderableTradeDecision(event);
  if (!decision && !hasRationale) return null;
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
  const decision = renderableTradeDecision(event);
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

function makeResolutionMessage(
  topicId: string,
  event: PmDecisionTimelineEvent,
  locale: Locale,
  now: number,
  outcomeDict: DispatchV10OutcomeDict,
): DispatchMessage | null {
  const resolution = event.payload.resolution;
  if (!resolution) return null;
  const resolvedAt = Date.parse(resolution.resolvedAt);
  const timestamp = Number.isFinite(resolvedAt) ? resolvedAt : event.ts;

  return {
    id: `${event.payload.recordId}-resolution`,
    stageId: stageId(topicId, 6),
    agentId: "memory_loop",
    agentName: getDispatchAgentDisplayName("memory_loop", locale),
    time: formatTime(timestamp),
    dataAge: formatDataAge(timestamp, now),
    mentions: [],
    content: resolutionContent(resolution, outcomeDict),
  };
}

function resolutionContent(
  resolution: NonNullable<PmDecisionTimelineEvent["payload"]["resolution"]>,
  outcomeDict: DispatchV10OutcomeDict,
) {
  const price =
    typeof resolution.observedPrice === "number" ? formatPrice(resolution.observedPrice) : "N/A";
  const reason =
    resolution.reason && resolution.reason in outcomeDict.reason
      ? outcomeDict.reason[resolution.reason]
      : (resolution.reason ?? "");

  switch (resolution.outcome) {
    case "hit_tp":
      return replaceVars(outcomeDict.hit_tp, { price, reason });
    case "hit_sl":
      return replaceVars(outcomeDict.hit_sl, { price, reason });
    case "expired":
      return replaceVars(outcomeDict.expired, { price, reason });
    case "manual_close":
      return replaceVars(outcomeDict.manual_close, { price, reason });
    default:
      return outcomeDict.pending;
  }
}

function makeMessages(
  group: DispatchTopicGroup,
  locale: Locale,
  now: number,
  hasRationale: boolean,
  outcomeDict: DispatchV10OutcomeDict,
) {
  const topicId = group.id;
  const event = group.latestDecision;
  return [
    ...makeRationaleMessages({ event, topicId, locale, now }),
    makeTraderMessage(topicId, event, locale, hasRationale),
    makePmMessage(topicId, event, locale),
    makeResolutionMessage(topicId, event, locale, now, outcomeDict),
  ].filter((message): message is DispatchMessage => Boolean(message));
}

function makeStrategy(
  group: DispatchTopicGroup,
  stats: FollowStatsSnapshot | undefined,
  hasRationale: boolean,
): DispatchStrategy {
  const decision = renderableTradeDecision(group.latestDecision);
  const ticker = `$${group.symbol}`;

  if (!decision) {
    const actionLabel = hasRationale ? "分析中" : "等待中";
    const name = hasRationale ? "尚未决策" : "暂无决策更新";
    const meta = hasRationale ? "分析进行中 · 等待交易方案" : "等待真实分析写入";

    return {
      action: "pending",
      actionLabel,
      name,
      ticker,
      meta,
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

function makeTitle(
  group: DispatchTopicGroup,
  hasRenderableTradeDecision: boolean,
  hasRationale: boolean,
  evidence?: NewsEvidence,
) {
  if (!hasRenderableTradeDecision && !hasRationale) {
    return `${group.symbol} 实时行情分析 · 暂无决策更新`;
  }

  const suffix =
    evidence?.summary ||
    evidence?.title ||
    (hasRenderableTradeDecision ? "真实交易决策已完成" : "分析进行中");
  return `${group.symbol} 实时行情分析 · ${suffix}`;
}

function makeProgress(
  group: DispatchTopicGroup,
  now: number,
  hasRenderableTradeDecision: boolean,
  hasRationale: boolean,
) {
  if (!hasRenderableTradeDecision) return hasRationale ? "当前进行到阶段 3" : "暂无决策更新";
  return `${minutesBetween(group.startedAt, now)} 分钟闭环`;
}

function strategySortTime(group: DispatchTopicGroup) {
  const generatedAt = renderableTradeDecision(group.latestDecision)?.generatedAt;
  if (!generatedAt) return group.latestAt;
  const parsed = Date.parse(generatedAt);
  return Number.isFinite(parsed) ? parsed : group.latestAt;
}

export function mapPublicTimelineEventsToTopics(ctx: V9AdapterContext): DispatchTopic[] {
  const now = ctx.now ?? Date.now();
  const groups = groupPublicTimelineEventsByTopic(ctx.events).sort(
    (a, b) => strategySortTime(b) - strategySortTime(a) || b.latestAt - a.latestAt,
  );

  return groups.map((group, index) => {
    const evidence = firstEvidence(group, ctx.evidenceMap);
    const originalUrl = originalEvidenceUrl(evidence);
    const latest = group.latestDecision;
    const recordId = latest.payload.recordId;
    const tradeDecision = renderableTradeDecision(latest);
    const confidence = tradeDecision?.confidence;
    const hasTradeDecision = Boolean(tradeDecision);
    const hasRationale = Object.values(latest.payload.rationaleByMember ?? {}).some((value) =>
      value?.trim(),
    );
    const hasMemoryLoop = Boolean(latest.payload.rationaleByMember?.memory_loop?.trim());
    const status = hasTradeDecision ? "done" : hasRationale ? "active" : "pending";

    return {
      id: recordId,
      symbol: group.symbol,
      status,
      title: makeTitle(group, hasTradeDecision, hasRationale, evidence),
      originalUrl,
      sourceLabel: originalUrl ? evidence?.source : undefined,
      startedAt: formatTime(group.startedAt),
      progress: makeProgress(group, now, hasTradeDecision, hasRationale),
      intensity: calculateTopicIntensity({
        event: latest,
        evidenceMap: ctx.evidenceMap,
        confidence,
      }),
      trigger: {
        ticker: `$${group.symbol}`,
        text: evidence?.summary || evidence?.title || `${group.symbol} 真实交易决策`,
      },
      stages: makeStages(
        group.id,
        hasTradeDecision,
        Boolean(latest.payload.resolution),
        hasMemoryLoop,
        ctx.outcomeDict,
      ),
      messages: makeMessages(group, ctx.locale, now, hasRationale, ctx.outcomeDict),
      strategy: makeStrategy(group, ctx.followStatsByRecordId?.[recordId], hasRationale),
      defaultCollapsed: index > 0,
    };
  });
}
