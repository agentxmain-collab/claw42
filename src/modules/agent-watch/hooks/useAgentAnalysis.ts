"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAgentAnalysis, fetchMarketTicker } from "../api/llmClient";
import type { AgentAnalysisPayload, MarketTickerPayload } from "../types";
import type { AgentWatchLocale } from "../locale";

interface UseAgentAnalysisOptions {
  enabled?: boolean;
  intervalMs?: number;
  locale?: AgentWatchLocale;
}

export function useAgentAnalysis({
  enabled = true,
  intervalMs = 60_000,
  locale = "zh_CN",
}: UseAgentAnalysisOptions = {}) {
  const [data, setData] = useState<AgentAnalysisPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasNewContent, setHasNewContent] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isVisibleRef = useRef(typeof document === "undefined" ? true : !document.hidden);
  const lastSeenGeneratedAtRef = useRef<number | null>(null);
  const latestGeneratedAtRef = useRef<number | null>(null);

  const applyPayload = useCallback((payload: AgentAnalysisPayload) => {
    latestGeneratedAtRef.current = payload.generatedAt;
    setData(payload);
    setError(null);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal, detectNewContent = false) => {
      if (!enabled || !isVisibleRef.current) return;
      setIsLoading(true);
      try {
        const next = await fetchAgentAnalysis(signal, locale);
        if (
          detectNewContent &&
          lastSeenGeneratedAtRef.current !== null &&
          next.generatedAt > lastSeenGeneratedAtRef.current
        ) {
          setHasNewContent(true);
        }
        applyPayload(next);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("agent analysis failed"));
      } finally {
        setIsLoading(false);
      }
    },
    [applyPayload, enabled, locale],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    isVisibleRef.current = !document.hidden;

    function startPolling(detectNewContent = false) {
      if (intervalRef.current !== null) return;
      void load(controller.signal, detectNewContent);
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
      const visible = !document.hidden;
      isVisibleRef.current = visible;
      if (visible) {
        startPolling(true);
      } else {
        if (latestGeneratedAtRef.current !== null) {
          lastSeenGeneratedAtRef.current = latestGeneratedAtRef.current;
        }
        stopPolling();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (isVisibleRef.current) startPolling();

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [enabled, intervalMs, load]);

  const dismissNewContent = useCallback(() => {
    setHasNewContent(false);
  }, []);

  return { data, error, isLoading, refresh: load, hasNewContent, dismissNewContent };
}

export function useMarketTicker({ enabled = true, intervalMs = 30_000 } = {}) {
  const [data, setData] = useState<MarketTickerPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      try {
        const next = await fetchMarketTicker(signal);
        setData(next);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("ticker failed"));
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      void load();
    }, intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, load]);

  return { data, error, refresh: load };
}
