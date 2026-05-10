import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { Dict } from "@/i18n/types";
import { TeamMemberCard } from "@/components/agent-watch/TeamMemberCard";

vi.mock("next/image", () => ({
  default({ alt, src, className }: { alt?: string; src: string; className?: string }) {
    return React.createElement("img", { alt: alt ?? "", src, className });
  },
}));

describe("TeamMemberCard", () => {
  test("shows sample size warning for underpowered records", () => {
    const html = renderToStaticMarkup(
      <TeamMemberCard
        memberId="chart_analyst"
        displayName="K"
        labels={teamLabels}
        winrate={{
          memberId: "chart_analyst",
          totalDecisions: 3,
          wins: 2,
          winRate: 2 / 3,
          netReturn7d: 4.2,
          recordSourceMix: {
            live: 0,
            paper: 3,
            legacy: 0,
            backtest: 0,
          },
          sampleSizeWarning: true,
        }}
      />,
    );

    expect(html).toContain("Small sample");
  });
});

const memberLabels = {
  displayName: "K",
  roleTitle: "Chart Analyst",
  shortBio: "Reads key levels.",
  ariaLabel: "K, Chart Analyst",
};

const teamLabels: Dict["team"] = {
  trackRecord: {
    title: "Team Track Record",
    subtitle: "Public history.",
    totalDecisions: "Decisions",
    overallWinRate: "Win rate",
    teamNetReturn7d: "7d net",
    decisions: "Decisions",
    wins: "Wins",
    winRate: "Win rate",
    netReturn7d: "7d net",
    sampleSizeSmall: "Small sample",
    noRecords: "No records",
    aiDisclaimer: "AI only.",
    source: {
      live: "live",
      paper: "paper",
      legacy: "legacy",
      backtest: "backtest",
      mixed: "mixed",
      none: "pending",
    },
  },
  fundamental_analyst: memberLabels,
  news_analyst: memberLabels,
  chart_analyst: memberLabels,
  onchain_analyst: memberLabels,
  research_lead: memberLabels,
  risk_lead: memberLabels,
  pm: memberLabels,
};
