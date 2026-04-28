"use client";

import type { CoinPoolPayload, CoinTickerEntry, MarketDataSource, TickerMap } from "../types";

const COINS = ["BTC", "ETH", "SOL", "USDT"] as const;

function formatPrice(symbol: string, price: number) {
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: symbol === "USDT" ? 4 : 0,
    maximumFractionDigits: symbol === "USDT" ? 4 : price < 1 ? 6 : 2,
  })}`;
}

function majorsFromTickers(tickers?: TickerMap): CoinTickerEntry[] {
  if (!tickers) return [];
  return COINS.map((symbol) => ({
    symbol,
    price: tickers[symbol].price,
    change24h: tickers[symbol].change24h,
    category: "majors",
  }));
}

export function CoinTickerStrip({
  pool,
  tickers,
  isStale,
  source,
}: {
  pool?: CoinPoolPayload;
  tickers?: TickerMap;
  isStale?: boolean;
  source?: MarketDataSource;
}) {
  const majors = pool?.majors ?? majorsFromTickers(tickers);
  const dataSource = source ?? pool?.source;
  const stale = isStale ?? pool?.isStale;
  const sourceLabel =
    dataSource === "coinw-kline"
      ? "CoinW 实盘K线"
      : dataSource === "coingecko-ticker"
        ? "仅现价"
        : "降级数据";
  const statusLabel = dataSource === "coinw-kline" && stale ? "K线延迟" : sourceLabel;

  return (
    <div className="card-glow rounded-2xl border border-white/10 bg-[#111]/90 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
        {majors.map((ticker) => {
          const up = ticker.change24h >= 0;
          return (
            <div
              key={ticker.symbol}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs md:text-sm"
            >
              <span className="font-bold text-white">{ticker.symbol}</span>
              <span className="text-white/70">{formatPrice(ticker.symbol, ticker.price)}</span>
              <span className={up ? "text-[#b49cff]" : "text-[#ff5f5f]"}>
                {`${up ? "+" : ""}${ticker.change24h.toFixed(2)}%`}
              </span>
            </div>
          );
        })}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            dataSource === "coinw-kline"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
