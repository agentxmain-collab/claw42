import type { RecordSource, StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";

export interface TeamMemberWinrate {
  memberId: TeamMemberId;
  totalDecisions: number;
  wins: number;
  winRate: number;
  netReturn7d: number;
  recordSourceMix: Record<RecordSource, number>;
  sampleSizeWarning: boolean;
}

const RESOLVED_OUTCOMES = new Set(["hit_tp", "hit_sl", "manual_close", "expired"]);
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function computeTeamWinrates(
  records: StrategyDecisionRecord[],
): Promise<TeamMemberWinrate[]> {
  const buckets = new Map<TeamMemberId, StrategyDecisionRecord[]>(
    TEAM_MEMBER_IDS.map((memberId) => [memberId, []]),
  );

  for (const record of records) {
    if (record.recordSource === "legacy") continue;

    for (const memberId of memberIdsForRecord(record)) {
      buckets.get(memberId)?.push(record);
    }
  }

  return TEAM_MEMBER_IDS.map((memberId) => {
    const memberRecords = buckets.get(memberId) ?? [];
    const resolvedRecords = memberRecords.filter((record) =>
      record.resolvedOutcome ? RESOLVED_OUTCOMES.has(record.resolvedOutcome) : false,
    );
    const wins = memberRecords.filter((record) => record.resolvedOutcome === "hit_tp").length;

    return {
      memberId,
      totalDecisions: memberRecords.length,
      wins,
      winRate: resolvedRecords.length === 0 ? 0 : wins / resolvedRecords.length,
      netReturn7d: netReturn7d(memberRecords),
      recordSourceMix: recordSourceMix(memberRecords),
      sampleSizeWarning: memberRecords.length < 30,
    };
  });
}

function memberIdsForRecord(record: StrategyDecisionRecord): TeamMemberId[] {
  const memberIds = new Set<TeamMemberId>();
  for (const contributorId of record.contributorIds) memberIds.add(contributorId);
  if (record.decisionOwnerId !== "legacy") memberIds.add(record.decisionOwnerId);
  return Array.from(memberIds);
}

function recordSourceMix(records: StrategyDecisionRecord[]): Record<RecordSource, number> {
  const mix: Record<RecordSource, number> = {
    live: 0,
    paper: 0,
    legacy: 0,
    backtest: 0,
  };

  for (const record of records) {
    if (record.recordSource === "legacy") continue;
    mix[record.recordSource] += 1;
  }

  return mix;
}

function netReturn7d(records: StrategyDecisionRecord[]) {
  const cutoff = Date.now() - ONE_WEEK_MS;
  return records
    .filter((record) => Date.parse(record.createdAt) >= cutoff)
    .reduce((sum, record) => sum + estimatedReturnPct(record), 0);
}

function estimatedReturnPct(record: StrategyDecisionRecord) {
  if (!record.tradeDecision) return 0;
  if (record.resolvedOutcome !== "hit_tp" && record.resolvedOutcome !== "hit_sl") return 0;

  const entryPrice = normalizedEntryPrice(record.tradeDecision);
  if (!entryPrice) return 0;

  const exitPrice =
    record.resolvedOutcome === "hit_tp"
      ? record.tradeDecision.takeProfit[0]
      : record.tradeDecision.stopLoss;
  if (!exitPrice || exitPrice <= 0) return 0;

  const multiplier = record.tradeDecision.direction === "short" ? -1 : 1;
  return ((exitPrice - entryPrice) / entryPrice) * 100 * multiplier;
}

function normalizedEntryPrice(decision: TradeDecision) {
  if (decision.entryPrice && decision.entryPrice > 0) return decision.entryPrice;
  if (decision.entryRange && decision.entryRange.low > 0 && decision.entryRange.high > 0) {
    return (decision.entryRange.low + decision.entryRange.high) / 2;
  }
  return null;
}
