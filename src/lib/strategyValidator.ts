import type { TickerSnapshot } from "@/lib/news/livePriceFetch";
import type { DebateDirection, FinalStrategy } from "@/lib/types";

export interface StrategyValidationResult {
  ok: boolean;
  reasons: string[];
  currentPrice: number | null;
}

const MAX_DISTANCE_PCT = 10;

function distancePct(current: number, target: number): number {
  return (Math.abs(target - current) / current) * 100;
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/^\$/, "").toUpperCase();
}

function directionReason(direction: DebateDirection, current: number, strategy: FinalStrategy) {
  const reasons: string[] = [];
  if (direction === "wait") return reasons;

  if (strategy.stopLoss > 0) {
    if (direction === "long" && strategy.stopLoss >= current) {
      reasons.push("long stopLoss must be below current price");
    }
    if (direction === "short" && strategy.stopLoss <= current) {
      reasons.push("short stopLoss must be above current price");
    }
  }

  for (const target of strategy.takeProfit) {
    if (direction === "long" && target <= current) {
      reasons.push("long takeProfit must be above current price");
    }
    if (direction === "short" && target >= current) {
      reasons.push("short takeProfit must be below current price");
    }
  }

  return reasons;
}

export function validateStrategyAgainstSnapshot(
  strategy: FinalStrategy,
  snapshot: TickerSnapshot | null,
): StrategyValidationResult {
  const symbol = normalizeSymbol(strategy.symbol);
  const currentPrice = snapshot?.prices[symbol]?.current ?? null;
  const reasons: string[] = [];

  if (!snapshot || currentPrice === null || currentPrice <= 0) {
    return {
      ok: false,
      reasons: [`missing live price for ${symbol}`],
      currentPrice: null,
    };
  }

  const numbers = [strategy.stopLoss, ...strategy.takeProfit].filter(
    (value) => Number.isFinite(value) && value > 0,
  );

  for (const value of numbers) {
    const distance = distancePct(currentPrice, value);
    if (distance > MAX_DISTANCE_PCT) {
      reasons.push(`${value} is ${distance.toFixed(1)}% away from live ${symbol} ${currentPrice}`);
    }
  }

  reasons.push(...directionReason(strategy.direction, currentPrice, strategy));

  return {
    ok: reasons.length === 0,
    reasons,
    currentPrice,
  };
}

export function strategyRetryInstruction(result: StrategyValidationResult): string {
  return [
    "上一版 FinalStrategy 数字校验失败。",
    `失败原因：${result.reasons.join("；")}`,
    result.currentPrice
      ? `请围绕当前价 ${result.currentPrice} 重新给 entryCondition / stopLoss / takeProfit。`
      : "请先选择实时市场状态里有 current 价格的 symbol。",
    "只输出同样 JSON 结构，不要解释。",
  ].join("\n");
}
