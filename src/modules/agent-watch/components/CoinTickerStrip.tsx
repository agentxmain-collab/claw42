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
  labels,
  statusLabels,
}: {
  pool?: CoinPoolPayload;
  tickers?: TickerMap;
  isStale?: boolean;
  source?: MarketDataSource;
  labels: {
    majors: string;
    trending: string;
    opportunity: string;
  };
  statusLabels: {
    coinw: string;
    spotOnly: string;
    fallback: string;
    stale: string;
  };
}) {
  const majors = pool?.majors ?? majorsFromTickers(tickers);
  const groups: Array<{ key: string; label: string; entries: CoinTickerEntry[] }> = [
    { key: "majors", label: labels.majors, entries: majors },
    { key: "trending", label: labels.trending, entries: pool?.trending ?? [] },
    { key: "opportunity", label: labels.opportunity, entries: pool?.opportunity ?? [] },
  ];
  const dataSource = source ?? pool?.source;
  const stale = isStale ?? pool?.isStale;
  const sourceLabel =
    dataSource === "coinw-kline"
      ? statusLabels.coinw
      : dataSource === "coingecko-ticker"
        ? statusLabels.spotOnly
        : statusLabels.fallback;
  const statusLabel = dataSource === "coinw-kline" && stale ? statusLabels.stale : sourceLabel;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111]/90 px-4 py-3">
      <div className="flex flex-col gap-3">
        {groups
          .filter((group) => group.entries.length > 0)
          .map((group) => (
            <div key={group.key} className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-bold text-white/40">{group.label}</span>
              {group.entries.map((ticker) => {
                const up = ticker.change24h >= 0;
                return (
                  <div
                    key={`${group.key}-${ticker.symbol}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs md:text-sm"
                  >
                    <span className="font-bold text-white">{ticker.symbol}</span>
                    <span className="text-white/70">
                      {formatPrice(ticker.symbol, ticker.price)}
                    </span>
                    <span className={up ? "text-[#b49cff]" : "text-[#ff5f5f]"}>
                      {`${up ? "+" : ""}${ticker.change24h.toFixed(2)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
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
