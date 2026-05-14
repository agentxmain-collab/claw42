"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { withBasePath } from "@/lib/basePath";
import type { CoinSymbol, TickerData, TickerMap } from "@/modules/agent-watch/types";
import { formatCoinSymbol } from "@/modules/agent-watch/utils/symbolFormat";

interface CoinsLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
  tickers?: TickerMap;
  onSelectCoin?: (symbol: CoinSymbol) => void;
}

interface CoinConfig {
  symbol: CoinSymbol;
  label: string;
  src: string;
  anchor: { top: string; left?: string; right?: string };
  sizeClass: string;
  calloutSide: "left" | "right";
  depth: number;
  phaseX1: number;
  phaseX2: number;
  phaseY1: number;
  phaseY2: number;
  freqScale: number;
}

interface CoinItemProps {
  coin: CoinConfig;
  translateX: number;
  translateY: number;
  reduceMotion: boolean;
  ticker?: TickerData;
  onSelectCoin?: (symbol: CoinSymbol) => void;
}

const COINS: CoinConfig[] = [
  {
    symbol: "BTC",
    label: "Bitcoin",
    src: withBasePath("/images/hero/coin-btc.png"),
    anchor: { top: "17%", left: "31%" },
    sizeClass: "w-[64px] md:w-[96px] lg:w-[106px]",
    calloutSide: "left",
    depth: 0.8,
    phaseX1: 0,
    phaseX2: 1.2,
    phaseY1: 0.4,
    phaseY2: 2.1,
    freqScale: 1.0,
  },
  {
    symbol: "ETH",
    label: "Ethereum",
    src: withBasePath("/images/hero/coin-eth.png"),
    anchor: { top: "18%", right: "31%" },
    sizeClass: "w-[56px] md:w-[80px] lg:w-[88px]",
    calloutSide: "right",
    depth: 0.7,
    phaseX1: 1.9,
    phaseX2: 3.0,
    phaseY1: 1.1,
    phaseY2: 0.6,
    freqScale: 1.15,
  },
  {
    symbol: "SOL",
    label: "Solana",
    src: withBasePath("/images/hero/coin-sol.png"),
    anchor: { top: "42%", left: "37%" },
    sizeClass: "w-[60px] md:w-[88px] lg:w-[96px]",
    calloutSide: "left",
    depth: 0.9,
    phaseX1: 2.7,
    phaseX2: 0.4,
    phaseY1: 2.3,
    phaseY2: 1.5,
    freqScale: 0.88,
  },
  {
    symbol: "USDT",
    label: "Tether",
    src: withBasePath("/images/hero/coin-usdt.png"),
    anchor: { top: "42%", right: "37%" },
    sizeClass: "w-[60px] md:w-[88px] lg:w-[96px]",
    calloutSide: "right",
    depth: 0.75,
    phaseX1: 0.8,
    phaseX2: 2.5,
    phaseY1: 3.1,
    phaseY2: 0.2,
    freqScale: 1.27,
  },
];

