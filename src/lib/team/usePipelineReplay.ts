"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { TeamMemberId } from "@/lib/team/teamRegistry";

export type PipelineReplayTriggerReason = "user_expand" | "auto";

export const PIPELINE_REPLAY_SEQUENCE: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
  "research_lead",
  "risk_lead",
  "pm",
];

export function usePipelineReplay({
  recordId,
  enabled,
  triggerReason = "auto",
  replayKey = 0,
  stepMs = 900,
  reduceMotion = false,
}: {
  recordId: string | null;
  enabled: boolean;
  triggerReason?: PipelineReplayTriggerReason;
  replayKey?: string | number;
  stepMs?: number;
  reduceMotion?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!enabled || !recordId) {
      setActiveIndex(-1);
      return;
    }

    trackEvent("pipeline_replay_trigger", {
      record_id: recordId,
      trigger_reason: triggerReason,
    });

    if (reduceMotion) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex(0);
    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = current + 1;
        return next >= PIPELINE_REPLAY_SEQUENCE.length ? -1 : next;
      });
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [enabled, recordId, reduceMotion, replayKey, stepMs, triggerReason]);

  const activeMemberId = useMemo(
    () => (activeIndex >= 0 ? PIPELINE_REPLAY_SEQUENCE[activeIndex] : null),
    [activeIndex],
  );

  return {
    activeMemberId,
    isReplaying: activeMemberId !== null,
    sequence: PIPELINE_REPLAY_SEQUENCE,
  };
}
