"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { CoinPoolPayload, CoinTickerEntry, TickerMap } from "../types";
import { priceDeltaColor } from "../utils/priceDeltaColor";

const COINS = ["BTC", "ETH", "SOL"] as const;
const FOLD_STORAGE_KEY = "claw42:watch:ticker-fold:v1";
const FOLD_STORAGE_TTL_MS = 30 * 24 * 60 * 60_000;
type FoldableGroupKey = "trending" | "opportunity";

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

function readFoldState(): Record<FoldableGroupKey, boolean> {
  if (typeof window === "undefined") return { trending: false, opportunity: false };
  try {
    const raw = window.localStorage.getItem(FOLD_STORAGE_KEY);
    if (!raw) return { trending: false, opportunity: false };
    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      expanded?: Partial<Record<FoldableGroupKey, boolean>>;
    };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(FOLD_STORAGE_KEY);
      return { trending: false, opportunity: false };
    }
    return {
      trending: Boolean(parsed.expanded?.trending),
      opportunity: Boolean(parsed.expanded?.opportunity),
    };
  } catch {
    return { trending: false, opportunity: false };
  }
}

function writeFoldState(expanded: Record<FoldableGroupKey, boolean>) {
  try {
    window.localStorage.setItem(
      FOLD_STORAGE_KEY,
      JSON.stringify({ expanded, expiresAt: Date.now() + FOLD_STORAGE_TTL_MS }),
    );
  } catch {
    // localStorage can be unavailable in restricted webviews.
  }
}

function TickerChip({
  ticker,
  groupKey,
  highlightedSymbol,
  tickerRefs,
}: {
  ticker: CoinTickerEntry;
  groupKey: string;
  highlightedSymbol: string | null;
  tickerRefs: MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const up = ticker.change24h >= 0;

  return (
    <div
      key={`${groupKey}-${ticker.symbol}`}
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
      <span className="text-white/70">{formatPrice(ticker.symbol, ticker.price)}</span>
      <span className={priceDeltaColor(ticker.change24h)}>
        {`${up ? "+" : ""}${ticker.change24h.toFixed(2)}%`}
      </span>
    </div>
  );
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
  const majors = useMemo(() => pool?.majors ?? majorsFromTickers(tickers), [pool?.majors, tickers]);
  const [expandedGroups, setExpandedGroups] = useState<Record<FoldableGroupKey, boolean>>(
    readFoldState,
  );
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
  const majorsGroup = groups.find((group) => group.key === "majors");
  const foldableGroups = groups.filter(
    (group): group is { key: FoldableGroupKey; label: string; entries: CoinTickerEntry[] } =>
      group.key === "trending" || group.key === "opportunity",
  );
  const symbolKey = groups
    .flatMap((group) => group.entries.map((entry) => entry.symbol.toUpperCase()))
    .join("|");

  useEffect(() => {
    let clearTimer: number | null = null;

    function scrollToHashSymbol() {
      const symbol = decodeURIComponent(window.location.hash.replace(/^#/, "")).toUpperCase();
      if (!symbol) return;

      const node = tickerRefs.current.get(symbol);
      if (!node) {
        const group = groups.find((item) =>
          item.entries.some((entry) => entry.symbol.toUpperCase() === symbol),
        );
        if (group?.key === "trending" || group?.key === "opportunity") {
          setExpandedGroups((current) => {
            const next = { ...current, [group.key]: true };
            writeFoldState(next);
            return next;
          });
        }
        return;
      }

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
  }, [groups, symbolKey]);

  function toggleGroup(key: FoldableGroupKey) {
    setExpandedGroups((current) => {
      const next = { ...current, [key]: !current[key] };
      writeFoldState(next);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111]/90 px-4 py-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-bold text-white/40">
            {majorsGroup?.label ?? labels.majors}
          </span>
          {(majorsGroup?.entries ?? []).map((ticker) => (
            <TickerChip
              key={`majors-${ticker.symbol}`}
              ticker={ticker}
              groupKey="majors"
              highlightedSymbol={highlightedSymbol}
              tickerRefs={tickerRefs}
            />
          ))}

          {foldableGroups.map((group, index) => {
            if (group.entries.length === 0) return null;
            const expanded = expandedGroups[group.key];
            return (
              <button
                key={`toggle-${group.key}`}
                type="button"
                onClick={() => toggleGroup(group.key)}
                className={`rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/82 ${
                  index === 0 ? "ml-2" : ""
                }`}
              >
                {group.label}({group.entries.length}) {expanded ? "▴" : "▾"}
              </button>
            );
          })}
        </div>

        {foldableGroups.map((group) => {
          if (!expandedGroups[group.key] || group.entries.length === 0) return null;
          return (
            <div key={`expanded-${group.key}`} className="flex flex-wrap items-center gap-2 pl-12">
              {group.entries.map((ticker) => (
                <TickerChip
                  key={`${group.key}-${ticker.symbol}`}
                  ticker={ticker}
                  groupKey={group.key}
                  highlightedSymbol={highlightedSymbol}
                  tickerRefs={tickerRefs}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
