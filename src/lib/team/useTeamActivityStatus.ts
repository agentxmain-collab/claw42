"use client";

import { useMemo } from "react";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { TEAM_MEMBER_IDS, isTeamMemberId, type TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  TeamActivitySnapshot,
  TeamActivityStatus,
  TeamActivityStatusMap,
} from "@/lib/team/teamWorkflowTypes";

const ANALYZING_WINDOW_MS = 2 * 60 * 1000;
const COMPLETED_RECENTLY_WINDOW_MS = 15 * 60 * 1000;

export function useTeamActivityStatus({
  events,
  loading = false,
  now = Date.now(),
}: {
  events: PublicTimelineEvent[];
  loading?: boolean;
  now?: number;
}): TeamActivityStatusMap {
  return useMemo(
    () => deriveTeamActivityStatuses(events, { loading, now }),
    [events, loading, now],
  );
}

export function deriveTeamActivityStatuses(
  events: PublicTimelineEvent[],
  options: { loading?: boolean; now?: number } = {},
): TeamActivityStatusMap {
  const now = options.now ?? Date.now();
  const lastActivityByMember = new Map<TeamMemberId, { ts: number; recordId: string | null }>();

  for (const event of events) {
    for (const memberId of membersForEvent(event)) {
      const current = lastActivityByMember.get(memberId);
      if (!current || event.ts > current.ts) {
        lastActivityByMember.set(memberId, { ts: event.ts, recordId: recordIdForEvent(event) });
      }
    }
  }

  return Object.fromEntries(
    TEAM_MEMBER_IDS.map((memberId) => {
      const lastActivity = lastActivityByMember.get(memberId);
      const snapshot: TeamActivitySnapshot = {
        memberId,
        status: statusFromActivity(lastActivity?.ts ?? null, now, Boolean(options.loading)),
        lastActivityTs: lastActivity?.ts ?? null,
        activeRecordId: lastActivity?.recordId ?? null,
      };
      return [memberId, snapshot] as const;
    }),
  );
}

function membersForEvent(event: PublicTimelineEvent): TeamMemberId[] {
  if (event.payload.kind === "pm_decision") {
    const members = new Set<TeamMemberId>();
    for (const memberId of Object.keys(event.payload.rationaleByMember)) {
      if (isTeamMemberId(memberId)) members.add(memberId);
    }
    for (const memberId of Object.keys(event.payload.citationsByMember ?? {})) {
      if (isTeamMemberId(memberId)) members.add(memberId);
    }
    if (members.size === 0) members.add("pm");
    return Array.from(members);
  }

  if (event.payload.kind === "team_discussion") {
    return event.payload.turns.map((turn) => turn.memberId);
  }

  return [];
}

function recordIdForEvent(event: PublicTimelineEvent) {
  if (event.payload.kind === "pm_decision" || event.payload.kind === "team_discussion") {
    return event.payload.recordId;
  }
  return null;
}

function statusFromActivity(
  lastActivityTs: number | null,
  now: number,
  loading: boolean,
): TeamActivityStatus {
  if (!lastActivityTs) return loading ? "waiting_data" : "idle";
  const age = Math.max(0, now - lastActivityTs);
  if (age <= ANALYZING_WINDOW_MS) return "analyzing";
  if (age <= COMPLETED_RECENTLY_WINDOW_MS) return "completed_recently";
  return "idle";
}