function formatTickerPrice(price: number) {
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: price < 1 ? 6 : 2,
  })}`;
}

function formatTickerChange(change24h: number) {
  return `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`;
}

function MarketCallout({
  coin,
  ticker,
  reduceMotion,
}: {
  coin: CoinConfig;
  ticker: TickerData;
  reduceMotion: boolean;
}) {
  const isLeft = coin.calloutSide === "left";
  const isPositive = ticker.change24h >= 0;
  const accent = isPositive ? "rgb(39,217,128)" : "rgb(255,95,95)";
  const lineGradient = isLeft
    ? `linear-gradient(90deg, rgba(255,255,255,0), ${accent})`
    : `linear-gradient(90deg, ${accent}, rgba(255,255,255,0))`;
  const sideClass = isLeft
    ? "right-[calc(100%+0.75rem)] flex-row"
    : "left-[calc(100%+0.75rem)] flex-row-reverse";
  const textAlignClass = isLeft ? "text-right items-end" : "text-left items-start";
  const lineMarginClass = isLeft ? "ml-3" : "mr-3";

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
      className={`pointer-events-none absolute top-1/2 z-50 hidden -translate-y-1/2 items-center md:flex ${sideClass}`}
    >
      <div className={`flex min-w-[8.75rem] flex-col gap-0.5 ${textAlignClass}`}>
        <div className="font-mono text-[12px] font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]">
          {formatCoinSymbol(coin.symbol)}
        </div>
        <div className="text-white/72 font-mono text-[13px] font-semibold tracking-[0.08em] drop-shadow-[0_0_8px_rgba(124,92,255,0.45)]">
          {formatTickerPrice(ticker.price)}
        </div>
        <div
          className="font-mono text-[12px] font-bold tracking-[0.12em]"
          style={{
            color: accent,
            textShadow: `0 0 10px ${isPositive ? "rgba(39,217,128,0.38)" : "rgba(255,95,95,0.38)"}`,
          }}
        >
          {formatTickerChange(ticker.change24h)} / 24H
        </div>
      </div>

      <div className={`relative h-px w-16 ${lineMarginClass}`} style={{ background: lineGradient }}>
        <span
          className={`absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${
            isLeft ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
          }`}
          style={{
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
        <span
          className={`bg-white/28 absolute top-1/2 h-5 w-px -translate-y-1/2 ${
            isLeft ? "left-0" : "right-0"
          }`}
        />
      </div>
    </motion.div>
  );
}

export function CoinsLayer({
  mouseX,
  mouseY,
  reduceMotion,
  tickers,
  onSelectCoin,
}: CoinsLayerProps) {
  void mouseX;
  void mouseY;

  const layerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    startRef.current = performance.now();
    const loop = (now: number) => {
      setTick((now - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  return (
    <div ref={layerRef} className="claw42-hero-coins absolute inset-0 z-30">
      {COINS.map((coin) => {
        const t = tick * coin.freqScale;
        const floatX = reduceMotion
          ? 0
          : Math.sin(t * 0.6 + coin.phaseX1) * 12 + Math.sin(t * 0.23 + coin.phaseX2) * 8;
        const floatY = reduceMotion
          ? 0
          : Math.cos(t * 0.5 + coin.phaseY1) * 8 + Math.sin(t * 0.31 + coin.phaseY2) * 6;

        return (
          <CoinItem
            key={coin.symbol}
            coin={coin}
            translateX={floatX}
            translateY={floatY}
            reduceMotion={reduceMotion}
            ticker={tickers?.[coin.symbol]}
            onSelectCoin={onSelectCoin}
          />
        );
      })}
    </div>
  );
}

function CoinItem({
  coin,
  translateX,
  translateY,
  reduceMotion,
  ticker,
  onSelectCoin,
}: CoinItemProps) {
  // v1 用 key=`${symbol}-burst-${burstId}` 每次 mouseenter 改 key → motion.div remount，
  // remount 间隙 img 瞬态消失就是 Dan 看到的闪烁。
  // v2 改用 useAnimationControls 手动 start keyframes，不 remount，不闪烁。
  const controls = useAnimationControls();
  const [bursting, setBursting] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const baseFilter = bursting
    ? "drop-shadow(0 0 12px rgba(255,205,98,0.52)) saturate(1.08)"
    : "drop-shadow(0 0 18px rgba(124,92,255,0.35))";
  const coinKey = coin.symbol.toLowerCase();

  return (
    <div
      className="absolute"
      style={{
        top: `var(--claw42-hero-coin-${coinKey}-top, ${coin.anchor.top})`,
        left: coin.anchor.left
          ? `var(--claw42-hero-coin-${coinKey}-left, ${coin.anchor.left})`
          : undefined,
        right: coin.anchor.right
          ? `var(--claw42-hero-coin-${coinKey}-right, ${coin.anchor.right})`
          : undefined,
      }}
    >
      <button
        type="button"
        className={`claw42-hero-coin ${coin.sizeClass} pointer-events-auto relative cursor-pointer hover:scale-105 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/70`}
        data-coin={coin.symbol}
        style={{
          transform: `translate(${translateX}px, calc(${translateY}px + var(--claw42-hero-depth-coin-y, 0px))) scale(${tooltipVisible ? 1.05 : 1})`,
          transition: "transform 180ms ease-out",
          appearance: "none",
          border: 0,
          padding: 0,
          background: "transparent",
        }}
        aria-label={`${coin.label} market card`}
        onClick={() => onSelectCoin?.(coin.symbol)}
        onMouseEnter={() => {
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = setTimeout(() => setTooltipVisible(true), 150);
          setBursting(true);
          if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
          burstTimerRef.current = setTimeout(() => setBursting(false), 900);
          if (!reduceMotion) {
            controls.start({
              x: [0, -2.6, 3.8, -2.1, 1.1, 0],
              y: [0, 1.6, -2.2, 1.4, -0.7, 0],
              rotate: [0, -2.2, 1.6, -0.9, 0.4, 0],
              scale: [1, 1.05, 0.98, 1.03, 1],
              transition: { duration: 0.34, ease: "easeOut" },
            });
          }
        }}
        onMouseLeave={() => {
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          setTooltipVisible(false);
        }}
        onFocus={() => {
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          setTooltipVisible(true);
        }}
        onBlur={() => setTooltipVisible(false)}
      >
        <motion.div animate={controls} initial={false}>
          <motion.img
            src={coin.src}
            alt=""
            aria-label={coin.label}
            draggable={false}
            className="pointer-events-auto relative z-10 h-auto w-full cursor-pointer select-none"
            style={{
              filter: baseFilter,
              transition: "filter 240ms ease-out",
            }}
          />
        </motion.div>
        <AnimatePresence>
          {tooltipVisible && ticker && (
            <MarketCallout coin={coin} ticker={ticker} reduceMotion={reduceMotion} />
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
