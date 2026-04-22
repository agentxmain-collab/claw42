"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const TRAIL_LIFETIME_MS = 4200;
const TRAIL_POINT_THRESHOLD = 1.1;
const MAX_TRAIL_POINTS = 72;
const TRAIL_FOLLOW_AFTER_LEAVE_MS = 1400;

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
  const [burstId, setBurstId] = useState(0);
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
          setBurstId((current) => current + 1);
          setBursting(true);
          if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
          burstTimerRef.current = setTimeout(() => setBursting(false), 900);
          if (!reduceMotion) onEngageTrail(event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (!reduceMotion) onEngageTrail(event.clientX, event.clientY);
        }}
        onMouseLeave={() => {
          onLingerTrail();
        }}
      >
        <motion.div
          key={`${coin.symbol}-burst-${burstId}`}
          initial={false}
          animate={
            bursting && !reduceMotion
              ? {
                  x: [0, -2.6, 3.8, -2.1, 1.1, 0],
                  y: [0, 1.6, -2.2, 1.4, -0.7, 0],
                  rotate: [0, -2.2, 1.6, -0.9, 0.4, 0],
                  scale: [1, 1.05, 0.98, 1.03, 1],
                }
              : { x: 0, y: 0, rotate: 0, scale: 1 }
          }
          transition={
            bursting && !reduceMotion
              ? { duration: 0.34, ease: "easeOut" }
              : { duration: 0.16 }
          }
        >
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
          const drift = Math.max(26, Math.min(68, distance * 4.8 + 18));

          return (
            <motion.div
              key={point.id}
              className="absolute pointer-events-none"
              style={{
                left: point.x,
                top: point.y,
              }}
              initial={{ opacity: 0.98, scale: 0.8 }}
              animate={{
                opacity: 0,
                scale: 1.22,
                x: -nx * drift,
                y: -ny * drift,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: TRAIL_LIFETIME_MS / 1000, ease: "easeOut" }}
              aria-hidden="true"
            >
              <span
                className="absolute rounded-full"
                style={{
                  left: -5,
                  top: -5,
                  width: 10,
                  height: 10,
                  background:
                    "radial-gradient(circle, rgba(255,252,225,0.98) 0%, rgba(255,217,118,0.9) 38%, rgba(255,161,51,0.42) 72%, rgba(255,161,51,0) 100%)",
                  filter: "blur(1px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 12 - ny * 4 - 4,
                  top: -ny * 12 + nx * 4 - 4,
                  width: 8,
                  height: 8,
                  background:
                    "radial-gradient(circle, rgba(255,248,216,0.92) 0%, rgba(255,204,98,0.68) 58%, rgba(255,150,45,0) 100%)",
                  filter: "blur(1.4px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 20 + ny * 6 - 3.5,
                  top: -ny * 20 - nx * 6 - 3.5,
                  width: 7,
                  height: 7,
                  background:
                    "radial-gradient(circle, rgba(255,246,210,0.88) 0%, rgba(255,196,82,0.6) 65%, rgba(255,145,40,0) 100%)",
                  filter: "blur(1.6px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 28 - ny * 8 - 3,
                  top: -ny * 28 + nx * 8 - 3,
                  width: 6,
                  height: 6,
                  background:
                    "radial-gradient(circle, rgba(255,241,196,0.82) 0%, rgba(255,184,72,0.5) 62%, rgba(255,142,38,0) 100%)",
                  filter: "blur(1.8px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 34 + ny * 6 - 2.5,
                  top: -ny * 34 - nx * 6 - 2.5,
                  width: 5,
                  height: 5,
                  background:
                    "radial-gradient(circle, rgba(255,245,210,0.76) 0%, rgba(255,190,78,0.44) 62%, rgba(255,142,38,0) 100%)",
                  filter: "blur(1.8px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 42 - ny * 12 - 2,
                  top: -ny * 42 + nx * 12 - 2,
                  width: 4,
                  height: 4,
                  background:
                    "radial-gradient(circle, rgba(255,248,220,0.72) 0%, rgba(255,196,82,0.4) 62%, rgba(255,145,40,0) 100%)",
                  filter: "blur(1.6px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 52 + ny * 14 - 1.7,
                  top: -ny * 52 - nx * 14 - 1.7,
                  width: 3.4,
                  height: 3.4,
                  background:
                    "radial-gradient(circle, rgba(255,248,220,0.72) 0%, rgba(255,196,82,0.34) 62%, rgba(255,145,40,0) 100%)",
                  filter: "blur(1.6px)",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  left: -nx * 60 - ny * 16 - 1.4,
                  top: -ny * 60 + nx * 16 - 1.4,
                  width: 2.8,
                  height: 2.8,
                  background:
                    "radial-gradient(circle, rgba(255,249,228,0.68) 0%, rgba(255,196,82,0.3) 62%, rgba(255,145,40,0) 100%)",
                  filter: "blur(1.4px)",
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
