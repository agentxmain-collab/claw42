import { describe, expect, it } from "vitest";
import { TEAM_MEMBER_IDS } from "@/lib/team/teamRegistry";
import {
  TEAM_ROLE_EXECUTION_CONTRACTS,
  buildRoleExecutionTrace,
} from "@/lib/team/roleExecutionPolicy";
import type { EvidenceContextPack } from "@/lib/team/evidenceDispatcher";

function pack(): EvidenceContextPack {
  return {
    symbol: "BTC",
    chart: {
      status: "ok",
      items: [
        {
          id: "chart:btc",
          domain: "chart",
          status: "ok",
          source: "test",
          summary: "BTC holds trend support",
        },
      ],
      summary: "BTC holds trend support",
    },
    news: {
      status: "ok",
      items: [
        {
          id: "news:btc",
          domain: "news",
          status: "ok",
          source: "test",
          summary: "ETF inflow pressure remains supportive",
        },
      ],
      summary: "ETF inflow pressure remains supportive",
    },
    onchain: {
      status: "missing",
      items: [],
      summary: "neutral",
    },
    fundamental: {
      status: "missing",
      items: [],
      summary: "neutral",
    },
    market: {
      status: "ok",
      items: [
        {
          id: "market:btc",
          domain: "market",
          status: "ok",
          source: "test",
          summary: "Market context confirms liquidity",
        },
      ],
      summary: "Market context confirms liquidity",
    },
    memory: {
      status: "missing",
      items: [],
      summary: "neutral",
    },
    dataStatus: {
      chart: "ok",
      news: "ok",
      onchain: "missing",
      fundamental: "missing",
      market: "ok",
      memory: "missing",
    },
  };
}

describe("role execution policy", () => {
  it("defines one unique responsibility contract for every visible team member", () => {
    expect(Object.keys(TEAM_ROLE_EXECUTION_CONTRACTS).sort()).toEqual([...TEAM_MEMBER_IDS].sort());
    const uniqueQuestions = TEAM_MEMBER_IDS.map(
      (memberId) => TEAM_ROLE_EXECUTION_CONTRACTS[memberId].uniqueQuestion,
    );

    expect(new Set(uniqueQuestions).size).toBe(TEAM_MEMBER_IDS.length);
    for (const memberId of TEAM_MEMBER_IDS) {
      const contract = TEAM_ROLE_EXECUTION_CONTRACTS[memberId];
      expect(contract.publicOutputShape.length).toBeGreaterThan(10);
      expect(contract.activationTrigger.length).toBeGreaterThan(10);
      expect(contract.fallbackPublicBehavior).not.toMatch(/missing|unavailable|not called/i);
    }
  });

  it("builds a full visible trace while only active roles contribute to PM", () => {
    const trace = buildRoleExecutionTrace({
      evidencePack: pack(),
      activeInputMemberIds: ["chart_analyst", "news_analyst", "bullish_researcher"],
      executedInputMemberIds: ["chart_analyst", "news_analyst"],
      abstainedInputMemberIds: ["bullish_researcher", "onchain_analyst", "memory_loop"],
      materialContributorIds: ["chart_analyst", "news_analyst", "research_lead", "risk_lead", "pm"],
      warningMemberIds: ["risk_lead"],
      pmEvidenceIds: ["chart:btc", "news:btc"],
      leadEvidenceIds: ["chart:btc", "news:btc"],
    });

    expect(trace).toHaveLength(TEAM_MEMBER_IDS.length);
    expect(trace.map((entry) => entry.memberId).sort()).toEqual([...TEAM_MEMBER_IDS].sort());

    expect(trace.find((entry) => entry.memberId === "pm")).toMatchObject({
      executionMode: "core_active",
      contributedToPmDecision: true,
    });
    expect(trace.find((entry) => entry.memberId === "chart_analyst")).toMatchObject({
      executionMode: "conditional_active",
      contributedToPmDecision: true,
      evidenceIdsUsed: ["chart:btc", "market:btc"],
    });
    expect(trace.find((entry) => entry.memberId === "bullish_researcher")).toMatchObject({
      executionMode: "skipped_by_policy",
      contributedToPmDecision: false,
    });
    expect(trace.find((entry) => entry.memberId === "onchain_analyst")).toMatchObject({
      executionMode: "derived_visible",
      contributedToPmDecision: false,
    });
    expect(trace.find((entry) => entry.memberId === "risk_lead")).toMatchObject({
      executionMode: "core_active",
      vetoOrWarning: true,
    });
  });
});
