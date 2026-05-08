"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Dict, Locale } from "@/i18n/types";
import type { HeroMiniPlayerData } from "../types/mini-player";
import type { HeroTrendingCoin } from "../types/trending-coin";
import { HeroCTAButtons } from "./HeroCTAButtons";
import { MiniAgentMessage } from "./MiniAgentMessage";
import { MiniStrategyCard } from "./MiniStrategyCard";

interface HeroMiniPlayerProps {
  open: boolean;
  loading: boolean;
  data: HeroMiniPlayerData | null;
  coin: HeroTrendingCoin | null;
  locale: Locale;
  t: Dict;
  reduceMotion: boolean;
  onClose: () => void;
}

export function HeroMiniPlayer({
  open,
  loading,
  data,
  coin,
  locale,
  t,
  reduceMotion,
  onClose,
}: HeroMiniPlayerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-modal="false"
          aria-label={data ? `${data.displayName} ${t.hero.miniPlayer.title}` : t.hero.miniPlayer.loading}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
          className="fixed inset-x-3 bottom-3 z-[70] max-h-[78vh] overflow-y-auto rounded-lg border border-white/12 bg-[#050b12]/96 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl md:absolute md:bottom-[13%] md:right-[6%] md:left-auto md:w-[380px] md:max-h-[64vh]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8feeff]">
                {t.hero.miniPlayer.title}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {data?.displayName ?? coin?.name ?? t.hero.miniPlayer.loading}
              </h2>
              <p className="mt-1 text-xs text-[#aebdca]">{data?.priceLine ?? coin?.symbol}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label={t.hero.miniPlayerClose}
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-xl leading-none text-white transition-colors hover:bg-white/[0.12]"
            >
              ×
            </button>
          </div>

          {loading || !data || !coin ? (
            <div className="mt-5 min-h-40 rounded-md border border-white/10 bg-white/[0.045] p-4 text-sm text-[#d7e1ea]">
              {t.hero.miniPlayer.loading}
            </div>
          ) : (
            <>
              <ul className="mt-4 grid gap-2">
                {data.agentMessages.map((message) => (
                  <MiniAgentMessage key={`${data.symbol}-${message.agentName}`} message={message} />
                ))}
              </ul>
              <div className="mt-3">
                <MiniStrategyCard strategy={data.strategyCard} t={t} />
              </div>
              <HeroCTAButtons
                locale={locale}
                coin={coin}
                watchLabel={t.hero.cta.openAgentWatch}
                registerLabel={t.hero.cta.openCoinwAccountWithSymbol}
              />
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
