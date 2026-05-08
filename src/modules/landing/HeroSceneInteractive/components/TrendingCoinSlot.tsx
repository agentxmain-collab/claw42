"use client";

import { motion } from "framer-motion";
import type { HeroTrendingCoin } from "../types/trending-coin";
import { clampCoinScale, isExtremeDrop, priceMovementToScale } from "../utils/priceMovementToScale";

interface TrendingCoinSlotProps {
  coin: HeroTrendingCoin;
  selected: boolean;
  reduceMotion: boolean;
  onSelect: (coin: HeroTrendingCoin) => void;
}

function formatChange(change: number) {
  if (!Number.isFinite(change)) return "0.00%";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "$--";
  if (price >= 1000) return `$${Math.round(price).toLocaleString("en-US")}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

export function TrendingCoinSlot({
  coin,
  selected,
  reduceMotion,
  onSelect,
}: TrendingCoinSlotProps) {
  const scale = clampCoinScale(priceMovementToScale(coin.changePercent24h));
  const changeLabel = formatChange(coin.changePercent24h);
  const positive = coin.changePercent24h >= 0;
  const extremeDrop = isExtremeDrop(coin.changePercent24h);

  return (
    <div className="relative flex h-[104px] w-[104px] items-center justify-center md:h-[128px] md:w-[128px]">
      <motion.button
        type="button"
        aria-label={`${coin.name} ${changeLabel}`}
        onClick={() => onSelect(coin)}
        initial={false}
        animate={
          reduceMotion
            ? { scale: 1 }
            : {
                scale,
                opacity: extremeDrop ? 0.82 : 1,
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                type: "spring",
                damping: 20,
                stiffness: 200,
              }
        }
        className={`group relative flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors md:h-20 md:w-20 ${
          selected
            ? "border-[#62f0ff] bg-[#133d49]/90 shadow-[0_0_32px_rgba(98,240,255,0.52)]"
            : "border-white/18 bg-black/48 shadow-[0_0_22px_rgba(98,240,255,0.18)] hover:border-[#62f0ff]/80"
        } ${extremeDrop ? "grayscale" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full ${
            positive
              ? "bg-[radial-gradient(circle,rgba(108,255,184,0.28),transparent_62%)]"
              : "bg-[radial-gradient(circle,rgba(255,178,108,0.22),transparent_62%)]"
          }`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- CoinGecko returns dynamic remote image URLs. */}
        <img
          src={coin.image}
          alt=""
          draggable={false}
          className="relative h-9 w-9 rounded-full md:h-12 md:w-12"
        />
        <span className="bg-black/78 absolute -bottom-8 left-1/2 min-w-20 -translate-x-1/2 rounded-md border border-white/10 px-2 py-1 text-center text-[11px] leading-tight text-white shadow-lg md:-bottom-9 md:text-xs">
          <span className="block font-semibold">{coin.symbol}</span>
          <span className={positive ? "text-[#7afacb]" : "text-[#ffbe82]"}>{changeLabel}</span>
        </span>
        <span className="sr-only">{formatPrice(coin.priceUsd)}</span>
      </motion.button>
    </div>
  );
}
