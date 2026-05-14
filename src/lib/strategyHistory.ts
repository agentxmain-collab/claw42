import type { AgentWinrate, FactionId, FinalStrategy, StrategyReplay } from "@/lib/types";
import { getFactionIds } from "@/lib/factionRegistry";
import { appendDecisionRecord } from "@/lib/team/decisionRecordStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { validateTradeDecision } from "@/lib/team/tradeDecision";
import { LEGACY_WATCH_LOCALE } from "@/lib/watch/locale";

const replayHistory: StrategyReplay[] = [];

function normalizeSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

export async function recordStrategyReplay(replay: StrategyReplay) {
  const existingIndex = replayHistory.findIndex((item) => item.strategyId === replay.strategyId);
  if (existingIndex >= 0) {
    replayHistory[existingIndex] = replay;
  } else {
    replayHistory.unshift(replay);
    replayHistory.splice(300);
  }

  await appendDecisionRecord(replayToDecisionRecord(replay));
}

export function listStrategyReplays(limit = 50): StrategyReplay[] {
  return replayHistory.slice(0, limit);
}

export async function recordStrategyDecisionRecord(
  record: StrategyDecisionRecord,
  currentPrice: number,
): Promise<StrategyDecisionRecord> {
  const preparedRecord = prepareDecisionRecordForStorage(record, currentPrice);
  await appendDecisionRecord(preparedRecord);
  return preparedRecord;
}

function prepareDecisionRecordForStorage(
  record: StrategyDecisionRecord,
  currentPrice: number,
): StrategyDecisionRecord {
  if (!record.tradeDecision) return record;

  const validation = validateTradeDecision(record.tradeDecision, currentPrice);
  if (validation.valid) {
    return {
      ...record,
      recordSource: "live",
      tradeDecision: validation.decision,
    };
  }

  return {
    ...record,
    recordSource: "paper",
    tradeDecision: null,
  };
}

export function evaluateStrategy(
  strategy: FinalStrategy,
  entryPrice: number,
  exitPrice: number,
  evaluatedAt = Date.now(),
): StrategyReplay {
  const directionMultiplier = strategy.direction === "short" ? -1 : 1;
  const pnlPct =
    strategy.direction === "wait"
      ? 0
      : ((exitPrice - entryPrice) / entryPrice) * 100 * directionMultiplier;
  return {
    strategyId: strategy.id,
    debateId: strategy.id.split(":strategy")[0] ?? strategy.id,
    symbol: strategy.symbol,
    direction: strategy.direction,
    openedAt: strategy.createdAt,
    evaluatedAt,
    entryPrice,
    exitPrice,
    pnlPct,
    isWin: pnlPct > 0,
  };
}

export function replayToDecisionRecord(replay: StrategyReplay): StrategyDecisionRecord {
  return {
    id: `legacy:${replay.strategyId}:${replay.evaluatedAt}`,
    schemaVersion: 1,
    recordSource: "legacy",
    symbol: normalizeSymbol(replay.symbol),
    locale: LEGACY_WATCH_LOCALE,
    decisionOwnerId: "legacy",
    contributorIds: [],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision: null,
    createdAt: new Date(replay.openedAt).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: new Date(replay.evaluatedAt).toISOString(),
    resolvedOutcome: replay.isWin ? "hit_tp" : "hit_sl",
    promptVersion: "legacy-strategy-replay-v1",
    modelProvider: "legacy",
    legacyFactionId: replay.legacyFactionId ?? null,
  };
}

export function computeWinrates(
  strategyByAgent: Partial<Record<FactionId, FinalStrategy[]>>,
  replays = replayHistory,
): AgentWinrate[] {
  return getFactionIds().map((agentId) => {
    const strategyIds = new Set((strategyByAgent[agentId] ?? []).map((strategy) => strategy.id));
    const agentReplays = replays.filter((replay) => strategyIds.has(replay.strategyId));
    const wins = agentReplays.filter((replay) => replay.isWin).length;
    const losses = agentReplays.length - wins;
    return {
      agentId,
      sampleSize: agentReplays.length,
      wins,
      losses,
      winrate: agentReplays.length === 0 ? 0 : Math.round((wins / agentReplays.length) * 100),
    };
  });
}
