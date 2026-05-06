import fs from "node:fs";

const agents = ["alpha", "beta", "gamma"];

for (const agentId of agents) {
  const filePath = `src/modules/agent-watch/skills/${agentId}.json`;
  const skill = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!Array.isArray(skill.fallbacks?.stream) || skill.fallbacks.stream.length < 30) {
    throw new Error(`${agentId} needs at least 30 stream fallbacks`);
  }

  if (!Array.isArray(skill.fallbacks?.heroBubbles) || skill.fallbacks.heroBubbles.length < 10) {
    throw new Error(`${agentId} needs at least 10 hero bubble fallbacks`);
  }

  for (const symbol of ["BTC", "ETH", "SOL", "USDT"]) {
    if (typeof skill.fallbacks?.coinComments?.[symbol] !== "string") {
      throw new Error(`${agentId} needs a ${symbol} coin fallback`);
    }
  }
}

console.log("agent watch fallback contracts ok");
