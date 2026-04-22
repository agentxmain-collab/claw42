"use client";

import { useEffect, useRef, useState } from "react";

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
    anchor: { top: "22%", left: "20%" },
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
    anchor: { top: "18%", right: "21%" },
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
    anchor: { top: "58%", left: "14%" },
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
    anchor: { top: "52%", right: "15%" },
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

function CoinItem({ coin, translateX, translateY, reduceMotion }: CoinItemProps) {
  const [hovered, setHovered] = useState(false);
  const [trailA, setTrailA] = useState({ x: 0, y: 0 });
  const [trailB, setTrailB] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!hovered || reduceMotion) {
      setTrailA({ x: 0, y: 0 });
      setTrailB({ x: 0, y: 0 });
      return;
    }

    const idA = setTimeout(() => setTrailA({ x: translateX, y: translateY }), 80);
    const idB = setTimeout(() => setTrailB({ x: translateX, y: translateY }), 160);
    return () => {
      clearTimeout(idA);
      clearTimeout(idB);
    };
  }, [hovered, reduceMotion, translateX, translateY]);

  const baseFilter = hovered
    ? "drop-shadow(0 0 48px rgba(124,92,255,0.9)) saturate(1.4)"
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
        className={`${coin.sizeClass} relative pointer-events-auto`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered && !reduceMotion && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coin.src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-auto select-none pointer-events-none"
              style={{
                transform: `translate(${trailB.x}px, ${trailB.y}px)`,
                opacity: 0.15,
                filter: "blur(4px) saturate(1.6)",
                transition: "transform 200ms ease-out, opacity 200ms ease-out",
              }}
            />
          </>
        )}
        {hovered && !reduceMotion && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coin.src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-auto select-none pointer-events-none"
              style={{
                transform: `translate(${trailA.x}px, ${trailA.y}px)`,
                opacity: 0.35,
                filter: "blur(2px) saturate(1.5)",
                transition: "transform 160ms ease-out, opacity 160ms ease-out",
              }}
            />
          </>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coin.src}
          alt=""
          aria-label={coin.label}
          draggable={false}
          className="relative w-full h-auto select-none pointer-events-auto cursor-pointer"
          style={{
            transform: `translate(${translateX}px, ${translateY}px)`,
            filter: baseFilter,
            transition: "filter 240ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
