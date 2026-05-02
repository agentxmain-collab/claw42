"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMarketEvents } from "../api/llmClient";
import type { SignalRecord } from "../types";

export function useMarketEventFeed({ enabled = true, intervalMs = 30_000, limit = 12 } = {}) {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isVisibleRef = useRef(typeof document === "undefined" ? true : !document.hidden);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !isVisibleRef.current) return;
      setIsLoading(true);
      try {
        const payload = await fetchMarketEvents(signal, limit);
        setSignals(payload.signals);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("market event feed failed"));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, limit],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    isVisibleRef.current = !document.hidden;

    function startPolling() {
      if (intervalRef.current !== null) return;
      void load(controller.signal);
      intervalRef.current = window.setInterval(() => {
        void load();
      }, intervalMs);
    }

    function stopPolling() {
      if (intervalRef.current === null) return;
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    function onVisibilityChange() {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current) startPolling();
      else stopPolling();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (isVisibleRef.current) startPolling();

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [enabled, intervalMs, load]);

  return { signals, isLoading, error, refresh: load };
}
