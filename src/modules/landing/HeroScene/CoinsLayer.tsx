"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import type { CoinSymbol, TickerData, TickerMap } from "@/modules/agent-watch/types";

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
  onEngageTrail: (clientX: number, clientY: number) => void;
  onLingerTrail: () => void;
  onSelectCoin?: (symbol: CoinSymbol) => void;
}

interface TrailPoint {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  createdAt: number;
}

const TRAIL_LIFETIME_MS = 1000;
const TRAIL_POINT_THRESHOLD = 1.1;
const MAX_TRAIL_POINTS = 40;
const TRAIL_FOLLOW_AFTER_LEAVE_MS = 1000;

/**
 * 尾焰粒子。按距离鼠标尖的偏移（offset，沿运动反方向）+ 垂直抖动（perp）分布。
 * 核心尖点 3.2px → 末端 0.1px，blur 0.2-0.7。
 * v3 色梯：头部近白蓝 → 中段 logo 蓝 (#4A88FF / 74,136,255) → 尾部深蓝，和 logo 呼吸统一品牌色。
 * 粒子分段：
 *   HEAD (14 颗)   —— 主轨迹，鼠标尖到尾端
 *   FORK (6 颗)    —— 末端 V 字散开，打散不对称（perp 和 offset 都扰动，不再镜像）
 *   SPARK (6 颗)   —— 更远飞溅，脱离主轨迹
 *   SCATTER (8 颗) —— 完全不规则脱轨粒子，两侧远近散落，size/alpha 极大反差（0.1~0.42 / 0.1~0.32）
 */
const TRAIL_PARTICLES: ReadonlyArray<{
  offset: number;
  perp: number;
  size: number;
  blur: number;
  alpha: number;
  core: string;
  mid: string;
  tail: string;
}> = [
  // HEAD 段 —— 主轨迹 14 颗
  { offset: 0, perp: 0, size: 3.2, blur: 0.2, alpha: 1, core: "240,248,255", mid: "150,200,255", tail: "74,150,255" },
  { offset: -5, perp: -1.6, size: 2.6, blur: 0.22, alpha: 0.97, core: "236,246,255", mid: "145,195,255", tail: "70,145,252" },
  { offset: -10, perp: 2.0, size: 2.1, blur: 0.25, alpha: 0.94, core: "230,244,255", mid: "140,188,255", tail: "66,140,248" },
  { offset: -15, perp: -2.8, size: 1.7, blur: 0.28, alpha: 0.9, core: "224,240,255", mid: "135,182,255", tail: "62,135,244" },
  { offset: -20, perp: 3.4, size: 1.4, blur: 0.32, alpha: 0.85, core: "218,236,255", mid: "128,176,255", tail: "58,130,240" },
  { offset: -26, perp: -4.0, size: 1.2, blur: 0.35, alpha: 0.8, core: "212,232,255", mid: "122,170,255", tail: "54,125,236" },
  { offset: -32, perp: 4.4, size: 1.0, blur: 0.38, alpha: 0.74, core: "206,228,255", mid: "116,164,255", tail: "50,120,230" },
  { offset: -38, perp: -4.6, size: 0.82, blur: 0.4, alpha: 0.68, core: "200,224,255", mid: "110,158,255", tail: "48,115,224" },
  { offset: -44, perp: 4.4, size: 0.68, blur: 0.42, alpha: 0.62, core: "194,220,255", mid: "105,152,255", tail: "46,110,218" },
  { offset: -50, perp: -4.0, size: 0.55, blur: 0.45, alpha: 0.56, core: "188,216,255", mid: "100,146,255", tail: "44,105,212" },
  { offset: -56, perp: 3.4, size: 0.44, blur: 0.48, alpha: 0.5, core: "182,212,255", mid: "95,140,255", tail: "42,100,206" },
  { offset: -62, perp: -2.8, size: 0.35, blur: 0.5, alpha: 0.44, core: "176,208,255", mid: "90,135,255", tail: "40,95,200" },
  { offset: -68, perp: 2.2, size: 0.28, blur: 0.52, alpha: 0.38, core: "170,204,255", mid: "85,130,250", tail: "38,90,194" },
  { offset: -74, perp: -1.6, size: 0.22, blur: 0.55, alpha: 0.32, core: "164,200,255", mid: "80,125,245", tail: "36,85,188" },
  // FORK 段 —— 末端散开，offset/perp 不对称打散（不再镜像）
  { offset: -58, perp: 9.2, size: 0.5, blur: 0.5, alpha: 0.38, core: "200,225,255", mid: "110,160,255", tail: "50,118,230" },
  { offset: -64, perp: -7.8, size: 0.46, blur: 0.52, alpha: 0.36, core: "195,220,255", mid: "105,155,255", tail: "48,115,225" },
  { offset: -71, perp: 12.6, size: 0.36, blur: 0.55, alpha: 0.3, core: "185,215,255", mid: "98,148,255", tail: "44,108,218" },
  { offset: -75, perp: -10.4, size: 0.34, blur: 0.55, alpha: 0.28, core: "178,210,255", mid: "92,142,255", tail: "42,104,212" },
  { offset: -83, perp: 13.8, size: 0.28, blur: 0.6, alpha: 0.24, core: "168,202,255", mid: "85,135,250", tail: "38,95,200" },
  { offset: -86, perp: -11.2, size: 0.26, blur: 0.6, alpha: 0.22, core: "160,196,255", mid: "78,128,245", tail: "35,90,190" },
  // SPARK 段 —— 更远飞溅，不对称
  { offset: -90, perp: 6.3, size: 0.22, blur: 0.5, alpha: 0.22, core: "150,190,255", mid: "72,122,240", tail: "32,82,180" },
  { offset: -95, perp: -5.1, size: 0.2, blur: 0.52, alpha: 0.2, core: "145,185,255", mid: "68,118,235", tail: "30,78,175" },
  { offset: -99, perp: 13.2, size: 0.18, blur: 0.55, alpha: 0.18, core: "138,180,255", mid: "64,114,230", tail: "28,75,168" },
  { offset: -104, perp: -9.8, size: 0.17, blur: 0.58, alpha: 0.16, core: "132,175,255", mid: "60,110,225", tail: "26,72,162" },
  { offset: -108, perp: 7.2, size: 0.15, blur: 0.6, alpha: 0.14, core: "125,170,255", mid: "56,105,220", tail: "24,68,155" },
  { offset: -112, perp: -14.5, size: 0.14, blur: 0.62, alpha: 0.13, core: "118,164,255", mid: "52,100,215", tail: "22,64,148" },
  // SCATTER 段 —— 完全不规则脱轨飞溅，两侧远近散落，体积/亮度极大反差
  { offset: -30, perp: 9.8, size: 0.42, blur: 0.45, alpha: 0.32, core: "185,216,255", mid: "98,150,255", tail: "44,108,218" },
  { offset: -40, perp: -13.5, size: 0.38, blur: 0.48, alpha: 0.3, core: "175,210,255", mid: "90,142,252", tail: "38,95,200" },
  { offset: -48, perp: 8.5, size: 0.32, blur: 0.5, alpha: 0.28, core: "170,205,255", mid: "85,135,250", tail: "35,90,195" },
  { offset: -53, perp: -11.3, size: 0.24, blur: 0.55, alpha: 0.22, core: "162,198,255", mid: "78,128,245", tail: "32,85,185" },
  { offset: -67, perp: 15.4, size: 0.2, blur: 0.6, alpha: 0.18, core: "155,192,255", mid: "72,120,240", tail: "30,80,175" },
  { offset: -88, perp: -7.2, size: 0.28, blur: 0.52, alpha: 0.24, core: "148,186,255", mid: "66,112,232", tail: "28,75,165" },
  { offset: -115, perp: 10.1, size: 0.14, blur: 0.65, alpha: 0.12, core: "140,180,255", mid: "60,105,225", tail: "26,70,155" },
  { offset: -120, perp: -17.3, size: 0.1, blur: 0.7, alpha: 0.1, core: "132,172,255", mid: "54,98,218", tail: "24,65,145" },
];

