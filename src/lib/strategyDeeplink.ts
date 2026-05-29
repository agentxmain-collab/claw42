import type { FinalStrategy } from "@/lib/types";
import { buildCoinWFuturesTradeUrl } from "@/lib/coinw/futuresLinks";
import { normalizeCoinWFuturesSymbol } from "@/lib/coinw/futuresInstruments";

export function buildCoinwDeeplink(strategy: FinalStrategy, locale = "zh_CN"): string {
  if (strategy.direction === "wait") return "";

  const symbol = normalizeCoinWFuturesSymbol(strategy.symbol);
  return buildCoinWFuturesTradeUrl({
    coinwPair: symbol ? `${symbol}_USDT` : null,
    locale,
  });
}
