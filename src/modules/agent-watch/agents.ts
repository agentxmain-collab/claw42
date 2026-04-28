import alphaSkill from "./skills/alpha.json";
import betaSkill from "./skills/beta.json";
import gammaSkill from "./skills/gamma.json";
import type { AgentDisplayMeta, AgentId, AgentSkill } from "./types";

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
    color: skillMap.alpha.color,
    avatar: "A",
  },
  beta: {
    id: "beta",
    name: skillMap.beta.displayName,
    tagline: skillMap.beta.tagline,
    color: skillMap.beta.color,
    avatar: "B",
  },
  gamma: {
    id: "gamma",
    name: skillMap.gamma.displayName,
    tagline: skillMap.gamma.tagline,
    color: skillMap.gamma.color,
    avatar: "G",
  },
};

export const AGENT_ORDER: AgentId[] = ["alpha", "beta", "gamma"];
