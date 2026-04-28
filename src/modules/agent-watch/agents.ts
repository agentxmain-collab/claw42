import alphaSkill from "./skills/alpha.json";
import betaSkill from "./skills/beta.json";
import gammaSkill from "./skills/gamma.json";
import type { AgentDisplayMeta, AgentId, AgentSkill } from "./types";

export const AGENT_COLOR_TOKEN: Record<
  AgentId,
  { primary: string; soft: string; glow: string }
> = {
  alpha: {
    primary: "#ff5f5f",
    soft: "rgba(255, 95, 95, 0.18)",
    glow: "rgba(255, 95, 95, 0.42)",
  },
  beta: {
    primary: "#3a7bff",
    soft: "rgba(58, 123, 255, 0.18)",
    glow: "rgba(58, 123, 255, 0.42)",
  },
  gamma: {
    primary: "#9b6bff",
    soft: "rgba(155, 107, 255, 0.18)",
    glow: "rgba(155, 107, 255, 0.42)",
  },
};

const skillMap: Record<AgentId, AgentSkill> = {
  alpha: alphaSkill as AgentSkill,
  beta: betaSkill as AgentSkill,
  gamma: gammaSkill as AgentSkill,
};

export const AGENT_META: Record<AgentId, AgentDisplayMeta> = {
  alpha: {
    id: "alpha",
    name: skillMap.alpha.displayName,
    tagline: skillMap.alpha.tagline,
    color: AGENT_COLOR_TOKEN.alpha.primary,
    avatar: "A",
    avatarSrc: "/images/agents/alpha-120.png",
  },
  beta: {
    id: "beta",
    name: skillMap.beta.displayName,
    tagline: skillMap.beta.tagline,
    color: AGENT_COLOR_TOKEN.beta.primary,
    avatar: "B",
    avatarSrc: "/images/agents/beta-120.png",
  },
  gamma: {
    id: "gamma",
    name: skillMap.gamma.displayName,
    tagline: skillMap.gamma.tagline,
    color: AGENT_COLOR_TOKEN.gamma.primary,
    avatar: "G",
    avatarSrc: "/images/agents/gamma-120.png",
  },
};

export const AGENT_ORDER: AgentId[] = ["alpha", "beta", "gamma"];
