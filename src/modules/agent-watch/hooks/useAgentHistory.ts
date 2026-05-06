"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryMessageEntry } from "../types";

interface UseAgentHistoryOptions {
  enabled: boolean;
  initialLimit?: number;
}

interface AgentHistoryState {
  entries: HistoryMessageEntry[];
  isLoading: boolean;
  error: Error | null;
  refreshHistory: () => Promise<void>;
}

export function useAgentHistory({
  enabled,
  initialLimit = 60,
}: UseAgentHistoryOptions): AgentHistoryState {
  const [entries, setEntries] = useState<HistoryMessageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/history?limit=${initialLimit}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`history ${response.status}`);
      const data = (await response.json()) as { entries: HistoryMessageEntry[] };
      if (!cancelledRef.current) {
        setEntries(data.entries);
        setError(null);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [enabled, initialLimit]);

  useEffect(() => {
    cancelledRef.current = false;
    void fetchHistory();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchHistory]);

  return { entries, isLoading, error, refreshHistory: fetchHistory };
}
