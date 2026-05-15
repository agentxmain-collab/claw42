import { describe, expect, test } from "vitest";
import { TEAM_MEMBER_IDS, TEAM_MEMBER_REGISTRY, getTeamMember } from "@/lib/team/teamRegistry";

describe("TEAM_MEMBER_REGISTRY", () => {
  test("contains the fourteen Watch team members", () => {
    expect(TEAM_MEMBER_IDS).toEqual([
      "fundamental_analyst",
      "news_analyst",
      "chart_analyst",
      "onchain_analyst",
      "research_lead",
      "risk_lead",
      "pm",
      "bullish_researcher",
      "bearish_researcher",
      "trader",
      "aggressive_reviewer",
      "neutral_reviewer",
      "conservative_reviewer",
      "memory_loop",
    ]);
    expect(Object.keys(TEAM_MEMBER_REGISTRY)).toHaveLength(14);
  });

  test("references prompt document paths for each member", () => {
    for (const id of TEAM_MEMBER_IDS) {
      const member = getTeamMember(id);

      expect(member.promptDocPath).toBe(`docs/agent-ip/team/${id}.md`);
      expect(member.id).toBe(id);
      expect(member.displayNameKey).toBe(`team.${id}.displayName`);
      expect(member.roleTitleKey).toBe(`team.${id}.roleTitle`);
      expect(member.avatarPath).toBe(`/images/team/${id}.svg`);
    }
  });

  test("defaults all watch team roles to DeepSeek after public-experience cleanup", () => {
    for (const id of TEAM_MEMBER_IDS) {
      expect(getTeamMember(id).defaultProvider).toBe("deepseek");
    }
  });
});
