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

  it("uses senior functional titles when a source team member exists", () => {
    expect(getDispatchAgentDisplayName("technical_analyst", "zh_CN", "chart_analyst")).toBe(
      "技术策略主管",
    );
    expect(getDispatchAgentDisplayName("news_analyst", "zh_CN", "news_analyst")).toBe(
      "宏观情报分析师",
    );
    expect(getDispatchAgentDisplayName("onchain_analyst", "en_US", "onchain_analyst")).toBe(
      "On-chain Data Lead",
    );
    expect(getDispatchAgentDisplayName("trader", "zh_CN")).toBe("交易策略总监");
    expect(getDispatchAgentDisplayName("aggressive_reviewer", "zh_CN")).toBe("收益进攻官");
    expect(getDispatchAgentDisplayName("portfolio_manager", "zh_CN", "pm")).toBe("首席投资官");
  });

  it("keeps the synthetic role list free of removed v9 agents", () => {
    expect(DISPATCH_AGENT_NOT_IN_CURRENT).not.toContain("sentiment_analyst");
  });
});
