import type { FinalStrategy } from "@/lib/types";

const COINW_BASE = "claw42-todo://placeholder";

export function buildCoinwDeeplink(strategy: FinalStrategy): string {
  if (strategy.direction === "wait") return "";

  // TODO(Dan): replace placeholder with the official CoinW affiliate URL template.
  const params = new URLSearchParams({
    symbol: `${strategy.symbol.replace(/^\$/, "")}USDT`,
    side: strategy.direction === "long" ? "buy" : "sell",
    sl: strategy.stopLoss.toString(),
    tp1: strategy.takeProfit[0]?.toString() ?? "",
    tp2: strategy.takeProfit[1]?.toString() ?? "",
    ref: "claw42",
  });
  return `${COINW_BASE}?${params.toString()}`;
}
