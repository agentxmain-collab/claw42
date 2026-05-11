import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { TeamWorkflowPanel } from "@/components/agent-watch/TeamWorkflowPanel";
import type { TeamActivityStatusMap } from "@/lib/team/teamWorkflowTypes";

const i18nMock = vi.hoisted(() => {
  const member = (displayName: string, roleTitle: string) => ({
    displayName,
    roleTitle,
    oneLineCapability: `${roleTitle} capability.`,
  });

  return {
    t: {
      team: {
        workflowPanel: {
          title: "AI team workflow",
          description: "Seven roles collaborate.",
          mobileStageLabel: "Flow",
        },
        workflowNode: {
          statusAnalyzing: "Analyzing",
          statusWaitingData: "Waiting data",
          statusCompletedRecently: "Just completed",
          statusIdle: "Idle",
          lastActivityPrefix: "Last activity",
        },
        fundamental_analyst: member("Chen", "Fundamental Analyst"),
        news_analyst: member("Mira", "News Analyst"),
        chart_analyst: member("K", "Chart Analyst"),
        onchain_analyst: member("Vit", "On-chain Analyst"),
        research_lead: member("Lead R", "Research Lead"),
        risk_lead: member("Risk X", "Risk Lead"),
        pm: member("PM", "Product Manager"),
      },
    },
  };
});

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => i18nMock,
}));

vi.mock("next/image", () => ({
  default({ alt, src, className }: { alt?: string; src: string; className?: string }) {
    return React.createElement("img", { alt: alt ?? "", src, className });
  },
}));

describe("TeamWorkflowPanel", () => {
  test("renders seven workflow members with status labels", () => {
    const statuses: TeamActivityStatusMap = {
      fundamental_analyst: {
        memberId: "fundamental_analyst",
        status: "completed_recently",
        lastActivityTs: Date.now(),
        activeRecordId: "record-1",
      },
      news_analyst: {
        memberId: "news_analyst",
        status: "waiting_data",
        lastActivityTs: null,
        activeRecordId: null,
      },
    };

    const html = renderToStaticMarkup(
      <TeamWorkflowPanel statuses={statuses} replayActiveMemberId="pm" />,
    );

    expect(html).toContain("AI team workflow");
    expect(html).toContain("Chen");
    expect(html).toContain("Mira");
    expect(html).toContain("PM");
    expect(html).toContain("Just completed");
    expect(html).toContain("Waiting data");
    expect(html).toContain("Analyzing");
  });
});
