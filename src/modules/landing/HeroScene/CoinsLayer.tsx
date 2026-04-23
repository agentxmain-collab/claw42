"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";

interface CoinsLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

interface CoinConfig {
  symbol: "BTC" | "ETH" | "SOL" | "USDT";
  label: string;
  src: string;
  anchor: { top: string; left?: string; right?: string };
  sizeClass: string;
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
  onEngageTrail: (clientX: number, clientY: number) => void;
  onLingerTrail: () => void;
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
 * 整体压缩：核心尖点 3.2px → 末端 0.22px，blur 控制在 0.2-0.55 之间，避免糊感。
 * 颜色层次：头部偏白偏暖 → 中段暖橙 → 尾部暗红淡出。
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
  { offset: 0, perp: 0, size: 3.2, blur: 0.2, alpha: 1, core: "255,252,238", mid: "255,226,156", tail: "255,170,70" },
  { offset: -5, perp: -1.6, size: 2.6, blur: 0.22, alpha: 0.97, core: "255,250,226", mid: "255,214,136", tail: "255,162,64" },
  { offset: -10, perp: 2.0, size: 2.1, blur: 0.25, alpha: 0.94, core: "255,246,214", mid: "255,204,118", tail: "255,156,58" },
  { offset: -15, perp: -2.8, size: 1.7, blur: 0.28, alpha: 0.9, core: "255,240,200", mid: "255,196,106", tail: "255,150,52" },
  { offset: -20, perp: 3.4, size: 1.4, blur: 0.32, alpha: 0.85, core: "255,234,188", mid: "255,188,96", tail: "255,144,48" },
  { offset: -26, perp: -4.0, size: 1.2, blur: 0.35, alpha: 0.8, core: "255,228,178", mid: "255,182,90", tail: "255,140,46" },
  { offset: -32, perp: 4.4, size: 1.0, blur: 0.38, alpha: 0.74, core: "255,222,170", mid: "255,176,84", tail: "255,136,44" },
  { offset: -38, perp: -4.6, size: 0.82, blur: 0.4, alpha: 0.68, core: "255,216,160", mid: "255,170,78", tail: "255,132,42" },
  { offset: -44, perp: 4.4, size: 0.68, blur: 0.42, alpha: 0.62, core: "255,210,152", mid: "255,164,72", tail: "255,128,40" },
  { offset: -50, perp: -4.0, size: 0.55, blur: 0.45, alpha: 0.56, core: "255,204,144", mid: "255,158,68", tail: "255,124,38" },
  { offset: -56, perp: 3.4, size: 0.44, blur: 0.48, alpha: 0.5, core: "255,200,138", mid: "255,154,64", tail: "255,120,36" },
  { offset: -62, perp: -2.8, size: 0.35, blur: 0.5, alpha: 0.44, core: "255,196,132", mid: "255,150,60", tail: "255,118,34" },
  { offset: -68, perp: 2.2, size: 0.28, blur: 0.52, alpha: 0.38, core: "255,192,126", mid: "255,146,56", tail: "255,116,32" },
  { offset: -74, perp: -1.6, size: 0.22, blur: 0.55, alpha: 0.32, core: "255,188,120", mid: "255,142,52", tail: "255,114,30" },
  // FORK 段 —— 末端 V 字散开，相对 -60~-88 offset 区间放大 perp 到 ±8~12，形成分叉
  { offset: -60, perp: 8.5, size: 0.5, blur: 0.5, alpha: 0.38, core: "255,202,146", mid: "255,156,66", tail: "255,122,38" },
  { offset: -60, perp: -8.5, size: 0.5, blur: 0.5, alpha: 0.38, core: "255,202,146", mid: "255,156,66", tail: "255,122,38" },
  { offset: -70, perp: 11.0, size: 0.38, blur: 0.55, alpha: 0.3, core: "255,194,134", mid: "255,148,58", tail: "255,118,34" },
  { offset: -70, perp: -11.0, size: 0.38, blur: 0.55, alpha: 0.3, core: "255,194,134", mid: "255,148,58", tail: "255,118,34" },
  { offset: -82, perp: 12.5, size: 0.28, blur: 0.6, alpha: 0.24, core: "255,188,126", mid: "255,142,52", tail: "255,114,30" },
  { offset: -82, perp: -12.5, size: 0.28, blur: 0.6, alpha: 0.24, core: "255,188,126", mid: "255,142,52", tail: "255,114,30" },
  // SPARK 段 —— 更远处飞溅，模拟火焰末端细碎火星脱离主轨迹
  { offset: -92, perp: 6.0, size: 0.22, blur: 0.5, alpha: 0.22, core: "255,184,118", mid: "255,138,48", tail: "255,110,28" },
  { offset: -92, perp: -6.0, size: 0.22, blur: 0.5, alpha: 0.22, core: "255,184,118", mid: "255,138,48", tail: "255,110,28" },
  { offset: -98, perp: 14.0, size: 0.2, blur: 0.55, alpha: 0.18, core: "255,180,112", mid: "255,134,44", tail: "255,106,26" },
  { offset: -98, perp: -14.0, size: 0.2, blur: 0.55, alpha: 0.18, core: "255,180,112", mid: "255,134,44", tail: "255,106,26" },
  { offset: -106, perp: 9.5, size: 0.18, blur: 0.6, alpha: 0.15, core: "255,176,106", mid: "255,130,40", tail: "255,102,24" },
  { offset: -106, perp: -9.5, size: 0.18, blur: 0.6, alpha: 0.15, core: "255,176,106", mid: "255,130,40", tail: "255,102,24" },
];

