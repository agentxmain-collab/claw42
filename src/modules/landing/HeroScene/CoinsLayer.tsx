"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

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

interface CoinItemProps {
  coin: CoinConfig;
  translateX: number;
  translateY: number;
  reduceMotion: boolean;
}

const SPARKS = [
  { size: 3, width: 28, height: 4, angle: -78, x: -18, y: -38, delay: 0.0 },
  { size: 3, width: 34, height: 4, angle: -32, x: 38, y: -20, delay: 0.05 },
  { size: 4, width: 30, height: 5, angle: 18, x: 42, y: 10, delay: 0.1 },
  { size: 3, width: 26, height: 4, angle: 58, x: 22, y: 36, delay: 0.16 },
  { size: 3, width: 28, height: 4, angle: 118, x: -22, y: 34, delay: 0.22 },
  { size: 4, width: 24, height: 4, angle: 164, x: -40, y: 8, delay: 0.28 },
  { size: 3, width: 22, height: 3, angle: -142, x: -34, y: -18, delay: 0.34 },
  { size: 3, width: 20, height: 3, angle: -102, x: -6, y: -44, delay: 0.4 },
];

function CoinItem({ coin, translateX, translateY, reduceMotion }: CoinItemProps) {
  const [hovered, setHovered] = useState(false);
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
        onMouseEnter={() => {
          setHovered(true);
          setBurstId((current) => current + 1);
          setBursting(true);
          if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
          burstTimerRef.current = setTimeout(() => setBursting(false), 900);
        }}
        onMouseLeave={() => setHovered(false)}
      >
        {bursting && !reduceMotion && (
          <>
            <motion.span
              key={`${coin.symbol}-tail-main-${burstId}`}
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: "132%",
                height: "34%",
                background:
                  "linear-gradient(90deg, rgba(255,242,184,0.94) 0%, rgba(255,207,92,0.82) 28%, rgba(255,154,42,0.5) 62%, rgba(255,154,42,0) 100%)",
                filter: "blur(10px)",
                transformOrigin: "left center",
                rotate: "26deg",
                zIndex: 0,
              }}
              initial={{ x: -18, y: -4, opacity: 0, scaleX: 0.2, scaleY: 0.7 }}
              animate={{
                x: [-18, -6, 10, 16],
                y: [-4, -2, 2, 4],
                opacity: [0, 0.88, 0.35, 0],
                scaleX: [0.18, 0.92, 1.16, 1.24],
                scaleY: [0.7, 1, 1.08, 1.12],
              }}
              transition={{ duration: 0.82, ease: "easeOut" }}
              aria-hidden="true"
            />
            <motion.span
              key={`${coin.symbol}-tail-sub-${burstId}`}
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: "96%",
                height: "24%",
                background:
                  "linear-gradient(90deg, rgba(255,251,222,0.92) 0%, rgba(255,219,120,0.75) 36%, rgba(255,156,44,0.38) 70%, rgba(255,156,44,0) 100%)",
                filter: "blur(7px)",
                transformOrigin: "left center",
                rotate: "14deg",
                zIndex: 0,
              }}
              initial={{ x: -10, y: 4, opacity: 0, scaleX: 0.18, scaleY: 0.66 }}
              animate={{
                x: [-10, -2, 8, 12],
                y: [4, 3, 5, 6],
                opacity: [0, 0.72, 0.28, 0],
                scaleX: [0.16, 0.84, 1.02, 1.12],
                scaleY: [0.66, 1, 1.04, 1.08],
              }}
              transition={{ duration: 0.76, ease: "easeOut" }}
              aria-hidden="true"
            />
          </>
        )}
        {bursting && !reduceMotion &&
          SPARKS.map((spark, index) => (
            <motion.span
              key={`${coin.symbol}-spark-${burstId}-${index}`}
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: spark.width,
                height: spark.height,
                background:
                  "linear-gradient(90deg, rgba(255,252,220,0.98) 0%, rgba(255,212,108,0.92) 36%, rgba(255,155,46,0.55) 72%, rgba(255,155,46,0) 100%)",
                boxShadow: "0 0 18px rgba(255,195,82,0.88)",
                transformOrigin: "left center",
                rotate: `${spark.angle}deg`,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.3, scaleY: 0.6 }}
              animate={{
                x: [0, spark.x],
                y: [0, spark.y],
                opacity: [0, 1, 0],
                scaleX: [0.28, 1.05, 0.38],
                scaleY: [0.72, 1, 0.56],
              }}
              transition={{
                duration: 0.52,
                delay: spark.delay,
                ease: "easeOut",
              }}
              aria-hidden="true"
            />
          ))}
        <motion.div
          key={`${coin.symbol}-burst-${burstId}`}
          initial={false}
          animate={
            hovered && !reduceMotion
              ? {
                  x: [0, -1.5, 2.4, -1.6, 0.9, 0],
                  y: [0, 1.2, -1.8, 1.6, -0.8, 0],
                  rotate: [0, -1.4, 1.2, -0.7, 0.3, 0],
                }
              : { x: 0, y: 0, rotate: 0 }
          }
          transition={
            bursting && !reduceMotion
              ? { duration: 0.26, ease: "easeOut" }
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
