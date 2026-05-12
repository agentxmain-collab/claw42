import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PublicTimelinePayload } from "@/lib/watch/publicTimelineEvent";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { EvidenceMapProvider } from "@/components/agent-watch/CitationChip";
import { ProcessAccordion } from "@/components/agent-watch/ProcessAccordion";

const i18nMock = vi.hoisted(() => ({
  locale: "en_US",
  t: {
    agentWatch: {
      citationChip: {
        sourceUnavailable: "Source unavailable",
      },
      timeline: {
        processToggle: {
          analysts: "4 analyst views",
          leads: "Research lead + risk lead",
          collapse: "Collapse",
          expand: "Expand",
          waitingMember: "Waiting for this role to analyze...",
        },
      },
    },
    team: {
      fundamental_analyst: {
        displayName: "Chen",
        roleTitle: "Fundamental Analyst",
      },
      news_analyst: {
        displayName: "Mira",
        roleTitle: "News Analyst",
      },
      chart_analyst: {
        displayName: "K",
        roleTitle: "Chart Analyst",
      },
      onchain_analyst: {
        displayName: "Vit",
        roleTitle: "On-chain Analyst",
      },
      research_lead: {
        displayName: "Lead R",
        roleTitle: "Research Lead",
      },
      risk_lead: {
        displayName: "Risk X",
        roleTitle: "Risk Lead",
      },
      pm: {
        displayName: "PM",
        roleTitle: "PM",
      },
    },
  },
}));

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => i18nMock,
}));

vi.mock("next/image", () => ({
  default({ alt, src, className }: { alt?: string; src: string; className?: string }) {
    return React.createElement("img", { alt: alt ?? "", src, className });
  },
}));

const payload: Extract<PublicTimelinePayload, { kind: "pm_decision" }> = {
  kind: "pm_decision",
  recordId: "record-1",
  symbol: "BTC",
  tradeDecision: null,
  rationaleByMember: {
    fundamental_analyst: "BTC demand improves near 76000, so PM waits for confirmation.",
    research_lead: "Research keeps the long thesis unless 74800 breaks.",
  },
  citationsByMember: {
    fundamental_analyst: ["ev_1"],
    research_lead: ["missing_evidence"],
  },
};

const evidenceMap: Record<string, NewsEvidence> = {
  ev_1: {
    id: "ev_1",
    source: "CoinDesk",
    title: "BTC ETF inflows rise",
    url: "https://example.com/btc",
    publishedAt: new Date(Date.now() - 60_000).toISOString(),
    fetchedAt: new Date().toISOString(),
    symbol: ["BTC"],
    impactSeverity: "high",
    summary: "BTC ETF inflows rise",
  },
};

describe("ProcessAccordion", () => {
  test("renders analyst and lead rationales from PM payload", () => {
    const html = renderToStaticMarkup(
      <EvidenceMapProvider value={evidenceMap}>
        <ProcessAccordion payload={payload} />
      </EvidenceMapProvider>,
    );

    expect(html).toContain("4 analyst views");
    expect(html).toContain("Research lead + risk lead");
    expect(html).toContain("BTC demand improves near 76000");
    expect(html).toContain("Research keeps the long thesis");
    expect(html).toContain("CoinDesk");
  });

  test("does not render empty citation fallback chips by default", () => {
    const html = renderToStaticMarkup(
      <EvidenceMapProvider value={evidenceMap}>
        <ProcessAccordion payload={payload} />
      </EvidenceMapProvider>,
    );

    expect(html).not.toContain("Source unavailable");
    expect(html).not.toContain("missing_evidence");
  });
});
