import { getFaction } from "@/lib/factionRegistry";
import type { AgentEmotion, FactionId, NewsSentiment, UtterancePrefix } from "@/lib/types";

export function emotionFromContext(input: {
  agentId: FactionId;
  sentiment?: NewsSentiment;
  prefix?: UtterancePrefix;
  isGoldenLine?: boolean;
}): AgentEmotion {
  if (input.isGoldenLine) return "excited";
  if (input.prefix === "rebut" || input.prefix === "mock") return "angry";
  if (input.prefix === "taunt" || input.prefix === "sneer" || input.prefix === "cool") {
    return "skeptical";
  }
  if (input.sentiment === "bullish" && getFaction(input.agentId).role !== "reversion") {
    return "confident";
  }
  if (input.sentiment === "bearish" && getFaction(input.agentId).role === "reversion") {
    return "confident";
  }
  return "neutral";
}

export function emojiForEmotion(agentId: FactionId, emotion: AgentEmotion): string {
  return getFaction(agentId).emotionEmoji[emotion];
}
