import type {
  Dict,
  DispatchV10AgentRoleId,
  DispatchV10OutcomeDict,
  DispatchV10RoundDict,
  DispatchV10StageStatusDict,
  DispatchV10TopicRankingDict,
  Locale,
} from "@/i18n/types";
import arSA from "@/i18n/dicts/ar_SA.json";
import enUS from "@/i18n/dicts/en_US.json";
import enXA from "@/i18n/dicts/en_XA.json";
import esES from "@/i18n/dicts/es_ES.json";
import frFR from "@/i18n/dicts/fr_FR.json";
import jaJP from "@/i18n/dicts/ja_JP.json";
import ruRU from "@/i18n/dicts/ru_RU.json";
import ukUA from "@/i18n/dicts/uk_UA.json";
import zhCN from "@/i18n/dicts/zh_CN.json";
import zhTW from "@/i18n/dicts/zh_TW.json";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import {
  getDispatchAgentDisplayName,
  mapTeamMemberToDispatchAgent,
} from "@/lib/watch/dispatchAgentMapping";
import { calculateTopicRankingScore, formatTopicRanking } from "@/lib/watch/topicRanking";
import {
  groupPublicTimelineEventsByTopic,
  type DispatchTopicGroup,
  type PmDecisionTimelineEvent,
} from "@/lib/watch/topicAggregator";
import type { PublicTimelineEvent, PublicTradeDecision } from "@/lib/watch/publicTimelineEvent";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { DecisionStageTraceId } from "@/lib/team/strategyDecisionRecord";
import { publicTimelineEventStableId } from "@/lib/watch/publicTimelineOrdering";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";
import { buildCoinWFuturesTradeUrl } from "@/lib/coinw/futuresLinks";
import {
  mapPublicDecisionAgentToTeamMember,
  mapTeamMemberToPublicDecisionAgent,
} from "@/lib/watch/publicDecisionAgents";
import {
  normalizePublicDecisionStageStatuses,
  PUBLIC_DECISION_STAGE_ORDER,
  publicDecisionVisibleStageLimit,
} from "@/lib/watch/publicDecisionStageContract";
import {
  hasPublicInformationCollectionRound,
  isPublicDisplayablePmDecisionEvent,
} from "@/lib/watch/publicPmDecisionDisplay";
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
  roundDict: DispatchV10RoundDict;
  stageStatusDict: DispatchV10StageStatusDict;
  topicRankingDict: DispatchV10TopicRankingDict;
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

const DISPATCH_DICTS: Record<Locale, Dict["agentWatch"]["dispatchV10"]> = {
  zh_CN: (zhCN as Dict).agentWatch.dispatchV10,
  zh_TW: (zhTW as Dict).agentWatch.dispatchV10,
  en_US: (enUS as Dict).agentWatch.dispatchV10,
  ru_RU: (ruRU as Dict).agentWatch.dispatchV10,
  uk_UA: (ukUA as Dict).agentWatch.dispatchV10,
  ja_JP: (jaJP as Dict).agentWatch.dispatchV10,
  fr_FR: (frFR as Dict).agentWatch.dispatchV10,
  es_ES: (esES as Dict).agentWatch.dispatchV10,
  ar_SA: (arSA as Dict).agentWatch.dispatchV10,
  en_XA: (enXA as Dict).agentWatch.dispatchV10,
};

const ROLE_VIEWPOINT_KEY: Record<TeamMemberId, DispatchV10AgentRoleId> = {
  fundamental_analyst: "fundamental",
  news_analyst: "news",
  chart_analyst: "technical",
  onchain_analyst: "onchain",
  research_lead: "bullish",
  risk_lead: "conservative",
  pm: "portfolioManager",
  bullish_researcher: "bullish",
  bearish_researcher: "bearish",
  trader: "trader",
  aggressive_reviewer: "aggressive",
  neutral_reviewer: "neutral",
  conservative_reviewer: "conservative",
  memory_loop: "memoryLoop",
};

type PartialTraceStatus = NonNullable<
  PmDecisionTimelineEvent["payload"]["stageTrace"]
>[number]["status"];

