"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
}

interface TrailPoint {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  createdAt: number;
}

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

  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

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
    <div className="absolute inset-0 pointer-events-none z-30">
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
          />
        );
      })}
    </div>
  );
}

function CoinItem({ coin, translateX, translateY, reduceMotion }: CoinItemProps) {
  const [hovered, setHovered] = useState(false);
  const [burstId, setBurstId] = useState(0);
  const [bursting, setBursting] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const trailIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (trailTimerRef.current) clearInterval(trailTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hovered && trail.length === 0) {
      if (trailTimerRef.current) {
        clearInterval(trailTimerRef.current);
        trailTimerRef.current = null;
      }
      return;
    }

    trailTimerRef.current = setInterval(() => {
      const now = Date.now();
      setTrail((current) => current.filter((point) => now - point.createdAt < 1000));
    }, 50);

    return () => {
      if (trailTimerRef.current) {
        clearInterval(trailTimerRef.current);
        trailTimerRef.current = null;
      }
    };
  }, [hovered, trail.length]);

  const baseFilter = bursting
    ? "drop-shadow(0 0 12px rgba(255,205,98,0.52)) saturate(1.08)"
    : "drop-shadow(0 0 18px rgba(124,92,255,0.35))";

  const addTrailPoint = (x: number, y: number) => {
    const last = lastPointRef.current;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    const distance = Math.hypot(dx, dy);

    lastPointRef.current = { x, y };

    if (last && distance < 1.5) return;

    setTrail((current) => [
      ...current.slice(-28),
      {
        id: trailIdRef.current++,
        x,
        y,
        dx,
        dy,
        createdAt: Date.now(),
      },
    ]);
  };

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
          setHovered(true);
          setBurstId((current) => current + 1);
          setBursting(true);
          if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
          burstTimerRef.current = setTimeout(() => setBursting(false), 900);

          if (!reduceMotion) {
            const rect = event.currentTarget.getBoundingClientRect();
            addTrailPoint(event.clientX - rect.left, event.clientY - rect.top);
          }
        }}
        onMouseMove={(event) => {
          if (reduceMotion) return;
          const rect = event.currentTarget.getBoundingClientRect();
          addTrailPoint(event.clientX - rect.left, event.clientY - rect.top);
        }}
        onMouseLeave={() => {
          setHovered(false);
          lastPointRef.current = null;
        }}
      >
        <AnimatePresence>
          {!reduceMotion &&
            trail.map((point) => {
              const distance = Math.max(1, Math.hypot(point.dx, point.dy));
              const nx = point.dx / distance;
              const ny = point.dy / distance;
              const drift = Math.max(8, Math.min(26, distance * 2.8 + 8));

              return (
                <motion.div
                  key={point.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: point.x,
                    top: point.y,
                    zIndex: 1,
                  }}
                  initial={{ opacity: 0.96, scale: 0.75 }}
                  animate={{
                    opacity: 0,
                    scale: 1.05,
                    x: -nx * drift,
                    y: -ny * drift,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.02, ease: "easeOut" }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: -4,
                      top: -4,
                      width: 8,
                      height: 8,
                      background:
                        "radial-gradient(circle, rgba(255,252,225,0.98) 0%, rgba(255,217,118,0.88) 38%, rgba(255,161,51,0.42) 72%, rgba(255,161,51,0) 100%)",
                      filter: "blur(0.8px)",
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: -nx * 10 - ny * 2 - 3,
                      top: -ny * 10 + nx * 2 - 3,
                      width: 6,
                      height: 6,
                      background:
                        "radial-gradient(circle, rgba(255,248,216,0.92) 0%, rgba(255,204,98,0.68) 58%, rgba(255,150,45,0) 100%)",
                      filter: "blur(1.2px)",
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: -nx * 18 + ny * 3 - 2.5,
                      top: -ny * 18 - nx * 3 - 2.5,
                      width: 5,
                      height: 5,
                      background:
                        "radial-gradient(circle, rgba(255,246,210,0.86) 0%, rgba(255,196,82,0.58) 65%, rgba(255,145,40,0) 100%)",
                      filter: "blur(1.4px)",
                    }}
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>

        <motion.div
          key={`${coin.symbol}-burst-${burstId}`}
          initial={false}
          animate={
            bursting && !reduceMotion
              ? {
                  x: [0, -2.6, 3.8, -2.1, 1.1, 0],
                  y: [0, 1.6, -2.2, 1.4, -0.7, 0],
                  rotate: [0, -2.2, 1.6, -0.9, 0.4, 0],
                  scale: [1, 1.04, 0.985, 1.02, 1],
                }
              : { x: 0, y: 0, rotate: 0, scale: 1 }
          }
          transition={
            bursting && !reduceMotion
              ? { duration: 0.32, ease: "easeOut" }
              : { duration: 0.16 }
          }
        >
          <motion.img
            src={coin.src}
            alt=""
            aria-label={coin.label}
            draggable={false}
            className="relative w-full h-auto select-none pointer-events-auto cursor-pointer"
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
