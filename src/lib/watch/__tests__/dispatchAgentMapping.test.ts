import { describe, expect, it } from "vitest";
import {
  DISPATCH_AGENT_NOT_IN_CURRENT,
  getDispatchAgentDisplayName,
  mapTeamMemberToDispatchAgent,
} from "@/lib/watch/dispatchAgentMapping";

describe("dispatchAgentMapping", () => {
  it("maps current pipeline members to v9 dispatch agents", () => {
    expect(mapTeamMemberToDispatchAgent("fundamental_analyst")).toBe("fundamental_analyst");
    expect(mapTeamMemberToDispatchAgent("chart_analyst")).toBe("technical_analyst");
    expect(mapTeamMemberToDispatchAgent("onchain_analyst")).toBe("onchain_analyst");
    expect(mapTeamMemberToDispatchAgent("pm")).toBe("portfolio_manager");
  });

  it("maps directional lead roles to the closest v9 synthetic roles", () => {
    expect(mapTeamMemberToDispatchAgent("research_lead", "long")).toBe("bullish_researcher");
    expect(mapTeamMemberToDispatchAgent("research_lead", "short")).toBe("bearish_researcher");
    expect(mapTeamMemberToDispatchAgent("risk_lead", "wait")).toBe("neutral_reviewer");
  });

  it("uses i18n team names when a source team member exists", () => {
    expect(getDispatchAgentDisplayName("technical_analyst", "zh_CN", "chart_analyst")).toBe("K 哥");
    expect(getDispatchAgentDisplayName("onchain_analyst", "en_US", "onchain_analyst")).toBe("Vit");
  });

  it("keeps the synthetic role list free of removed v9 agents", () => {
    expect(DISPATCH_AGENT_NOT_IN_CURRENT).not.toContain("sentiment_analyst");
  });
});
