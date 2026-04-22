"use client";

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
  radiusX: number;
  radiusY: number;
  period: number;
  phaseOffset: number;
}

const COINS: CoinConfig[] = [
  {
    symbol: "BTC",
    label: "Bitcoin",
    src: "/images/hero/coin-btc.png",
    anchor: { top: "20%", left: "18%" },
    sizeClass: "w-[44px] md:w-[76px]",
    depth: 0.8,
    radiusX: 38,
    radiusY: 22,
    period: 7.2,
    phaseOffset: 0,
  },
  {
    symbol: "ETH",
    label: "Ethereum",
    src: "/images/hero/coin-eth.png",
    anchor: { top: "15%", right: "19%" },
    sizeClass: "w-[42px] md:w-[72px]",
    depth: 0.7,
    radiusX: 42,
    radiusY: 26,
    period: 8.3,
    phaseOffset: 1.8,
  },
  {
    symbol: "SOL",
    label: "Solana",
    src: "/images/hero/coin-sol.png",
    anchor: { top: "55%", left: "12%" },
    sizeClass: "w-[40px] md:w-[64px]",
    depth: 0.9,
    radiusX: 34,
    radiusY: 20,
    period: 6.8,
    phaseOffset: 3.1,
  },
  {
    symbol: "USDT",
    label: "Tether",
    src: "/images/hero/coin-usdt.png",
    anchor: { top: "48%", right: "13%" },
    sizeClass: "w-[42px] md:w-[68px]",
    depth: 0.75,
    radiusX: 36,
    radiusY: 24,
    period: 9.1,
    phaseOffset: 0.6,
  },
];

export function CoinsLayer({ mouseX, mouseY, reduceMotion }: CoinsLayerProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {COINS.map((coin) => {
        const parallaxX = reduceMotion ? 0 : mouseX * coin.depth * 24;
        const parallaxY = reduceMotion ? 0 : mouseY * coin.depth * 14;

        return (
          <div
            key={coin.symbol}
            className="absolute"
            style={{
              top: coin.anchor.top,
              left: coin.anchor.left,
              right: coin.anchor.right,
              transform: `translate(${parallaxX}px, ${parallaxY}px)`,
              transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <motion.div
              animate={
                reduceMotion
                  ? { x: 0, y: 0 }
                  : {
                      x: [0, coin.radiusX, 0, -coin.radiusX, 0],
                      y: [0, -coin.radiusY, 0, coin.radiusY, 0],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: coin.period,
                      delay: coin.phaseOffset,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            >
              <motion.div
                className="group relative cursor-pointer pointer-events-auto"
                whileHover={
                  reduceMotion
                    ? { scale: 1.15 }
                    : { scale: 1.3, rotate: 360, zIndex: 10 }
                }
                transition={{
                  scale: { duration: 0.28, ease: "easeOut" },
                  rotate: { duration: 0.8, ease: "easeOut" },
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coin.src}
                  alt=""
                  aria-label={coin.label}
                  className={`${coin.sizeClass} drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] select-none`}
                  draggable={false}
                />
                <span
                  className="absolute left-1/2 -translate-x-1/2 -top-10 px-3 py-1 rounded-full bg-black/80 text-white text-xs font-semibold tracking-wide pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap"
                  aria-hidden="true"
                >
                  {coin.symbol}
                </span>
              </motion.div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
