import type { FinalStrategy } from "@/lib/types";
import { buildCoinWFuturesTradeUrl } from "@/lib/coinw/futuresLinks";
import {
  normalizeCoinWFuturesSymbol,
  staticCoinWFuturesInstrumentSet,
} from "@/lib/coinw/futuresInstruments";

export function buildCoinwDeeplink(strategy: FinalStrategy, locale = "zh_CN"): string {
  if (strategy.direction === "wait") return "";

  const symbol = normalizeCoinWFuturesSymbol(strategy.symbol);
  const instrument = symbol ? staticCoinWFuturesInstrumentSet().get(symbol) : null;
  return buildCoinWFuturesTradeUrl({
    coinwPair: instrument?.coinwPair ?? null,
    locale,
  });
}
