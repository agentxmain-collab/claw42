import type { AgentWinrate, FactionId, FinalStrategy, StrategyReplay } from "@/lib/types";
import { getFactionIds } from "@/lib/factionRegistry";

const replayHistory: StrategyReplay[] = [];

export function recordStrategyReplay(replay: StrategyReplay) {
  const existingIndex = replayHistory.findIndex((item) => item.strategyId === replay.strategyId);
  if (existingIndex >= 0) {
    replayHistory[existingIndex] = replay;
    return;
  }
  replayHistory.unshift(replay);
  replayHistory.splice(300);
}

export function listStrategyReplays(limit = 50): StrategyReplay[] {
  return replayHistory.slice(0, limit);
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
