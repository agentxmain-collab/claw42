"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHeroMiniPlayerData } from "../data/stub-mini-player-data";
import type { HeroMiniPlayerData } from "../types/mini-player";
import type { HeroTrendingCoin } from "../types/trending-coin";

export type MiniPlayerStatus = "idle" | "picking" | "loading" | "shown";

export function useMiniPlayer() {
  const [status, setStatus] = useState<MiniPlayerStatus>("idle");
  const [selectedCoin, setSelectedCoin] = useState<HeroTrendingCoin | null>(null);
  const [data, setData] = useState<HeroMiniPlayerData | null>(null);
  const requestIdRef = useRef(0);
  const loadingTimerRef = useRef<number | null>(null);

  const clearLoadingTimer = useCallback(() => {
    if (loadingTimerRef.current === null) return;
    window.clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = null;
  }, []);

  const selectCoin = useCallback(
    async (coin: HeroTrendingCoin) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      clearLoadingTimer();
      setSelectedCoin(coin);
      setData(null);
      setStatus("picking");

      loadingTimerRef.current = window.setTimeout(() => {
        if (requestIdRef.current === requestId) setStatus("loading");
      }, 120);
      const playerData = await fetchHeroMiniPlayerData(coin.symbol);
      if (requestIdRef.current !== requestId) return;
      clearLoadingTimer();
      setData(playerData);
      setStatus("shown");
    },
    [clearLoadingTimer],
  );

  const close = useCallback(() => {
    requestIdRef.current += 1;
    clearLoadingTimer();
    setStatus("idle");
    setSelectedCoin(null);
    setData(null);
  }, [clearLoadingTimer]);

  useEffect(() => clearLoadingTimer, [clearLoadingTimer]);

  return {
    status,
    selectedCoin,
    data,
    isOpen: status === "loading" || status === "shown",
    selectCoin,
    close,
  };
}
