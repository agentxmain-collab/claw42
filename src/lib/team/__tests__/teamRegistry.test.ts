import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { TEAM_MEMBER_IDS, TEAM_MEMBER_REGISTRY, getTeamMember } from "@/lib/team/teamRegistry";
import type { PersistentPersonality, TeamMemberId } from "@/lib/team/teamRegistry";

const EXPECTED_PERSONALITY: Record<TeamMemberId, PersistentPersonality> = {
  fundamental_analyst: {
    riskBias: "balanced",
    focusStyle: "data-heavy",
    voiceTone: "analytical",
  },
  news_analyst: {
    riskBias: "balanced",
    focusStyle: "story-heavy",
    voiceTone: "terse",
  },
  chart_analyst: {
    riskBias: "balanced",
    focusStyle: "data-heavy",
    voiceTone: "terse",
  },
  onchain_analyst: {
    riskBias: "balanced",
    focusStyle: "data-heavy",
    voiceTone: "terse",
  },
  research_lead: {
    riskBias: "balanced",
    focusStyle: "story-heavy",
    voiceTone: "analytical",
  },
  risk_lead: {
    riskBias: "conservative",
    focusStyle: "data-heavy",
    voiceTone: "analytical",
  },
  pm: {
    riskBias: "balanced",
    focusStyle: "data-heavy",
    voiceTone: "analytical",
  },
  bullish_researcher: {
    riskBias: "aggressive",
    focusStyle: "story-heavy",
    voiceTone: "dramatic",
  },
  bearish_researcher: {
    riskBias: "conservative",
    focusStyle: "contrarian",
    voiceTone: "skeptical",
  },
  trader: {
    riskBias: "balanced",
    focusStyle: "data-heavy",
    voiceTone: "terse",
  },
  aggressive_reviewer: {
    riskBias: "aggressive",
    focusStyle: "story-heavy",
    voiceTone: "dramatic",
  },
  neutral_reviewer: {
    riskBias: "balanced",
    focusStyle: "contrarian",
    voiceTone: "analytical",
  },
  conservative_reviewer: {
    riskBias: "conservative",
    focusStyle: "data-heavy",
    voiceTone: "skeptical",
  },
  memory_loop: {
    riskBias: "balanced",
    focusStyle: "contrarian",
    voiceTone: "skeptical",
  },
};

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
      expect(member.persistentPersonality).toEqual(EXPECTED_PERSONALITY[id]);
    }
  });

  test("defaults all watch team roles to DeepSeek after public-experience cleanup", () => {
    for (const id of TEAM_MEMBER_IDS) {
      expect(getTeamMember(id).defaultProvider).toBe("deepseek");
    }
  });

  test("injects persistent personality at the top of every team prompt doc", () => {
    for (const id of TEAM_MEMBER_IDS) {
      const member = getTeamMember(id);
      const prompt = readFileSync(member.promptDocPath, "utf8");
      const personality = EXPECTED_PERSONALITY[id];

      expect(prompt.startsWith("## Persistent Personality")).toBe(true);
      expect(prompt).toContain(`- riskBias: ${personality.riskBias}`);
      expect(prompt).toContain(`- focusStyle: ${personality.focusStyle}`);
      expect(prompt).toContain(`- voiceTone: ${personality.voiceTone}`);
      expect(prompt).toContain("oneLineSummary");
      expect(prompt).toContain("detailedRationale");
    }
  });
});
