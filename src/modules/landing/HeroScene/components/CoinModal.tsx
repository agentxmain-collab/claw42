"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_ORDER, AGENT_META } from "@/modules/agent-watch/agents";
import { useAgentAnalysis, useMarketTicker } from "@/modules/agent-watch/hooks/useAgentAnalysis";
import type { CoinSymbol, TickerMap } from "@/modules/agent-watch/types";

const COIN_META: Record<CoinSymbol, { name: string; image: string }> = {
  BTC: { name: "Bitcoin", image: "/images/hero/coin-btc.png" },
  ETH: { name: "Ethereum", image: "/images/hero/coin-eth.png" },
  SOL: { name: "Solana", image: "/images/hero/coin-sol.png" },
  USDT: { name: "Tether", image: "/images/hero/coin-usdt.png" },
};

function formatPrice(symbol: CoinSymbol, tickers?: TickerMap) {
  const ticker = tickers?.[symbol];
  if (!ticker) return null;
  return `$${ticker.price.toLocaleString("en-US", {
    minimumFractionDigits: symbol === "USDT" ? 4 : 0,
    maximumFractionDigits: symbol === "USDT" ? 4 : 2,
  })}`;
}

export function CoinModal({
  symbol,
  onClose,
}: {
  symbol: CoinSymbol;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const isZh = locale === "zh_CN";
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const { data: analysis } = useAgentAnalysis({ enabled: isZh });
  const { data: tickerPayload } = useMarketTicker({ enabled: true });
  const tickers = analysis?.tickers ?? tickerPayload?.tickers;
  const price = formatPrice(symbol, tickers);
  const change = tickers?.[symbol]?.change24h;
  const comments = isZh ? analysis?.coinComments?.[symbol] : undefined;

  const changeLabel = useMemo(() => {
    if (typeof change !== "number") return null;
    return `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}% (24h)`;
  }, [change]);

  useEffect(() => {
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      lastActiveElementRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coin-modal-title"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="card-glow relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 text-white shadow-2xl md:p-8"
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label={t.coinModal.closeAriaLabel}
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>

        <div className="flex items-center gap-4">
          <Image
            src={COIN_META[symbol].image}
            alt=""
            aria-hidden="true"
            width={86}
            height={86}
            className="h-20 w-20 object-contain drop-shadow-[0_0_20px_rgba(124,92,255,0.45)]"
          />
          <div>
            <h2 id="coin-modal-title" className="text-2xl font-bold">
              {COIN_META[symbol].name} ({symbol})
            </h2>
            <p className="mt-1 font-mono text-lg text-white/80">
              {price ?? "--"}
              <span
                className={`ml-2 text-sm ${
                  typeof change === "number" && change >= 0 ? "text-cw-green" : "text-cw-red"
                }`}
                title={price ? undefined : t.coinModal.loadingPrice}
              >
                {changeLabel ?? t.coinModal.loadingPrice}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isZh && comments ? (
            AGENT_ORDER.map((agentId) => (
              <div key={agentId} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-sm leading-relaxed text-white/78">
                  <span style={{ color: AGENT_META[agentId].color }} className="font-bold">
                    {AGENT_META[agentId].name}：
                  </span>
                  {comments[agentId]}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/55">
              {t.coinModal.agentCommentMissing}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t.coinModal.closeAriaLabel}
          </button>
          <a
            href={`/${locale}/agent`}
            className="h-11 flex-1 rounded-xl bg-[#7c5cff] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#8e6bff] inline-flex items-center justify-center"
          >
            {t.coinModal.goToWatchCta} →
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
