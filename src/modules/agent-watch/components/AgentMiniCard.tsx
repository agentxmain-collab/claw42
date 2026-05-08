import { getFaction } from "@/lib/factionRegistry";
import type { FactionId } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

export function AgentMiniCard({ agentId }: { agentId: FactionId }) {
  const faction = getFaction(agentId);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center gap-2">
        <AgentAvatar agentId={agentId} size="message" />
        <div>
          <div className="text-sm font-bold" style={{ color: faction.color }}>
            {faction.displayName}
          </div>
          <div className="text-xs text-white/40">
            {faction.title} · {faction.nickname}
          </div>
        </div>
      </div>
    </div>
  );
}
