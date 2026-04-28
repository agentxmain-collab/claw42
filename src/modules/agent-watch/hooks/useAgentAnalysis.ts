"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAgentAnalysis, fetchMarketTicker } from "../api/llmClient";
import type { AgentAnalysisPayload, MarketTickerPayload } from "../types";

interface UseAgentAnalysisOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function useAgentAnalysis({
  enabled = true,
  intervalMs = 60_000,
}: UseAgentAnalysisOptions = {}) {
  const [data, setData] = useState<AgentAnalysisPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      setIsLoading(true);
      try {
        const next = await fetchAgentAnalysis(signal);
        setData(next);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("agent analysis failed"));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

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

  return { data, error, isLoading, refresh: load };
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