function dispatchDict(locale: Locale) {
  return DISPATCH_DICTS[locale] ?? DISPATCH_DICTS.zh_CN;
}

function dataGapLabel(
  memberId: TeamMemberId,
  status: DispatchMessage["dataStatus"],
  locale: Locale,
) {
  if (!status) return undefined;
  const dict = dispatchDict(locale).dataGap;
  if (status === "ok") return dict.ok;
  if (status === "partial") return dict.partial;
  if (memberId === "chart_analyst") return dict.missing_chart;
  if (memberId === "news_analyst") return dict.missing_news;
  if (memberId === "onchain_analyst") return dict.missing_onchain;
  if (memberId === "fundamental_analyst") return dict.missing_fundamental;
  return dict.missing_market;
}

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

function formatRoundLabel(round: number, maxRound: number, roundDict: DispatchV10RoundDict) {
  return replaceVars(roundDict.separator, {
    round,
    mode: maxRound > 1 ? roundDict.multi : roundDict.single,
  });
}

type PmDecisionPayload = PmDecisionTimelineEvent["payload"];

function formatEntry(entryRange: PublicTradeDecision["entryRange"], entryPrice: number | null) {
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

function renderableTradeDecision(event: PmDecisionTimelineEvent): PublicTradeDecision | null {
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

function memberForRoundEntry(entry: NonNullable<PmDecisionPayload["rounds"]>[number]) {
  if (entry.memberId) return entry.memberId;
  if (entry.agentId) return mapPublicDecisionAgentToTeamMember(entry.agentId);
  return null;
}

function rationaleForMember(payload: PmDecisionPayload, memberId: TeamMemberId) {
  return (
    payload.rationaleByMember?.[memberId] ??
    payload.rationaleByAgent?.[mapTeamMemberToPublicDecisionAgent(memberId)]
  );
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

function stageForRoundEntry(
  entry: NonNullable<PmDecisionPayload["rounds"]>[number],
  memberId: TeamMemberId,
) {
  const baseStage = stageForMember(memberId);
  if (baseStage === 1 && entry.round > 1) return 2;
  return baseStage;
}

function makeStages(
  topicId: string,
  hasTradeDecision: boolean,
  hasResolution = false,
  hasMemoryLoop = false,
  outcomeDict: DispatchV10OutcomeDict,
  stageStatusDict: DispatchV10StageStatusDict,
  event?: PmDecisionTimelineEvent,
  analysisOnlyCandidate = false,
): DispatchStageMarker[] {
  const trace = event?.payload.stageTrace;
  if (!hasTradeDecision && trace?.length) {
    return makePartialStages(
      topicId,
      trace,
      stageStatusDict,
      hasResolution || hasMemoryLoop,
      hasTradeDecision,
      analysisOnlyCandidate,
    );
  }

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

function makePartialStages(
  topicId: string,
  trace: NonNullable<PmDecisionTimelineEvent["payload"]["stageTrace"]>,
  stageStatusDict: DispatchV10StageStatusDict,
  hasMemoryLoop: boolean,
  hasTradeDecision: boolean,
  analysisOnlyCandidate = false,
): DispatchStageMarker[] {
  const statuses = normalizePublicDecisionStageStatuses(trace, {
    hasRenderableTradeDecision: hasTradeDecision,
    analysisOnlyCandidate,
  });
  const statusFor = (stageId: DecisionStageTraceId) => statuses[stageId] ?? "pending";
  const mappedStatus = (status: PartialTraceStatus) => {
    if (status === "done") return "done" as const;
    if (status === "in_progress") return "in_progress" as const;
    return "pending" as const;
  };
  const labelWithStatus = (stage: number, name: string, status: PartialTraceStatus) =>
    status === "in_progress"
      ? `阶段 ${stage} · ${name} · ${stageStatusDict.in_progress}`
      : `阶段 ${stage} · ${name}`;
  const noteFor = (status: PartialTraceStatus) =>
    status === "in_progress"
      ? stageStatusDict.in_progressNote
      : status === "pending"
        ? stageStatusDict.pending
        : undefined;
  const analystStatus = statusFor("analyst_inputs");
  const researchStatus = statusFor("research_lead");
  const tradeStatus = statusFor("trade_decision");
  const riskStatus = statusFor("risk_lead");

  return [
    {
      id: stageId(topicId, 1),
      label: labelWithStatus(1, "信息收集", analystStatus),
      status: mappedStatus(analystStatus),
      note: noteFor(analystStatus),
    },
    {
      id: stageId(topicId, 2),
      label: labelWithStatus(2, "多空辩论", researchStatus),
      status: mappedStatus(researchStatus),
      note: noteFor(researchStatus),
    },
    {
      id: stageId(topicId, 3),
      label: labelWithStatus(3, "交易方案", tradeStatus),
      status: mappedStatus(tradeStatus),
      note: noteFor(tradeStatus),
    },
    {
      id: stageId(topicId, 4),
      label: labelWithStatus(4, "风险审查", riskStatus),
      status: mappedStatus(riskStatus),
      note: noteFor(riskStatus),
    },
    { id: stageId(topicId, 5), label: "阶段 5 · 最终决策", status: "pending" },
    hasMemoryLoop
      ? { id: stageId(topicId, 6), label: "阶段 6 · 复盘沉淀", status: "done" }
      : {
          id: stageId(topicId, 6),
          label: "阶段 6 · 复盘沉淀",
          status: "pending",
          note: stageStatusDict.memoryPending,
        },
  ];
}

function isAnalysisOnlyEvent(event: PmDecisionTimelineEvent) {
  return (
    event.payload.candidateType === "market_overview" || event.payload.candidateType === "hotspot"
  );
}

function hasAnalysisOnlyCompletion(event: PmDecisionTimelineEvent) {
  if (!isAnalysisOnlyEvent(event)) return false;
  return visibleMessageStageLimit(event, false) >= 6;
}

function visibleMessageStageLimit(event: PmDecisionTimelineEvent, hasTradeDecision: boolean) {
  return publicDecisionVisibleStageLimit(event.payload.stageTrace, {
    hasRenderableTradeDecision: hasTradeDecision,
    analysisOnlyCandidate: isAnalysisOnlyEvent(event),
  });
}

function messageStageNumber(stageIdValue: string) {
  const match = /-stage-(\d+)$/.exec(stageIdValue);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function currentStageFromTrace(event: PmDecisionTimelineEvent, hasTradeDecision: boolean) {
  const trace = event.payload.stageTrace;
  if (!trace?.length) return null;
  const statuses = normalizePublicDecisionStageStatuses(trace, {
    hasRenderableTradeDecision: hasTradeDecision,
    analysisOnlyCandidate: isAnalysisOnlyEvent(event),
  });
  const active = PUBLIC_DECISION_STAGE_ORDER.find(
    ({ traceId }) => statuses[traceId] === "in_progress",
  );
  if (!active) return null;
  const observedAt = trace.find((entry) => entry.stageId === active.traceId)?.observedAt;
  const stage = (() => {
    switch (active.traceId) {
      case "analyst_inputs":
        return 1;
      case "research_lead":
        return 2;
      case "trade_decision":
        return 3;
      case "risk_lead":
        return 4;
      default:
        return null;
    }
  })();
  if (!stage) return null;
  return { stage, observedAt };
}

function formatCurrentStageProgress(stage: number, heartbeatAt: string | number, now: number) {
  const parsed = typeof heartbeatAt === "number" ? heartbeatAt : Date.parse(heartbeatAt);
  const suffix = Number.isFinite(parsed) ? ` · ${formatDataAge(parsed, now)}` : "";
  return `当前进行到阶段 ${stage}${suffix}`;
}

function fallbackCurrentStageProgress(event: PmDecisionTimelineEvent, now: number) {
  return formatCurrentStageProgress(3, event.ts, now);
}

function currentStageNumberFromTrace(event: PmDecisionTimelineEvent, hasTradeDecision: boolean) {
  return currentStageFromTrace(event, hasTradeDecision)?.stage ?? null;
}

function makeRationaleMessages({
  event,
  topicId,
  locale,
  now,
  roundDict,
}: {
  event: PmDecisionTimelineEvent;
  topicId: string;
  locale: Locale;
  now: number;
  roundDict: DispatchV10RoundDict;
}) {
  const directionHint = renderableTradeDecision(event)?.direction;
  const roundEntries = Array.isArray(event.payload.rounds) ? event.payload.rounds : [];
  if (roundEntries.length > 0) {
    const maxRound = Math.max(1, ...roundEntries.map((entry) => entry.round));
    return Array.from(new Set(roundEntries.map((entry) => entry.round)))
      .sort((a, b) => a - b)
      .flatMap((round): DispatchMessage[] => {
        let roundLabelUsed = false;
        return TEAM_MESSAGE_ORDER.flatMap((memberId): DispatchMessage[] => {
          const entry = roundEntries.find(
            (candidate) => candidate.round === round && memberForRoundEntry(candidate) === memberId,
          );
          if (!entry) return [];
          const rationale = entry.rationale.trim();
          if (!rationale) return [];
          const agentId = mapTeamMemberToDispatchAgent(memberId, directionHint);
          const stage = stageForRoundEntry(entry, memberId);
          const roundLabel = roundLabelUsed
            ? undefined
            : formatRoundLabel(round, maxRound, roundDict);
          roundLabelUsed = true;
          return [
            {
              id: `${event.payload.recordId}-${memberId}-round-${round}`,
              stageId: stageId(topicId, stage),
              agentId,
              sourceMemberId: memberId,
              agentName: getDispatchAgentDisplayName(agentId, locale, memberId),
              time: formatTime(event.ts),
              dataAge: formatDataAge(event.ts, now),
              roundLabel,
              mentions: [],
              content: entry?.detailedRationale?.trim() || rationale,
              direction: entry?.direction,
              directionLabel: entry?.direction
                ? dispatchDict(locale).direction[entry.direction]
                : undefined,
              confidence: entry?.confidence,
              oneLineSummary: entry?.oneLineSummary,
              detailedRationale: entry?.detailedRationale,
              dataStatus: entry?.dataStatus,
              dataStatusLabel: dataGapLabel(memberId, entry?.dataStatus, locale),
              roleViewpoint: dispatchDict(locale).roleViewpoint[ROLE_VIEWPOINT_KEY[memberId]],
            },
          ];
        });
      });
  }

  return TEAM_MESSAGE_ORDER.flatMap((memberId): DispatchMessage[] => {
    const rationale = rationaleForMember(event.payload, memberId)?.trim();
    if (!rationale) return [];
    const agentId = mapTeamMemberToDispatchAgent(memberId, directionHint);
    const stage = stageForMember(memberId);
    return [
      {
        id: `${event.payload.recordId}-${memberId}`,
        stageId: stageId(topicId, stage),
        agentId,
        sourceMemberId: memberId,
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
  if (!decision && isAnalysisOnlyEvent(event)) return null;
  const currentStage = currentStageNumberFromTrace(event, Boolean(decision));
  if (!decision && currentStage !== null && currentStage < 3) return null;
  if (!decision) {
    return {
      id: `${event.payload.recordId}-trader-typing`,
      stageId: stageId(topicId, 3),
      agentId: "trader",
      sourceMemberId: "trader",
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
    sourceMemberId: "trader",
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
    sourceMemberId: "pm",
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
    sourceMemberId: "memory_loop",
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
      return replaceVars(outcomeDict.manual_close, {
        price,
        reason: reason || outcomeDict.reason.manual_close_requested,
      });
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
  roundDict: DispatchV10RoundDict,
) {
  const topicId = group.id;
  const event = group.latestDecision;
  const hasTradeDecision = Boolean(renderableTradeDecision(event));
  const stageLimit = visibleMessageStageLimit(event, hasTradeDecision);
  return [
    ...makeRationaleMessages({ event, topicId, locale, now, roundDict }),
    makeTraderMessage(topicId, event, locale, hasRationale),
    makePmMessage(topicId, event, locale),
    makeResolutionMessage(topicId, event, locale, now, outcomeDict),
  ].filter((message): message is DispatchMessage =>
    Boolean(message && messageStageNumber(message.stageId) <= stageLimit),
  );
}

function hasEventRationale(event: PmDecisionTimelineEvent) {
  return (
    Object.values(event.payload.rationaleByAgent ?? {}).some((value) => value?.trim()) ||
    Object.values(event.payload.rationaleByMember ?? {}).some((value) => value?.trim()) ||
    (event.payload.rounds ?? []).some((round) => round.rationale.trim())
  );
}

function hasMemoryLoopRationale(event: PmDecisionTimelineEvent) {
  return Boolean(
    rationaleForMember(event.payload, "memory_loop")?.trim() ||
    (event.payload.rounds ?? []).some(
      (round) => memberForRoundEntry(round) === "memory_loop" && round.rationale.trim(),
    ),
  );
}

function makeStrategy(
  group: DispatchTopicGroup,
  stats: FollowStatsSnapshot | undefined,
  hasRationale: boolean,
  executable: boolean,
  analysisOnlyComplete: boolean,
): DispatchStrategy {
  const decision = renderableTradeDecision(group.latestDecision);
  const ticker = `$${group.symbol}`;

  if (!decision) {
    const actionLabel = analysisOnlyComplete ? "已完成" : hasRationale ? "分析中" : "等待中";
    const name = hasRationale ? "尚未决策" : "暂无决策更新";
    const meta = analysisOnlyComplete
      ? "观察分析已完成 · 不生成交易方案"
      : hasRationale
        ? "分析进行中 · 等待交易方案"
        : "等待真实分析写入";

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
      primaryDisabled: !executable || Boolean(stats?.userFollowed) || decision.direction === "wait",
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
) {
  if (group.displayTitle) return group.displayTitle;
  if (!hasRenderableTradeDecision && !hasRationale) {
    return `${group.symbol} 实时行情分析`;
  }

  return `${group.symbol} 实时行情分析`;
}

function makeExplanation(
  group: DispatchTopicGroup,
  hasRenderableTradeDecision: boolean,
  hasRationale: boolean,
  evidence?: NewsEvidence,
) {
  if (!hasRenderableTradeDecision && !hasRationale) {
    return "暂无决策更新";
  }
  if (!hasRenderableTradeDecision && group.latestDecision.payload.analysisSummary) {
    return group.latestDecision.payload.analysisSummary;
  }
  const suffix =
    evidence?.summary ||
    evidence?.title ||
    (hasRenderableTradeDecision ? "真实交易决策已完成" : "分析进行中");
  return suffix;
}

function makeProgress(
  group: DispatchTopicGroup,
  now: number,
  hasRenderableTradeDecision: boolean,
  hasRationale: boolean,
  analysisOnlyComplete: boolean,
) {
  if (analysisOnlyComplete) return `${minutesBetween(group.startedAt, now)} 分钟闭环`;
  if (!hasRenderableTradeDecision) {
    const currentStage = currentStageFromTrace(group.latestDecision, hasRenderableTradeDecision);
    if (currentStage) {
      return formatCurrentStageProgress(
        currentStage.stage,
        currentStage.observedAt ?? group.latestDecision.ts,
        now,
      );
    }
    return hasRationale ? fallbackCurrentStageProgress(group.latestDecision, now) : "暂无决策更新";
  }
  return `${minutesBetween(group.startedAt, now)} 分钟闭环`;
}

function strategySortTime(group: DispatchTopicGroup) {
  const generatedAt = renderableTradeDecision(group.latestDecision)?.generatedAt;
  if (!generatedAt) return group.latestAt;
  const parsed = Date.parse(generatedAt);
  return Number.isFinite(parsed) ? parsed : group.latestAt;
}

function compareRankedGroups(
  a: { group: DispatchTopicGroup; ranking: ReturnType<typeof calculateTopicRankingScore> },
  b: { group: DispatchTopicGroup; ranking: ReturnType<typeof calculateTopicRankingScore> },
) {
  return (
    b.ranking.score - a.ranking.score ||
    strategySortTime(b.group) - strategySortTime(a.group) ||
    b.group.latestAt - a.group.latestAt ||
    publicTimelineEventStableId(a.group.latestDecision).localeCompare(
      publicTimelineEventStableId(b.group.latestDecision),
    )
  );
}

function displayablePublicBetaGroup(group: DispatchTopicGroup) {
  const latest = group.latestDecision;
  if (latest.payload.kind !== "pm_decision") return false;
  if (!hasPublicInformationCollectionRound(latest)) return false;
  if (group.candidateType !== "symbol") return true;
  if (typeof latest.payload.executable === "boolean") return latest.payload.executable;
  return resolveSymbolMapping(group.symbol).execution.executable;
}

export function mapPublicTimelineEventsToTopics(ctx: V9AdapterContext): DispatchTopic[] {
  const now = ctx.now ?? Date.now();
  const displayableCandidateEvents = ctx.events.filter(isPublicDisplayablePmDecisionEvent);
  const rankedGroups = groupPublicTimelineEventsByTopic(displayableCandidateEvents)
    .filter(displayablePublicBetaGroup)
    .map((group) => {
      const tradeDecision = renderableTradeDecision(group.latestDecision);
      return {
        group,
        ranking: calculateTopicRankingScore({
          event: group.latestDecision,
          evidenceMap: ctx.evidenceMap,
          confidence: tradeDecision?.confidence,
        }),
      };
    })
    .sort(compareRankedGroups);

  return rankedGroups.map(({ group, ranking }, index) => {
    const evidence = firstEvidence(group, ctx.evidenceMap);
    const originalUrl = originalEvidenceUrl(evidence);
    const latest = group.latestDecision;
    const recordId = latest.payload.recordId;
    const tradeDecision = renderableTradeDecision(latest);
    const hasTradeDecision = Boolean(tradeDecision);
    const hasRationale = hasEventRationale(latest);
    const hasMemoryLoop = hasMemoryLoopRationale(latest);
    const analysisOnlyComplete = hasAnalysisOnlyCompletion(latest);
    const status =
      hasTradeDecision || analysisOnlyComplete ? "done" : hasRationale ? "active" : "pending";
    const symbolMapping = resolveSymbolMapping(group.symbol);
    const executable =
      group.candidateType === "symbol" &&
      (typeof latest.payload.executable === "boolean"
        ? latest.payload.executable
        : symbolMapping.execution.executable);
    const coinwPair = executable ? symbolMapping.execution.coinwPair : null;

    return {
      id: recordId,
      candidateType: group.candidateType,
      candidateKey: group.candidateKey,
      displayTitle: group.displayTitle,
      symbol: group.symbol,
      lastUpdatedAt: group.latestAt,
      execution: {
        executable,
        coinwPair,
        tradeUrl: buildCoinWFuturesTradeUrl({ coinwPair }),
        watchOnly: !executable,
        watchOnlyReason: symbolMapping.execution.watchOnlyReason,
      },
      status,
      title: makeTitle(group, hasTradeDecision, hasRationale),
      explanation: makeExplanation(group, hasTradeDecision, hasRationale, evidence),
      originalUrl,
      sourceLabel: originalUrl ? evidence?.source : undefined,
      startedAt: formatTime(group.startedAt),
      progress: makeProgress(group, now, hasTradeDecision, hasRationale, analysisOnlyComplete),
      intensity: ranking.intensity,
      topicRanking: formatTopicRanking({
        symbol: group.symbol,
        rank: index + 1,
        ranking,
        dict: ctx.topicRankingDict,
      }),
      trigger: {
        ticker: `$${group.symbol}`,
        text:
          (!hasTradeDecision && latest.payload.analysisSummary) ||
          evidence?.summary ||
          evidence?.title ||
          `${group.symbol} 真实交易决策`,
      },
      stages: makeStages(
        group.id,
        hasTradeDecision,
        Boolean(latest.payload.resolution),
        hasMemoryLoop,
        ctx.outcomeDict,
        ctx.stageStatusDict,
        latest,
        isAnalysisOnlyEvent(latest),
      ),
      messages: makeMessages(group, ctx.locale, now, hasRationale, ctx.outcomeDict, ctx.roundDict),
      strategy: makeStrategy(
        group,
        ctx.followStatsByRecordId?.[recordId],
        hasRationale,
        executable,
        analysisOnlyComplete,
      ),
      defaultCollapsed: index > 0,
    };
  });
}
