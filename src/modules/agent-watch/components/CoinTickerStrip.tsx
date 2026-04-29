"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoinPoolPayload, CoinTickerEntry, TickerMap } from "../types";
import { priceDeltaColor } from "../utils/priceDeltaColor";

const COINS = ["BTC", "ETH", "SOL"] as const;

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
  labels,
}: {
  pool?: CoinPoolPayload;
  tickers?: TickerMap;
  labels: {
    majors: string;
    trending: string;
    opportunity: string;
  };
}) {
  const majors = pool?.majors ?? majorsFromTickers(tickers);
  const groups = useMemo<Array<{ key: string; label: string; entries: CoinTickerEntry[] }>>(
    () => [
      { key: "majors", label: labels.majors, entries: majors },
      { key: "trending", label: labels.trending, entries: pool?.trending ?? [] },
      { key: "opportunity", label: labels.opportunity, entries: pool?.opportunity ?? [] },
    ],
    [labels.majors, labels.opportunity, labels.trending, majors, pool?.opportunity, pool?.trending],
  );
  const tickerRefs = useRef(new Map<string, HTMLDivElement>());
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const symbolKey = groups
    .flatMap((group) => group.entries.map((entry) => entry.symbol.toUpperCase()))
    .join("|");

  useEffect(() => {
    let clearTimer: number | null = null;

    function scrollToHashSymbol() {
      const symbol = decodeURIComponent(window.location.hash.replace(/^#/, "")).toUpperCase();
      if (!symbol) return;

      const node = tickerRefs.current.get(symbol);
      if (!node) return;

      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      setHighlightedSymbol(symbol);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        setHighlightedSymbol((current) => (current === symbol ? null : current));
      }, 1500);
    }

    const initialTimer = window.setTimeout(scrollToHashSymbol, 120);
    window.addEventListener("hashchange", scrollToHashSymbol);

    return () => {
      window.clearTimeout(initialTimer);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
      window.removeEventListener("hashchange", scrollToHashSymbol);
    };
  }, [symbolKey]);

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
                    ref={(node) => {
                      const symbol = ticker.symbol.toUpperCase();
                      if (node && !tickerRefs.current.has(symbol)) {
                        tickerRefs.current.set(symbol, node);
                      } else if (!node) {
                        tickerRefs.current.delete(symbol);
                      }
                    }}
                    data-ticker-symbol={ticker.symbol.toUpperCase()}
                    className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs md:text-sm ${
                      highlightedSymbol === ticker.symbol.toUpperCase()
                        ? "animate-[claw42TickerHighlight_1.5s_ease-out]"
                        : ""
                    }`}
                  >
                    <span className="font-bold text-white">{ticker.symbol}</span>
                    <span className="text-white/70">
                      {formatPrice(ticker.symbol, ticker.price)}
                    </span>
                    <span className={priceDeltaColor(ticker.change24h)}>
                      {`${up ? "+" : ""}${ticker.change24h.toFixed(2)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