const COINS: CoinConfig[] = [
  {
    symbol: "BTC",
    label: "Bitcoin",
    src: "/images/hero/coin-btc.png",
    anchor: { top: "24%", left: "27%" },
    sizeClass: "w-[60px] md:w-[108px]",
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
    anchor: { top: "24%", right: "27%" },
    sizeClass: "w-[58px] md:w-[104px]",
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
    anchor: { top: "65%", left: "24%" },
    sizeClass: "w-[54px] md:w-[96px]",
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
    anchor: { top: "65%", right: "24%" },
    sizeClass: "w-[56px] md:w-[100px]",
    depth: 0.75,
    phaseX1: 0.8,
    phaseX2: 2.5,
    phaseY1: 3.1,
    phaseY2: 0.2,
    freqScale: 1.27,
  },
];

export function CoinsLayer({ mouseX, mouseY, reduceMotion }: CoinsLayerProps) {
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
    <div ref={layerRef} className="absolute inset-0 z-30">
      {COINS.map((coin) => {
        const t = tick * coin.freqScale;
        const floatX = reduceMotion
          ? 0
          : Math.sin(t * 0.6 + coin.phaseX1) * 30 +
            Math.sin(t * 0.23 + coin.phaseX2) * 18;
        const floatY = reduceMotion
          ? 0
          : Math.cos(t * 0.5 + coin.phaseY1) * 22 +
            Math.sin(t * 0.31 + coin.phaseY2) * 14;

        return (
          <CoinItem
            key={coin.symbol}
            coin={coin}
            translateX={floatX}
            translateY={floatY}
            reduceMotion={reduceMotion}
            onEngageTrail={engageTrail}
            onLingerTrail={lingerTrail}
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
  onEngageTrail,
  onLingerTrail,
}: CoinItemProps) {
  // v1 用 key=`${symbol}-burst-${burstId}` 每次 mouseenter 改 key → motion.div remount，
  // remount 间隙 img 瞬态消失就是 Dan 看到的闪烁。
  // v2 改用 useAnimationControls 手动 start keyframes，不 remount，不闪烁。
  const controls = useAnimationControls();
  const [bursting, setBursting] = useState(false);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []);

  const baseFilter = bursting
    ? "drop-shadow(0 0 12px rgba(255,205,98,0.52)) saturate(1.08)"
    : "drop-shadow(0 0 18px rgba(124,92,255,0.35))";

  return (
    <div
      className="absolute"
      style={{
        top: coin.anchor.top,
        left: coin.anchor.left,
        right: coin.anchor.right,
      }}
    >
      <div
        className={`${coin.sizeClass} relative pointer-events-auto cursor-pointer`}
        style={{
          transform: `translate(${translateX}px, ${translateY}px)`,
          transition: "transform 180ms ease-out",
        }}
        onMouseEnter={(event) => {
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
          onLingerTrail();
        }}
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
      </div>
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
