"use client";

import Link from "next/link";
import type { Locale } from "@/i18n/types";
import { trackEvent } from "@/lib/analytics";
import type { HeroTrendingCoin } from "../types/trending-coin";

interface HeroCTAButtonsProps {
  locale: Locale;
  coin: HeroTrendingCoin;
  watchLabel: string;
  registerLabel: string;
}

const coinwLocaleFallback: Partial<Record<Locale, string>> = {
  en_XA: "en_US",
};

export function HeroCTAButtons({
  locale,
  coin,
  watchLabel,
  registerLabel,
}: HeroCTAButtonsProps) {
  const symbol = coin.symbol.toUpperCase();
  const coinwLocale = coinwLocaleFallback[locale] ?? locale;
  const registerUrl = `https://www.coinw.com/${coinwLocale}/register?r=XXCryptoEN&utm_source=claw42_hero&utm_campaign=${encodeURIComponent(
    symbol.toLowerCase(),
  )}`;

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Link
        href={`/${locale}/agent?symbol=${encodeURIComponent(symbol)}&from=hero`}
        onClick={() =>
          trackEvent("hero_coin_watch_click", {
            locale,
            symbol,
            surface: "hero_mini_player_watch",
          })
        }
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#f4f0ff] px-4 py-2 text-sm font-semibold text-[#11131b] transition-colors hover:bg-white"
      >
        {watchLabel}
      </Link>
      <a
        href={registerUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackEvent("hero_coin_watch_click", {
            locale,
            symbol,
            surface: "hero_mini_player_register",
          })
        }
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#62f0ff]/36 bg-[#05202a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#09323f]"
      >
        {registerLabel.replace("{symbol}", symbol)}
      </a>
    </div>
  );
}
