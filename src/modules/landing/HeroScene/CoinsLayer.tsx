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
        const parallaxX = reduceMotion ? 0 : mouseX * coin.depth * 24;
        const parallaxY = reduceMotion ? 0 : mouseY * coin.depth * 14;

        return (
          <CoinItem
            key={coin.symbol}
            coin={coin}
            translateX={floatX + parallaxX}
            translateY={floatY + parallaxY}
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
  { top: "-10%", left: "48%", size: 12, delay: 0, x: 0, y: -7 },
  { top: "22%", left: "92%", size: 10, delay: 0.06, x: 6, y: -2 },
  { top: "76%", left: "84%", size: 9, delay: 0.12, x: 5, y: 4 },
  { top: "90%", left: "34%", size: 11, delay: 0.18, x: -3, y: 6 },
  { top: "18%", left: "8%", size: 9, delay: 0.24, x: -6, y: -1 },
];

function CoinItem({ coin, translateX, translateY, reduceMotion }: CoinItemProps) {
  const [hovered, setHovered] = useState(false);

  const baseFilter = hovered
    ? "drop-shadow(0 0 28px rgba(255,198,92,0.8)) drop-shadow(0 0 54px rgba(124,92,255,0.62)) saturate(1.16)"
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered && !reduceMotion &&
          SPARKS.map((spark, index) => (
            <motion.span
              key={`${coin.symbol}-spark-${index}`}
              className="absolute pointer-events-none rounded-full"
              style={{
                top: spark.top,
                left: spark.left,
                width: spark.size,
                height: spark.size,
                background:
                  "radial-gradient(circle, rgba(255,245,182,0.98) 0%, rgba(255,208,92,0.88) 42%, rgba(255,168,56,0.35) 62%, transparent 78%)",
                boxShadow: "0 0 16px rgba(255,199,88,0.68)",
                transform: `translate(-50%, -50%) translate(${spark.x}px, ${spark.y}px)`,
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0.12, 1, 0.18], scale: [0.5, 1.2, 0.72] }}
              transition={{
                duration: 0.68,
                delay: spark.delay,
                repeat: Infinity,
                ease: "easeOut",
              }}
              aria-hidden="true"
            />
          ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
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
      </div>
    </div>
  );
}
