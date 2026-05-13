import { describe, expect, test } from "vitest";
import { deriveTeamActivityStatuses } from "@/lib/team/useTeamActivityStatus";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const now = Date.UTC(2026, 4, 11, 12, 0, 0);

function pmDecision(ts: number): PublicTimelineEvent {
  return {
    id: "pm-1",
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "record-1",
      symbol: "BTC",
      tradeDecision: null,
      rationaleByMember: {
        fundamental_analyst: "Fundamental rationale.",
        risk_lead: "Risk rationale.",
      },
      citationsByMember: {
        research_lead: ["ev_1"],
      },
    },
  };
}

function discussion(ts: number): PublicTimelineEvent {
  return {
    id: "discussion-1",
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "team_discussion",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "team_discussion",
      recordId: "record-2",
      turns: [{ memberId: "pm", text: "PM summary.", citations: [] }],
    },
  };
}

describe("deriveTeamActivityStatuses", () => {
  test("marks members from PM process payload as recently active", () => {
    const statuses = deriveTeamActivityStatuses([pmDecision(now - 60_000)], { now });

    expect(statuses.fundamental_analyst?.status).toBe("analyzing");
    expect(statuses.risk_lead?.status).toBe("analyzing");
    expect(statuses.research_lead?.status).toBe("analyzing");
    expect(statuses.pm?.status).toBe("idle");
  });

  test("uses completed and idle windows for older activity", () => {
    const statuses = deriveTeamActivityStatuses(
      [pmDecision(now - 10 * 60_000), discussion(now - 70 * 60_000)],
      { now },
    );

    expect(statuses.fundamental_analyst?.status).toBe("completed_recently");
    expect(statuses.pm?.status).toBe("idle");
  });

  test("marks missing activity as waiting when timeline is loading", () => {
    const statuses = deriveTeamActivityStatuses([], { now, loading: true });

    expect(statuses.news_analyst?.status).toBe("waiting_data");
  });
});