const COINS: CoinConfig[] = [
  {
    symbol: "BTC",
    label: "Bitcoin",
    src: "/images/hero/coin-btc.png",
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
    src: "/images/hero/coin-eth.png",
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
    src: "/images/hero/coin-sol.png",
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
    src: "/images/hero/coin-usdt.png",
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
          {coin.symbol}
        </div>
        <div className="font-mono text-[13px] font-semibold tracking-[0.08em] text-white/72 drop-shadow-[0_0_8px_rgba(124,92,255,0.45)]">
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
          className={`absolute top-1/2 h-5 w-px -translate-y-1/2 bg-white/28 ${
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
  const trailIdRef = useRef(0);
  const trailActiveRef = useRef(false);
  const trailFollowUntilRef = useRef(0);
  const lastWindowPointRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const [tick, setTick] = useState(0);
  const [trail, setTrail] = useState<TrailPoint[]>([]);

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

  useEffect(() => {
    if (trail.length === 0) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setTrail((current) =>
        current.filter((point) => now - point.createdAt < TRAIL_LIFETIME_MS),
      );
    }, 50);

    return () => window.clearInterval(timer);
  }, [trail.length]);

  const pushTrailPoint = useCallback((point: Omit<TrailPoint, "id" | "createdAt">) => {
    setTrail((current) => [
      ...current.slice(-MAX_TRAIL_POINTS),
      {
        ...point,
        id: trailIdRef.current++,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const pushTrailPointFromClient = useCallback((clientX: number, clientY: number) => {
    if (!layerRef.current) return;

    const rect = layerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < -120 || y < -120 || x > rect.width + 120 || y > rect.height + 120) {
      return;
    }

    const last = lastWindowPointRef.current;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    const distance = Math.hypot(dx, dy);

    lastWindowPointRef.current = { x, y };

    if (last && distance < TRAIL_POINT_THRESHOLD) return;
    pushTrailPoint({ x, y, dx, dy });
  }, [pushTrailPoint]);

  useEffect(() => {
    if (reduceMotion) return;

    const handleMove = (event: MouseEvent) => {
      const now = Date.now();
      if (!trailActiveRef.current && now > trailFollowUntilRef.current) return;
      pushTrailPointFromClient(event.clientX, event.clientY);
    };

    const handleWindowLeave = () => {
      trailActiveRef.current = false;
      trailFollowUntilRef.current = 0;
      lastWindowPointRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleWindowLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleWindowLeave);
    };
  }, [reduceMotion, pushTrailPointFromClient]);

  const engageTrail = useCallback((clientX: number, clientY: number) => {
    trailActiveRef.current = true;
    trailFollowUntilRef.current = Number.POSITIVE_INFINITY;
    lastWindowPointRef.current = null;
    pushTrailPointFromClient(clientX, clientY);
  }, [pushTrailPointFromClient]);

  const lingerTrail = useCallback(() => {
    trailActiveRef.current = false;
    trailFollowUntilRef.current = Date.now() + TRAIL_FOLLOW_AFTER_LEAVE_MS;
  }, []);

  return (
    <div ref={layerRef} className="claw42-hero-coins absolute inset-0 z-30">
      {COINS.map((coin) => {
        const t = tick * coin.freqScale;
        const floatX = reduceMotion
          ? 0
          : Math.sin(t * 0.6 + coin.phaseX1) * 12 +
            Math.sin(t * 0.23 + coin.phaseX2) * 8;
        const floatY = reduceMotion
          ? 0
          : Math.cos(t * 0.5 + coin.phaseY1) * 8 +
            Math.sin(t * 0.31 + coin.phaseY2) * 6;

        return (
          <CoinItem
            key={coin.symbol}
            coin={coin}
            translateX={floatX}
            translateY={floatY}
            reduceMotion={reduceMotion}
            ticker={tickers?.[coin.symbol]}
            onEngageTrail={engageTrail}
            onLingerTrail={lingerTrail}
            onSelectCoin={onSelectCoin}
          />
        );
      })}

      {!reduceMotion && <TrailOverlay trail={trail} />}
    </div>
  );
}

function CoinItem({
  coin,
  translateX,
  translateY,
  reduceMotion,
  ticker,
  onEngageTrail,
  onLingerTrail,
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
        className={`claw42-hero-coin ${coin.sizeClass} relative pointer-events-auto cursor-pointer hover:scale-105 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/70`}
        data-coin={coin.symbol}
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${tooltipVisible ? 1.05 : 1})`,
          transition: "transform 180ms ease-out",
          appearance: "none",
          border: 0,
          padding: 0,
          background: "transparent",
        }}
        aria-label={`${coin.label} market card`}
        onClick={() => onSelectCoin?.(coin.symbol)}
        onMouseEnter={(event) => {
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
            onEngageTrail(event.clientX, event.clientY);
          }
        }}
        onMouseMove={(event) => {
          if (!reduceMotion) onEngageTrail(event.clientX, event.clientY);
        }}
        onMouseLeave={() => {
          if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
          setTooltipVisible(false);
          onLingerTrail();
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
            className="relative z-10 w-full h-auto select-none pointer-events-auto cursor-pointer"
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

function TrailOverlay({ trail }: { trail: TrailPoint[] }) {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-visible">
      <AnimatePresence>
        {trail.map((point) => {
          const distance = Math.max(1, Math.hypot(point.dx, point.dy));
          const nx = point.dx / distance;
          const ny = point.dy / distance;
          // 整体 drift 略收紧，配合更小的粒子尺寸，尾迹看起来更精细而不是散糊
          const drift = Math.max(14, Math.min(32, distance * 2.6 + 10));

          return (
            <motion.div
              key={point.id}
              className="absolute pointer-events-none"
              style={{
                left: point.x,
                top: point.y,
              }}
              initial={{ opacity: 0.96, scale: 0.82 }}
              animate={{
                opacity: 0,
                scale: 1.04,
                x: -nx * drift,
                y: -ny * drift,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: TRAIL_LIFETIME_MS / 1000, ease: "easeOut" }}
              aria-hidden="true"
            >
              {TRAIL_PARTICLES.map((p, i) => {
                // 粒子在鼠标运动反方向上延伸：offset 沿 (-nx, -ny) 方向，perp 沿垂直方向
                const cx = nx * p.offset + -ny * p.perp;
                const cy = ny * p.offset + nx * p.perp;
                const half = p.size / 2;
                return (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: cx - half,
                      top: cy - half,
                      width: p.size,
                      height: p.size,
                      background: `radial-gradient(circle, rgba(${p.core},${p.alpha}) 0%, rgba(${p.mid},${p.alpha * 0.72}) 50%, rgba(${p.tail},0) 100%)`,
                      filter: `blur(${p.blur}px)`,
                    }}
                  />
                );
              })}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
